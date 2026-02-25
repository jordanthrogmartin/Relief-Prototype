import React, { useEffect, useState, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Transaction, BudgetCategory } from '../types';
import { ChevronLeft, ChevronRight, ChevronDown, Calendar as CalendarIcon, Settings, Flame, AlertTriangle } from 'lucide-react';
import { getMonthName, normalizeDate } from '../utils/dateUtils';
import { parseCategoryName } from '../utils/emojiUtils';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { BudgetAmountModal } from '../components/BudgetAmountModal';
import { useGlobalContext } from '../context/GlobalContext';

export const Budget: React.FC = () => {
    const navigate = useNavigate();
    const { 
        budgetGroups: groups, 
        budgetOverrides,
        transactions: contextTransactions,
        viewDate,
        setViewDate,
        isViewLoading,
        activeBudgetTab,
        setActiveBudgetTab,
        triggerRefresh
    } = useGlobalContext();
    
    // We synchronize local date view with Global Context View Date
    const currentDate = viewDate;

    // View State
    const [displayMode, setDisplayMode] = useState<'actual' | 'remaining'>('actual');
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

    // Modal State
    const [editingCatId, setEditingCatId] = useState<string | null>(null);
    const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false);
    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

    const toggleGroup = (groupId: string) => {
        const newSet = new Set(collapsedGroups);
        if (newSet.has(groupId)) {
            newSet.delete(groupId);
        } else {
            newSet.add(groupId);
        }
        setCollapsedGroups(newSet);
    };

    // Derived transactions for current month view
    const visibleTransactions = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        return contextTransactions.filter(t => {
            const d = normalizeDate(t.transaction_date);
            return d >= startStr && d <= endStr;
        });
    }, [contextTransactions, currentDate]);

    // History Logic (For Modal) - We can still fetch this on mount since it's only needed for the modal
    // But ideally we'd want it preloaded too. For now, let's keep the fetch but make it non-blocking for the UI.
    const [historyTransactions, setHistoryTransactions] = useState<Transaction[]>([]);
    
    useEffect(() => {
        const fetchHistory = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if(!user) return;
            const today = new Date();
            const sixMonthsAgo = new Date(today.getFullYear(), today.getMonth() - 6, 1);
            const { data } = await supabase.from('transactions')
                .select('*')
                .eq('user_id', user.id)
                .gte('transaction_date', sixMonthsAgo.toISOString().split('T')[0])
                .limit(10000); 
            if (data) setHistoryTransactions(data);
        };
        fetchHistory();
    }, []); // Only fetch once

    // Helper: Get the effective planned amount for a category in the current month
    const getPlannedAmount = (cat: BudgetCategory) => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
        
        const override = budgetOverrides.find(o => o.category_id === cat.id && o.month === monthKey);
        return Math.round(override ? override.amount : cat.planned_amount);
    };

    const handleSaveBudget = async (newAmount: number, applyToFuture: boolean) => {
        if (!editingCatId) return;

        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) return;

            if (applyToFuture) {
                const { data: freshCat } = await supabase.from('budget_categories').select('planned_amount').eq('id', editingCatId).single();
                const oldBaseAmount = freshCat?.planned_amount || 0;

                const backfillPromises = [];
                for (let i = 1; i <= 12; i++) {
                    const d = new Date(currentDate.getFullYear(), currentDate.getMonth() - i, 1);
                    const backfillMonthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                    backfillPromises.push(
                        supabase.from('budget_months').upsert({
                            user_id: user.id,
                            category_id: editingCatId,
                            month: backfillMonthKey,
                            amount: oldBaseAmount
                        }, { onConflict: 'category_id, month', ignoreDuplicates: true })
                    );
                }
                
                await Promise.all(backfillPromises);

                const { error: updateError } = await supabase.from('budget_categories').update({ planned_amount: newAmount }).eq('id', editingCatId);
                if (updateError) throw updateError;
                
                const currentMonthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                await supabase.from('budget_months').delete().eq('user_id', user.id).eq('category_id', editingCatId).gte('month', currentMonthKey);

            } else {
                const monthKey = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}`;
                await supabase.from('budget_months').upsert({
                    user_id: user.id,
                    category_id: editingCatId,
                    month: monthKey,
                    amount: newAmount
                }, { onConflict: 'category_id, month' });
            }
            setEditingCatId(null);
            // We rely on context update for UI, but context only has initial load overrides.
            // In a real app we'd refresh context here. For now, let's just trigger a reload if needed, but optimally update locally.
            // Since overrides are in GlobalContext, we should refresh.
            triggerRefresh(); // Simplest way to ensure global context gets new overrides for now without adding more context logic.
        } catch (error) {
            console.error(error);
            alert("Failed to save budget.");
        }
    };

    const calculateCategoryActual = (categoryName: string, type: string, txns = visibleTransactions) => {
        return Math.round(txns
            .filter(t => 
                t.category === categoryName && 
                t.type === type && 
                (t.status === 'cleared' || t.status === 'pending')
            )
            .reduce((acc, t) => acc + Math.abs(t.amount), 0));
    };
    
    const calculateCategoryExpected = (categoryName: string, type: string, txns = visibleTransactions) => {
        return Math.round(txns
            .filter(t => 
                t.category === categoryName && 
                t.type === type && 
                t.status === 'expected'
            )
            .reduce((acc, t) => acc + Math.abs(t.amount), 0));
    };

    // --- Left to Budget Calculation ---
    const getBudgetBreakdown = () => {
        let totalIncome = 0;
        let totalExpense = 0;
        let totalGoals = 0;

        // New calculations for boxes
        let totalLeftToEarn = 0;
        let totalLeftToSpend = 0;
        let incomeAlertActive = false;

        groups.forEach(g => {
            g.categories.forEach(c => {
                const planned = getPlannedAmount(c);
                const actual = calculateCategoryActual(c.name, g.type);
                const expected = calculateCategoryExpected(c.name, g.type);
                const projected = actual + expected;

                if (g.type === 'income') {
                    totalIncome += planned;
                    const diff = projected - planned;
                    totalLeftToEarn += diff;

                    // Alert Logic: Over budget (Income > Planned) OR (Under budget AND Fixed)
                    const isOver = diff > 0;
                    const isUnder = diff < 0;
                    if (isOver || (isUnder && c.is_fixed)) {
                        incomeAlertActive = true;
                    }
                }
                else if (g.type === 'expense') {
                    totalExpense += planned;
                    const remaining = planned - projected;
                    totalLeftToSpend += remaining;
                }
                else if (g.type === 'goal') {
                    totalGoals += planned;
                }
            });
        });

        return {
            income: totalIncome,
            expense: totalExpense,
            goals: totalGoals,
            left: totalIncome - totalExpense - totalGoals,
            totalLeftToEarn,
            totalLeftToSpend,
            incomeAlertActive
        };
    };

    const { left: leftToBudget, income: totalIncome, expense: totalExpense, goals: totalGoals, totalLeftToEarn, totalLeftToSpend, incomeAlertActive } = getBudgetBreakdown();
    
    let ltbBg = "bg-slate-800/50";
    let ltbBorder = "border-white/5";
    let ltbText = "text-slate-400";
    let ltbLabel = "text-slate-500";

    if (leftToBudget > 0) {
        ltbBg = "bg-emerald-500/20";
        ltbBorder = "border-emerald-500/50";
        ltbText = "text-emerald-400";
        ltbLabel = "text-emerald-400/70";
    } else if (leftToBudget < 0) {
        ltbBg = "bg-red-500/20";
        ltbBorder = "border-red-500/50";
        ltbText = "text-red-400";
        ltbLabel = "text-red-400/70";
    }

    // --- Date Navigation ---
    const jumpToDate = (monthIndex: number) => {
        setViewDate(new Date(pickerYear, monthIndex, 1));
        setShowDatePicker(false);
    };
    const jumpToToday = () => {
        const today = new Date();
        setViewDate(today);
        setPickerYear(today.getFullYear());
        setShowDatePicker(false);
    };

    // prepare stats for modal
    const getModalProps = () => {
        if (!editingCatId) return null;
        
        let cat: BudgetCategory | undefined;
        let grpType = "";
        groups.forEach(g => {
            const found = g.categories.find(c => c.id === editingCatId);
            if (found) { cat = found; grpType = g.type; }
        });

        if (!cat) return null;

        const planned = getPlannedAmount(cat);
        const actualThisMonth = calculateCategoryActual(cat.name, grpType, visibleTransactions);
        const expectedThisMonth = calculateCategoryExpected(cat.name, grpType, visibleTransactions);
        const remaining = planned - actualThisMonth - expectedThisMonth;

        // Stats Logic (Relative to TODAY, not budget view date)
        const today = new Date();
        const lastMonthDate = new Date(today.getFullYear(), today.getMonth() - 1, 1);
        const lastMonthStr = `${lastMonthDate.getFullYear()}-${String(lastMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const lastMonthTxns = historyTransactions.filter(t => t.transaction_date.startsWith(lastMonthStr));
        const spentLastMonth = calculateCategoryActual(cat.name, grpType, lastMonthTxns);

        let totalSixMonths = 0;
        const history = [];
        
        for (let i = 5; i >= 0; i--) {
            const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
            const mStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
            const mName = getMonthName(d.getMonth()).substring(0, 3).toUpperCase();
            const mTxns = historyTransactions.filter(t => t.transaction_date.startsWith(mStr));
            const amount = calculateCategoryActual(cat.name, grpType, mTxns);
            totalSixMonths += amount;
            history.push({ month: mName, amount: amount, isCurrent: i === 0 });
        }
        
        const averageSpent = Math.round(totalSixMonths / 6);

        // Need to filter historyTransactions for this category to pass to modal
        const categoryTransactions = historyTransactions.filter(t => 
            t.category === cat?.name && 
            t.type === grpType
        );

        return {
            categoryName: cat.name,
            currentAmount: planned,
            actualSpentThisMonth: actualThisMonth, // Pass actual for dynamic calculation
            expectedThisMonth,
            remaining,
            spentLastMonth,
            averageSpent,
            history,
            transactions: categoryTransactions,
            type: grpType
        };
    };

    const modalProps = getModalProps();

    const stripeStyle = {
        backgroundImage: 'linear-gradient(45deg,rgba(255,255,255,0.15) 25%,transparent 25%,transparent 50%,rgba(255,255,255,0.15) 50%,rgba(255,255,255,0.15) 75%,transparent 75%,transparent)',
        backgroundSize: '1rem 1rem'
    };

    const renderIncomeBar = (planned: number, actual: number, expected: number) => {
        const totalProjected = actual + expected;
        const maxVal = Math.max(planned, totalProjected);
        
        if (maxVal === 0) return <div className="h-1.5 w-full bg-slate-800 rounded-full" />;

        const toPct = (val: number) => (val / maxVal) * 100;
        const goalpostLeft = toPct(planned);
        
        const segments = [];

        if (totalProjected <= planned) {
            // Under/At Budget
            if (actual > 0) segments.push({ width: toPct(actual), color: 'bg-emerald-500', striped: false });
            if (expected > 0) segments.push({ width: toPct(expected), color: 'bg-emerald-500/30', striped: true });
            
            const gap = planned - totalProjected;
            if (gap > 0) segments.push({ width: toPct(gap), color: 'bg-red-500/30', striped: true });
        } else {
            // Over Budget
            if (actual <= planned) {
                if (actual > 0) segments.push({ width: toPct(actual), color: 'bg-emerald-500', striped: false });
                
                const expectedInPlan = planned - actual;
                if (expectedInPlan > 0) segments.push({ width: toPct(expectedInPlan), color: 'bg-emerald-500/30', striped: true });
                
                const expectedOverage = expected - expectedInPlan;
                if (expectedOverage > 0) segments.push({ width: toPct(expectedOverage), color: 'bg-amber-400/30', striped: true });
            } else {
                if (planned > 0) segments.push({ width: toPct(planned), color: 'bg-emerald-500', striped: false });
                
                const actualOverage = actual - planned;
                if (actualOverage > 0) segments.push({ width: toPct(actualOverage), color: 'bg-amber-400', striped: false });
                
                if (expected > 0) segments.push({ width: toPct(expected), color: 'bg-amber-400/30', striped: true });
            }
        }

        return (
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative flex">
                {segments.map((seg, i) => (
                    <div 
                        key={i}
                        className={`h-full ${seg.color}`}
                        style={{ 
                            width: `${seg.width}%`,
                            ...(seg.striped ? stripeStyle : {})
                        }}
                    />
                ))}
                {totalProjected > planned && (
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-white z-10 shadow-[0_0_2px_rgba(0,0,0,0.8)]"
                        style={{ left: `${Math.min(goalpostLeft, 99.5)}%` }} 
                    />
                )}
            </div>
        );
    };

    const renderExpenseBar = (planned: number, actual: number, expected: number) => {
        const totalProjected = actual + expected;
        const maxVal = Math.max(planned, totalProjected);
        
        if (maxVal === 0) return <div className="h-1.5 w-full bg-slate-800 rounded-full" />;

        const toPct = (val: number) => (val / maxVal) * 100;
        const goalpostLeft = toPct(planned);
        
        const segments = [];

        if (totalProjected <= planned) {
            // Under/At Budget
            if (actual > 0) segments.push({ width: toPct(actual), color: 'bg-emerald-500', striped: false });
            if (expected > 0) segments.push({ width: toPct(expected), color: 'bg-emerald-500/30', striped: true });
        } else {
            // Over Budget
            if (actual <= planned) {
                if (actual > 0) segments.push({ width: toPct(actual), color: 'bg-emerald-500', striped: false });
                
                const expectedInBudget = planned - actual;
                if (expectedInBudget > 0) segments.push({ width: toPct(expectedInBudget), color: 'bg-emerald-500/30', striped: true });
                
                const expectedOver = expected - expectedInBudget;
                if (expectedOver > 0) segments.push({ width: toPct(expectedOver), color: 'bg-red-500/30', striped: true });
            } else {
                if (planned > 0) segments.push({ width: toPct(planned), color: 'bg-emerald-500', striped: false });
                
                const actualOver = actual - planned;
                if (actualOver > 0) segments.push({ width: toPct(actualOver), color: 'bg-red-500', striped: false });
                
                if (expected > 0) segments.push({ width: toPct(expected), color: 'bg-red-500/30', striped: true });
            }
        }

        return (
            <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden relative flex">
                {segments.map((seg, i) => (
                    <div 
                        key={i}
                        className={`h-full ${seg.color}`}
                        style={{ 
                            width: `${seg.width}%`,
                            ...(seg.striped ? stripeStyle : {})
                        }}
                    />
                ))}
                {totalProjected > planned && (
                    <div 
                        className="absolute top-0 bottom-0 w-px bg-white z-10 shadow-[0_0_2px_rgba(0,0,0,0.8)]"
                        style={{ left: `${Math.min(goalpostLeft, 99.5)}%` }} 
                    />
                )}
            </div>
        );
    };

    // Swipe Logic
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const isScrollingRef = useRef(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isScrollingRef.current = false;
        setIsDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        const dx = e.touches[0].clientX - touchStartRef.current.x;
        const dy = e.touches[0].clientY - touchStartRef.current.y;

        if (Math.abs(dy) > Math.abs(dx)) {
            isScrollingRef.current = true;
            return;
        }

        if (isScrollingRef.current) return;
        setDragOffset(dx);
    };

    const onTouchEnd = () => {
        if (!isScrollingRef.current && touchStartRef.current) {
            const threshold = 50;
            const tabs: Array<'overview' | 'income' | 'expenses' | 'goals'> = ['overview', 'income', 'expenses', 'goals'];
            const currentIndex = tabs.indexOf(activeBudgetTab);
            
            if (dragOffset < -threshold && currentIndex < tabs.length - 1) {
                setActiveBudgetTab(tabs[currentIndex + 1]);
            } else if (dragOffset > threshold && currentIndex > 0) {
                setActiveBudgetTab(tabs[currentIndex - 1]);
            }
        }
        
        setDragOffset(0);
        setIsDragging(false);
        touchStartRef.current = null;
        isScrollingRef.current = false;
    };

    const renderTabContent = (tab: string) => {
        if (tab === 'overview') {
            return (
                <div className="p-8 text-center text-slate-500 italic text-sm border border-dashed border-white/10 rounded-2xl">
                    Overview coming soon...
                </div>
            );
        }

        const type = tab === 'income' ? 'income' : tab === 'expenses' ? 'expense' : 'goal';
        const typeGroups = groups.filter(g => g.type === type);
        
        return (
            <div className="space-y-3">
                {/* Header Row */}
                <div className="flex items-center px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <div className="w-[50%] flex items-center">
                        <div className="w-6"></div>
                        <div className="flex-1">Category</div>
                        <div className="w-5"></div>
                    </div>
                    <div className="w-[50%] flex items-center">
                        <div className="w-[60%] text-center">Usage</div>
                        <div className={`w-[40%] text-right ${type === 'expense' || type === 'income' ? 'text-[9px] whitespace-nowrap' : ''}`}>
                            {type === 'expense' ? 'Left to spend' : type === 'income' ? 'Left to earn' : 'Available'}
                        </div>
                    </div>
                </div>
                
                {typeGroups.length === 0 && <div className="p-4 border border-dashed border-white/10 rounded-xl text-center text-[10px] text-slate-500 italic">No {type === 'goal' ? 'Goals' : type} Groups</div>}
                
                {typeGroups.map(group => {
                    const groupPlanned = group.categories.reduce((sum, cat) => sum + getPlannedAmount(cat), 0);
                    const groupActual = group.categories.reduce((sum, cat) => sum + calculateCategoryActual(cat.name, type), 0);
                    const groupExpected = group.categories.reduce((sum, cat) => sum + calculateCategoryExpected(cat.name, type), 0);
                    const groupRemaining = type === 'income' 
                        ? (groupActual + groupExpected) - groupPlanned
                        : groupPlanned - groupActual - groupExpected;
                    
                    const isCollapsed = collapsedGroups.has(group.id);

                    return (
                        <div key={group.id} className="rounded-2xl border border-white/5 bg-[#0F172A] shadow-lg shadow-black/40 overflow-hidden mb-4">
                            <div 
                                className="p-3 bg-relief-surface border-b border-relief-border flex items-center cursor-pointer hover:bg-white/5 transition-colors"
                                onClick={() => toggleGroup(group.id)}
                            >
                                <div className="w-[50%] flex items-center">
                                    <div className="w-6 flex justify-center text-slate-400">
                                        {isCollapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
                                    </div>
                                    <div className="flex-1 font-bold text-sm text-relief-text-primary truncate pr-2">{group.name}</div>
                                    <div className="w-5"></div>
                                </div>
                                <div className="w-[50%] flex items-center">
                                    <div className="w-[60%] pl-1 pr-2">
                                        {type === 'income' ? (
                                            renderIncomeBar(groupPlanned, groupActual, groupExpected)
                                        ) : (
                                            renderExpenseBar(groupPlanned, groupActual, groupExpected)
                                        )}
                                    </div>
                                    <div className={`w-[40%] text-right text-xs font-bold ${
                                        groupRemaining < 0 
                                            ? 'text-red-400' 
                                            : groupRemaining === 0 
                                                ? 'text-[#2E93FA]' 
                                                : 'text-emerald-400'
                                    }`}>
                                        ${Math.round(groupRemaining).toLocaleString()}
                                    </div>
                                </div>
                            </div>
                            
                            {!isCollapsed && (
                                <div>
                                    {group.categories.map(cat => {
                                        const { emoji, name } = parseCategoryName(cat.name);
                                        const actual = calculateCategoryActual(cat.name, type);
                                        const expected = calculateCategoryExpected(cat.name, type);
                                        const planned = getPlannedAmount(cat);
                                        const remaining = type === 'income'
                                            ? (actual + expected) - planned
                                            : planned - actual - expected;
                                        
                                        const diff = (actual + expected) - planned;
                                        const isOver = diff > 0;
                                        const isUnder = diff < 0;
                                        const showRowAlert = type === 'income' && (isOver || (isUnder && cat.is_fixed));

                                        const formatSafeToSpend = (amount: number) => {
                                            const absAmount = Math.abs(amount);
                                            const sign = amount < 0 ? '-' : '';
                                            
                                            if (absAmount >= 1000000) {
                                                return `${sign}${(absAmount / 1000000).toFixed(1)}M`;
                                            }
                                            if (absAmount >= 10000) {
                                                return `${sign}${(absAmount / 1000).toFixed(1)}k`;
                                            }
                                            return `${sign}${Math.round(absAmount).toLocaleString()}`;
                                        };

                                        return (
                                            <div 
                                                key={cat.id} 
                                                onClick={() => setEditingCatId(cat.id)}
                                                className="flex items-center px-3 py-3 border-b border-white/5 hover:bg-white/5 cursor-pointer transition-colors group"
                                            >
                                                <div className="w-[50%] flex items-center">
                                                    <div className="w-6 text-xs flex justify-center">{emoji}</div>
                                                    <div className="flex-1 text-[10px] font-bold tracking-tight text-slate-200 truncate pr-2">{name}</div>
                                                    <div className="w-5 flex justify-end pr-1">
                                                        {!cat.is_fixed && <Flame size={14} className="text-[#FF4D00]" fill="#FF4D00" />}
                                                    </div>
                                                </div>
                                                <div className="w-[50%] flex items-center">
                                                    <div className="w-[60%] pl-1 pr-2">
                                                        {type === 'income' ? (
                                                            renderIncomeBar(planned, actual, expected)
                                                        ) : (
                                                            renderExpenseBar(planned, actual, expected)
                                                        )}
                                                    </div>
                                                    <div className={`w-[40%] text-right text-[11px] font-bold flex items-center justify-end gap-1 ${
                                                        remaining < 0 
                                                            ? 'text-red-400' 
                                                            : remaining === 0 
                                                                ? 'text-[#2E93FA]' 
                                                                : 'text-emerald-400'
                                                    }`}>
                                                        {showRowAlert && <AlertTriangle size={10} className="text-amber-400 animate-pulse" />}
                                                        ${formatSafeToSpend(remaining)}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    const tabs = ['overview', 'income', 'expenses', 'goals'];
    const activeTabIndex = tabs.indexOf(activeBudgetTab);
    
    const containerStyle = {
        transform: `translateX(calc(-${activeTabIndex * 25}% + ${dragOffset}px))`,
        transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)'
    };

    return (
        <div className="space-y-4 pt-1 px-4 animate-page-enter pb-24">
            {/* Month Switcher Bar */}
            <div className="flex items-center justify-between px-2 py-0">
                <button onClick={() => setViewDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1))} className="p-2 text-slate-400 hover:text-white border border-white/5 rounded-lg bg-slate-800/50">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => { setPickerYear(currentDate.getFullYear()); setShowDatePicker(true); }}
                    className="flex items-center gap-2 px-6 py-2 text-sm font-bold text-white border rounded-xl bg-slate-800/50 border-white/10 hover:bg-white/5 transition-colors"
                >
                    <CalendarIcon className="w-4 h-4 text-emerald-400" />
                    {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
                </button>
                <button onClick={() => setViewDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1))} className="p-2 text-slate-400 hover:text-white border border-white/5 rounded-lg bg-slate-800/50">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            {/* Income Alert Banner */}
            {incomeAlertActive && (
                <div className="px-2">
                    <div className="flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-wider text-amber-400 animate-pulse">
                        <AlertTriangle size={12} />
                        Your projected income differs from your budget.
                    </div>
                </div>
            )}

            {/* Left to Budget Header */}
            <div className="px-2 space-y-2">
                <button 
                    onClick={() => setShowBudgetBreakdown(true)}
                    className={`w-full p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all active:scale-95 bg-[#0F172A] ${leftToBudget >= 0 ? 'border-relief-primary/50' : 'border-relief-critical/50'}`}
                >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${leftToBudget >= 0 ? 'text-relief-primary' : 'text-relief-critical'}`}>Left to Budget</span>
                    <span className={`text-xl font-bold ${leftToBudget >= 0 ? 'text-relief-primary' : 'text-relief-critical'}`}>
                        {leftToBudget < 0 ? '-' : ''}${Math.abs(leftToBudget).toLocaleString()}
                    </span>
                </button>

                {/* Left to Earn / Left to Spend Boxes */}
                <div className="flex gap-2">
                    <div className="flex-1 p-3 rounded-xl border border-white/5 bg-[#0F172A] flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Left to Earn</span>
                        <span className={`text-sm font-bold ${totalLeftToEarn > 0 ? 'text-emerald-400' : totalLeftToEarn < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                            {totalLeftToEarn > 0 ? '+' : ''}{totalLeftToEarn.toLocaleString()}
                        </span>
                    </div>
                    <div className="flex-1 p-3 rounded-xl border border-white/5 bg-[#0F172A] flex flex-col items-center justify-center">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-500 mb-0.5">Left to Spend</span>
                        <span className={`text-sm font-bold ${totalLeftToSpend < 0 ? 'text-red-400' : 'text-slate-200'}`}>
                            {totalLeftToSpend.toLocaleString()}
                        </span>
                    </div>
                </div>
            </div>

            <div 
                className={`transition-opacity duration-200 ${isViewLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'} overflow-hidden touch-pan-y`}
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div className="flex w-[400%] will-change-transform" style={containerStyle}>
                    {tabs.map(tab => (
                        <div key={tab} className="w-1/4 px-2">
                            {renderTabContent(tab)}
                        </div>
                    ))}
                </div>
            </div>

            {/* Budget Amount Modal */}
            {editingCatId && modalProps && createPortal(
                <div className="fixed inset-0 z-[100] flex flex-col bg-[#020617] animate-fade-in">
                    <BudgetAmountModal 
                        {...modalProps}
                        onSave={handleSaveBudget}
                        onCancel={() => setEditingCatId(null)}
                    />
                </div>,
                document.body
            )}

            {/* Budget Breakdown Modal */}
            <Modal isOpen={showBudgetBreakdown} onClose={() => setShowBudgetBreakdown(false)} title="Budget Breakdown">
                 <div className="space-y-4">
                     <div className="flex items-center justify-between p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                         <span className="text-sm font-bold text-emerald-400">Total Income</span>
                         <span className="text-sm font-bold text-emerald-400">${totalIncome.toLocaleString()}</span>
                     </div>
                     <div className="flex flex-col gap-2">
                         <div className="flex items-center justify-between p-3 rounded-lg bg-red-500/10 border border-red-500/20">
                            <span className="text-sm font-bold text-red-400">Total Expenses</span>
                            <span className="text-sm font-bold text-red-400">-${totalExpense.toLocaleString()}</span>
                         </div>
                         <div className="flex items-center justify-between p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                            <span className="text-sm font-bold text-blue-400">Total Goals</span>
                            <span className="text-sm font-bold text-blue-400">-${totalGoals.toLocaleString()}</span>
                         </div>
                     </div>
                     <div className={`flex items-center justify-between p-4 rounded-xl border ${leftToBudget >= 0 ? 'bg-emerald-500/20 border-emerald-500/50' : 'bg-red-500/20 border-red-500/50'} mt-2`}>
                         <span className={`font-bold ${leftToBudget >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>Left to Budget</span>
                         <span className={`text-xl font-bold ${leftToBudget >= 0 ? 'text-emerald-300' : 'text-red-300'}`}>
                             {leftToBudget < 0 ? '-' : ''}${Math.abs(leftToBudget).toLocaleString()}
                         </span>
                     </div>
                     <div className="pt-2">
                        <Button variant="secondary" onClick={() => setShowBudgetBreakdown(false)} fullWidth>Close</Button>
                     </div>
                 </div>
            </Modal>

            {/* Month Picker Modal */}
            <Modal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} title="Select Month">
                <div className="space-y-4">
                    <div className="mb-4">
                        <Button onClick={jumpToToday} className="bg-emerald-400/10 text-emerald-400 border border-emerald-400/50 hover:bg-emerald-400/20" fullWidth>
                            Jump to Today
                        </Button>
                    </div>
                    <div className="flex items-center justify-between p-2 mb-4 rounded-xl bg-slate-900/50">
                        <button onClick={() => setPickerYear(y => y - 1)} className="p-2 text-slate-400 hover:text-white"><ChevronLeft /></button>
                        <span className="text-xl font-bold text-emerald-300">{pickerYear}</span>
                        <button onClick={() => setPickerYear(y => y + 1)} className="p-2 text-slate-400 hover:text-white"><ChevronRight /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <button
                                key={i}
                                onClick={() => jumpToDate(i)}
                                className={`py-3 rounded-lg text-xs font-bold uppercase ${currentDate.getMonth() === i && currentDate.getFullYear() === pickerYear ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}
                            >
                                {getMonthName(i).substring(0, 3)}
                            </button>
                        ))}
                    </div>
                    <div className="pt-4">
                        <Button variant="secondary" onClick={() => setShowDatePicker(false)} fullWidth>Cancel</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};