import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { supabase } from '../services/supabase';
import { Transaction, BudgetGroup, BudgetMonth, UserProfile, TransactionRule } from '../types';
import { getTodayInTimezone, normalizeDate } from '../utils/dateUtils';

interface CurrentMonthStats {
    status: 'Healthy' | 'Caution' | 'Critical';
    lowestPoint: number;
    lowestDay: number;
    monthName: string;
}

interface GlobalContextType {
    // App State
    isAppLoading: boolean;
    
    // Core Data (Preloaded)
    userProfile: UserProfile | null;
    budgetGroups: BudgetGroup[];
    transactionRules: TransactionRule[];
    budgetOverrides: BudgetMonth[];
    
    // Date & Navigation
    selectedDate: string;
    setSelectedDate: (date: string) => void;
    viewDate: Date;
    setViewDate: (date: Date) => void;
    isViewLoading: boolean; 
    
    // Home Page Tab State
    activeHomeTab: 'dashboard' | 'calendar';
    setActiveHomeTab: (tab: 'dashboard' | 'calendar') => void;
    
    // Triggers
    refreshTrigger: number;
    triggerRefresh: () => void;
    showExpected: boolean;
    setShowExpected: (show: boolean) => void;
    
    // Timezone
    userTimezone: string;
    updateUserTimezone: (tz: string) => void;
    todayInTimezone: string;

    // Transaction Data
    transactions: Transaction[]; // Windowed based on viewDate
    openingBalance: number; // For the viewDate window
    
    // Persistent Dashboard Data
    currentMonthStats: CurrentMonthStats | null;
    currentBalance: number;

    // Ghost/Simulation
    ghostTransactions: Transaction[]; 
    allTransactions: Transaction[]; 
    addGhostTransactions: (txns: Transaction[]) => void;
    updateGhostTransaction: (txn: Transaction) => void;
    deleteGhostTransaction: (id: string) => void;
    clearGhostTransactions: () => void;

    // Smart Assist
    ruleCandidate: Transaction | null;
    setRuleCandidate: (txn: Transaction | null) => void;
}

const GlobalContext = createContext<GlobalContextType | undefined>(undefined);

export const GlobalProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const defaultTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
    
    // --- State ---
    const [isAppLoading, setIsAppLoading] = useState(true);
    const [refreshTrigger, setRefreshTrigger] = useState(0);

    // Core Data
    const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
    const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);
    const [transactionRules, setTransactionRules] = useState<TransactionRule[]>([]);
    const [budgetOverrides, setBudgetOverrides] = useState<BudgetMonth[]>([]);

    // Navigation & View
    const [userTimezone, setUserTimezone] = useState<string>(defaultTimezone);
    const [todayInTimezone, setTodayInTimezone] = useState<string>(getTodayInTimezone(defaultTimezone));
    const [selectedDate, setSelectedDate] = useState<string>(getTodayInTimezone(defaultTimezone));
    const [viewDate, setViewDate] = useState<Date>(new Date());
    const [isViewLoading, setIsViewLoading] = useState(false);
    const [showExpected, setShowExpected] = useState(true);
    const [activeHomeTab, setActiveHomeTab] = useState<'dashboard' | 'calendar'>('dashboard');
    
    // Transactions & Balances
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [openingBalance, setOpeningBalance] = useState(0);
    const [currentMonthStats, setCurrentMonthStats] = useState<CurrentMonthStats | null>(null);
    const [currentBalance, setCurrentBalance] = useState(0);
    
    const [ghostTransactions, setGhostTransactions] = useState<Transaction[]>([]);
    const [ruleCandidate, setRuleCandidate] = useState<Transaction | null>(null);

    // --- Master Fetch Logic ---
    useEffect(() => {
        const loadGlobalData = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                setIsAppLoading(false);
                return;
            }

            try {
                // 1. Fetch Static/Config Data (Parallel)
                const [
                    profileRes,
                    groupsRes,
                    rulesRes,
                    overridesRes
                ] = await Promise.all([
                    supabase.from('profiles').select('*').eq('id', user.id).single(),
                    supabase.from('budget_groups').select('*, categories:budget_categories(*)').order('sort_order'),
                    supabase.from('transaction_rules').select('*').eq('is_active', true),
                    supabase.from('budget_months').select('*').eq('user_id', user.id)
                ]);

                if (profileRes.data) {
                    setUserProfile(profileRes.data);
                    if (profileRes.data.timezone) {
                        setUserTimezone(profileRes.data.timezone);
                        setTodayInTimezone(getTodayInTimezone(profileRes.data.timezone));
                    }
                }

                if (groupsRes.data) {
                    const sorted = groupsRes.data.map(g => ({
                        ...g,
                        categories: g.categories.sort((a: any, b: any) => a.sort_order - b.sort_order)
                    }));
                    setBudgetGroups(sorted);
                }

                if (rulesRes.data) setTransactionRules(rulesRes.data);
                if (overridesRes.data) setBudgetOverrides(overridesRes.data);

                await fetchTransactionsAndViewData(user.id);

            } catch (error) {
                console.error("Global Load Error:", error);
            } finally {
                setIsAppLoading(false);
            }
        };

        loadGlobalData();
    }, [refreshTrigger]);

    useEffect(() => {
        const handleViewChange = async () => {
            if (isAppLoading) return;
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setIsViewLoading(true);
                await fetchTransactionsAndViewData(user.id);
                setIsViewLoading(false);
            }
        };
        handleViewChange();
    }, [viewDate]);

    const fetchTransactionsAndViewData = async (userId: string) => {
        const startDate = new Date(viewDate.getFullYear(), viewDate.getMonth(), 1);
        const endDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 6, 0); 
        const startStr = startDate.toISOString().split('T')[0];
        const endStr = endDate.toISOString().split('T')[0];

        let prevBalance = 0;
        try {
            const snapshotDate = new Date(startDate);
            snapshotDate.setMonth(snapshotDate.getMonth() - 1);
            const snapshotMonthKey = `${snapshotDate.getFullYear()}-${String(snapshotDate.getMonth() + 1).padStart(2, '0')}`;
            const { data: snapshot } = await supabase.from('monthly_snapshots').select('balance').eq('user_id', userId).eq('month', snapshotMonthKey).single();
            if (snapshot) prevBalance = snapshot.balance;
            else {
                const { data: historyData } = await supabase.from('transactions').select('amount').eq('user_id', userId).lt('transaction_date', startStr).neq('status', 'skipped');
                prevBalance = historyData?.reduce((sum, t) => sum + t.amount, 0) || 0;
            }
        } catch (e) { console.warn('Balance fetch error', e); }
        setOpeningBalance(prevBalance);

        const { data: txns } = await supabase.from('transactions').select('*').eq('user_id', userId).gte('transaction_date', startStr).lte('transaction_date', endStr).order('transaction_date', { ascending: false }).limit(5000);
        if (txns) {
            const normalized = txns.map(t => ({ ...t, transaction_date: normalizeDate(t.transaction_date) }));
            setTransactions(normalized);
        }
        await updateCurrentMonthStats(userId);
    };

    const updateCurrentMonthStats = async (userId: string) => {
        const todayD = new Date();
        const startOfMonth = new Date(todayD.getFullYear(), todayD.getMonth(), 1);
        const startStr = startOfMonth.toISOString().split('T')[0];
        const currentMonthKey = startStr.substring(0, 7);

        let monthStartBalance = 0;
        const { data: snap } = await supabase.from('monthly_snapshots').select('balance').eq('user_id', userId).eq('month', currentMonthKey).single();
        if (snap) monthStartBalance = snap.balance;
        else {
             const { data: hist } = await supabase.from('transactions').select('amount').eq('user_id', userId).lt('transaction_date', startStr).neq('status', 'skipped');
             monthStartBalance = hist?.reduce((a, t) => a + t.amount, 0) || 0;
        }

        const endOfMonth = new Date(todayD.getFullYear(), todayD.getMonth() + 1, 0);
        const endStr = endOfMonth.toISOString().split('T')[0];
        const { data: currentTxns } = await supabase.from('transactions').select('*').eq('user_id', userId).gte('transaction_date', startStr).lte('transaction_date', endStr);

        if (currentTxns) {
            const todayStr = getTodayInTimezone(defaultTimezone);
            const txnsUpToToday = currentTxns.filter(t => normalizeDate(t.transaction_date) <= todayStr && t.status !== 'skipped');
            const balance = monthStartBalance + txnsUpToToday.reduce((a, t) => a + t.amount, 0);
            setCurrentBalance(balance);

            let running = monthStartBalance;
            let lowest = Infinity;
            let lowDay = 1;
            const sorted = [...currentTxns].sort((a,b) => a.transaction_date.localeCompare(b.transaction_date));
            for (let d = 1; d <= endOfMonth.getDate(); d++) {
                const dStr = `${todayD.getFullYear()}-${String(todayD.getMonth()+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
                const daysTxns = sorted.filter(t => normalizeDate(t.transaction_date) === dStr && t.status !== 'skipped');
                running += daysTxns.reduce((a, t) => a + t.amount, 0);
                if (running < lowest) { lowest = running; lowDay = d; }
            }
            
            let status: 'Healthy' | 'Caution' | 'Critical' = 'Healthy';
            const threshold = userProfile?.balance_warning_threshold || 500;
            if (lowest < 0) status = 'Critical';
            else if (lowest < threshold) status = 'Caution';

            setCurrentMonthStats({ status, lowestPoint: lowest, lowestDay: lowDay, monthName: startOfMonth.toLocaleString('default', { month: 'long' }) });
        }
    };

    const triggerRefresh = () => setRefreshTrigger(prev => prev + 1);
    const updateUserTimezone = (tz: string) => {
        setUserTimezone(tz);
        setTodayInTimezone(getTodayInTimezone(tz));
    };
    const addGhostTransactions = (txns: Transaction[]) => setGhostTransactions(prev => [...prev, ...txns]);
    const updateGhostTransaction = (txn: Transaction) => setGhostTransactions(prev => prev.map(t => t.id === txn.id ? txn : t));
    const deleteGhostTransaction = (id: string) => setGhostTransactions(prev => prev.filter(t => t.id !== id));
    const clearGhostTransactions = () => setGhostTransactions([]);
    const allTransactions = useMemo(() => [...transactions, ...ghostTransactions], [transactions, ghostTransactions]);

    return (
        <GlobalContext.Provider value={{ 
            isAppLoading, userProfile, budgetGroups, transactionRules, budgetOverrides,
            selectedDate, setSelectedDate, viewDate, setViewDate, isViewLoading,
            activeHomeTab, setActiveHomeTab,
            refreshTrigger, triggerRefresh, showExpected, setShowExpected,
            userTimezone, updateUserTimezone, todayInTimezone,
            transactions, openingBalance, currentMonthStats, currentBalance,
            ghostTransactions, allTransactions, addGhostTransactions, updateGhostTransaction, deleteGhostTransaction, clearGhostTransactions,
            ruleCandidate, setRuleCandidate
        }}>
            {children}
        </GlobalContext.Provider>
    );
};

export const useGlobalContext = () => {
    const context = useContext(GlobalContext);
    if (!context) throw new Error("useGlobalContext must be used within a GlobalProvider");
    return context;
};