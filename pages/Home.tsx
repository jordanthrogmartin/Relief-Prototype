import React, { useEffect, useState, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Info, Settings, ArrowUp, ArrowDown, Eye, EyeOff, ShieldCheck, ShieldAlert, ShieldOff, Clock, Flame, Plus, Sparkles, Edit3 } from 'lucide-react';
import { supabase } from '../services/supabase';
import { Transaction, BudgetCategory } from '../types';
import { getMonthName, normalizeDate } from '../utils/dateUtils';
import { parseCategoryName } from '../utils/emojiUtils';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { TransactionForm } from '../components/TransactionForm';
import { WhatIfForm } from '../components/WhatIfForm';
import { EditBalanceForm } from '../components/EditBalanceForm';
import { useGlobalContext } from '../context/GlobalContext';
import { BalanceChart, ChartPoint } from '../components/BalanceChart';
import { CircularProgress } from '../components/CircularProgress';
import { CalendarView } from '../components/CalendarView';
import { getPlannedAmount, getCalendarBurnRate } from '../utils/budgetUtils';

// --- Helper Components ---

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const { 
        selectedDate: selectedDateStr, 
        setSelectedDate: setSelectedDateStr, 
        triggerRefresh, 
        allTransactions,
        currentTransactions,
        currentOpeningBalance,
        ghostTransactions,
        openingBalance,
        todayInTimezone,
        viewDate,
        setViewDate,
        currentMonthStats,
        currentBalance,
        isViewLoading,
        budgetGroups,
        budgetOverrides,
        userProfile,
        activeHomeTab,
        setActiveHomeTab
    } = useGlobalContext();
    
    const date = viewDate;
    const transactions = allTransactions;
    const dashboardTransactions = useMemo(() => [...currentTransactions, ...ghostTransactions], [currentTransactions, ghostTransactions]);

    const [lowBalanceThreshold, setLowBalanceThreshold] = useState(500);
    const [preferences, setPreferences] = useState<{ hidden_categories: string[], dashboard_order: string[] }>({
        hidden_categories: [],
        dashboard_order: []
    });
    
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());
    const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
    const [showAddTxnModal, setShowAddTxnModal] = useState(false);
    const [showWhatIfModal, setShowWhatIfModal] = useState(false);
    const [showEditBalanceModal, setShowEditBalanceModal] = useState(false);
    const [showCushionModal, setShowCushionModal] = useState(false);
    const [showSortModal, setShowSortModal] = useState(false);
    const scrollRef = useRef<HTMLDivElement>(null);
    const [showLeftArrow, setShowLeftArrow] = useState(false);
    const [showRightArrow, setShowRightArrow] = useState(false);
    const [showProjected, setShowProjected] = useState(false);
    const [showChartProjected, setShowChartProjected] = useState(false);
    const [chartMonthsToShow, setChartMonthsToShow] = useState<number>(1);
    const touchStartRef = useRef<{ x: number, y: number } | null>(null);
    const isScrollingRef = useRef(false);
    const [dragOffset, setDragOffset] = useState(0);
    const [isDragging, setIsDragging] = useState(false);
    const [hoveredChartPoint, setHoveredChartPoint] = useState<ChartPoint | null>(null);

    useEffect(() => {
        if (userProfile) {
            if (userProfile.balance_warning_threshold !== undefined) setLowBalanceThreshold(userProfile.balance_warning_threshold);
            if (userProfile.preferences) setPreferences({ hidden_categories: userProfile.preferences.hidden_categories || [], dashboard_order: userProfile.preferences.dashboard_order || [] });
        }
    }, [userProfile]);

    const updatePreferences = async (newPrefs: { hidden_categories: string[], dashboard_order: string[] }) => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        setPreferences(newPrefs); 
        await supabase.from('profiles').update({ preferences: newPrefs }).eq('id', user.id);
        triggerRefresh();
    };

    const toggleCategoryVisibility = (catId: string) => {
        const currentHidden = preferences.hidden_categories;
        const newHidden = currentHidden.includes(catId) ? currentHidden.filter(id => id !== catId) : [...currentHidden, catId];
        updatePreferences({ ...preferences, hidden_categories: newHidden });
    };

    const allVariableExpenses = useMemo(() => {
        const [tYear, tMonth] = todayInTimezone.split('-').map(Number);
        const currentMonthDate = new Date(tYear, tMonth - 1, 1);
        
        const monthKey = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}`;
        const startStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-01`;
        const endStr = `${currentMonthDate.getFullYear()}-${String(currentMonthDate.getMonth() + 1).padStart(2, '0')}-${new Date(currentMonthDate.getFullYear(), currentMonthDate.getMonth() + 1, 0).getDate()}`;
        
        let vars: any[] = [];
        budgetGroups.forEach(g => {
            if (g.type === 'expense' || g.type === 'goal') {
                g.categories.filter(c => !c.is_fixed).forEach(c => {
                    const planned = getPlannedAmount(c, monthKey, budgetOverrides);
                    const actual = dashboardTransactions.filter(t => t.category === c.name && normalizeDate(t.transaction_date) >= startStr && normalizeDate(t.transaction_date) <= endStr && (t.amount < 0 || g.type === 'goal') && t.status !== 'skipped').reduce((a, t) => a + Math.abs(t.amount), 0);
                    vars.push({ id: c.id, name: c.name, planned, remaining: planned - actual, percentActual: planned > 0 ? (actual/planned)*100 : 0 });
                });
            }
        });
        if (preferences.dashboard_order?.length) vars.sort((a,b) => (preferences.dashboard_order.indexOf(a.id) === -1 ? 999 : preferences.dashboard_order.indexOf(a.id)) - (preferences.dashboard_order.indexOf(b.id) === -1 ? 999 : preferences.dashboard_order.indexOf(b.id)));
        return vars;
    }, [budgetGroups, dashboardTransactions, todayInTimezone, budgetOverrides, preferences.dashboard_order]);

    const visibleVariableExpenses = useMemo(() => {
        return allVariableExpenses.filter(v => !preferences.hidden_categories.includes(v.id));
    }, [allVariableExpenses, preferences.hidden_categories]);

    const handleSortUpdate = (catId: string, direction: 'up' | 'down') => {
        const currentSortedIds = allVariableExpenses.map(v => v.id);
        const idx = currentSortedIds.indexOf(catId);
        if (idx === -1) return;
        
        const newOrder = [...currentSortedIds];
        if (direction === 'up' && idx > 0) {
            [newOrder[idx], newOrder[idx - 1]] = [newOrder[idx - 1], newOrder[idx]];
        } else if (direction === 'down' && idx < newOrder.length - 1) {
            [newOrder[idx], newOrder[idx + 1]] = [newOrder[idx + 1], newOrder[idx]];
        }
        
        updatePreferences({ ...preferences, dashboard_order: newOrder });
    };

    const handleScroll = (dir: 'left' | 'right') => scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    const checkScroll = () => { if (scrollRef.current) { const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current; setShowLeftArrow(scrollLeft > 0); setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5); } };
    useEffect(() => { checkScroll(); window.addEventListener('resize', checkScroll); return () => window.removeEventListener('resize', checkScroll); }, [visibleVariableExpenses]);

    const cmStatus = currentMonthStats?.status || 'Healthy';

    const onTouchStart = (e: React.TouchEvent) => {
        touchStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
        isScrollingRef.current = false;
        setIsDragging(true);
    };

    const onTouchMove = (e: React.TouchEvent) => {
        if (!touchStartRef.current) return;
        
        const currentX = e.touches[0].clientX;
        const currentY = e.touches[0].clientY;
        const diffX = currentX - touchStartRef.current.x;
        const diffY = currentY - touchStartRef.current.y;

        if (isScrollingRef.current) return;

        if (Math.abs(diffX) > Math.abs(diffY)) {
            if (e.cancelable) e.preventDefault();
            setDragOffset(diffX);
        } else {
            if (Math.abs(diffY) > 10) {
                isScrollingRef.current = true;
                setDragOffset(0);
            }
        }
    };

    const onTouchEnd = () => {
        setIsDragging(false);
        if (!touchStartRef.current) return;
        
        if (!isScrollingRef.current) {
            const threshold = 100;
            
            if (activeHomeTab === 'dashboard') {
                if (dragOffset < -threshold) {
                    setActiveHomeTab('calendar');
                }
            } else {
                if (dragOffset > threshold) {
                    setActiveHomeTab('dashboard');
                }
            }
        }
        
        setDragOffset(0);
        touchStartRef.current = null;
        isScrollingRef.current = false;
    };

    // Calculate transform
    // Dashboard is at 0%, Calendar is at -50% (since width is 200%)
    // We need to convert px dragOffset to percentage or use px in calc
    // Container width is 100vw (approx). 
    // Let's use px for the drag offset.
    // Base transform: Dashboard -> 0px, Calendar -> -50% (which is -100vw)
    
    const containerStyle = {
        transform: activeHomeTab === 'dashboard' 
            ? `translateX(${dragOffset}px)` 
            : `translateX(calc(-50% + ${dragOffset}px))`,
        transition: isDragging ? 'none' : 'transform 300ms cubic-bezier(0.2, 0.8, 0.2, 1)'
    };

    const { restOfCurrentMonthStats, nextMonthStats, burnRates } = useMemo(() => {
        const [tYear, tMonth, tDay] = todayInTimezone.split('-').map(Number);
        const currentMonthDate = new Date(tYear, tMonth - 1, 1);
        const nextMonthDate = new Date(tYear, tMonth, 1);
        
        // 1. Calculate Burn Rates for next 6 months
        const rates: Record<string, { rate: number, startDay: number, isProjected: boolean }> = {};
        for (let i = 0; i < 6; i++) {
            const d = new Date(tYear, tMonth - 1 + i, 1);
            const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
            const info = getCalendarBurnRate(d, todayInTimezone, budgetGroups, budgetOverrides, dashboardTransactions);
            rates[key] = info;
        }

        // 2. Simulate Current Month (Rest)
        const currentMonthKey = `${tYear}-${String(tMonth).padStart(2,'0')}`;
        const currentBurn = rates[currentMonthKey];
        const daysInCurrentMonth = new Date(tYear, tMonth, 0).getDate();
        
        // Initial Balance for Current Month Simulation
        // We start from currentOpeningBalance + transactions up to yesterday?
        // Actually, let's just replay the whole month to be safe and consistent.
        const startOfCurrentMonthStr = `${tYear}-${String(tMonth).padStart(2, '0')}-01`;
        const priorTxns = dashboardTransactions.filter(t => normalizeDate(t.transaction_date) < startOfCurrentMonthStr && t.status !== 'skipped');
        let runningBalance = currentOpeningBalance + priorTxns.reduce((acc, t) => acc + t.amount, 0);
        
        let currentMonthLowest = Infinity;
        let currentMonthLowDate = '';
        
        // Replay up to today to get current state, then project
        for (let d = 1; d <= daysInCurrentMonth; d++) {
            const dateStr = `${tYear}-${String(tMonth).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayTxns = dashboardTransactions.filter(t => normalizeDate(t.transaction_date) === dateStr && t.status !== 'skipped');
            runningBalance += dayTxns.reduce((acc, t) => acc + t.amount, 0);
            
            // Apply burn if applicable
            if (currentBurn.isProjected && d >= currentBurn.startDay) {
                // For simulation, we subtract the daily rate from the running balance
                // Note: This modifies runningBalance permanently for the simulation chain
                runningBalance -= currentBurn.rate;
            }
            
            // Only track stats for "Rest of Month" (from today onwards)
            if (d >= tDay) {
                if (runningBalance < currentMonthLowest) {
                    currentMonthLowest = runningBalance;
                    currentMonthLowDate = dateStr;
                }
            }
        }
        
        const endOfCurrentMonthBalance = runningBalance;
        
        // 3. Simulate Next Month
        const nextMonthKey = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth()+1).padStart(2,'0')}`;
        const nextBurn = rates[nextMonthKey];
        const daysInNextMonth = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
        
        let nextMonthRunning = endOfCurrentMonthBalance;
        let nextMonthLowest = Infinity;
        let nextMonthLowDate = '';
        
        for (let d = 1; d <= daysInNextMonth; d++) {
            const dateStr = `${nextMonthDate.getFullYear()}-${String(nextMonthDate.getMonth()+1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayTxns = dashboardTransactions.filter(t => normalizeDate(t.transaction_date) === dateStr && t.status !== 'skipped');
            nextMonthRunning += dayTxns.reduce((acc, t) => acc + t.amount, 0);
            
            if (nextBurn.isProjected) {
                nextMonthRunning -= nextBurn.rate;
            }
            
            if (nextMonthRunning < nextMonthLowest) {
                nextMonthLowest = nextMonthRunning;
                nextMonthLowDate = dateStr;
            }
        }

        const getStatus = (lowest: number) => {
            if (lowest < 0) return 'Critical';
            if (lowest < lowBalanceThreshold) return 'Caution';
            return 'Healthy';
        };

        return {
            restOfCurrentMonthStats: { 
                lowest: currentMonthLowest, 
                lowDateStr: currentMonthLowDate, 
                status: getStatus(currentMonthLowest), 
                monthName: getMonthName(tMonth - 1) 
            },
            nextMonthStats: { 
                lowest: nextMonthLowest, 
                lowDateStr: nextMonthLowDate, 
                status: getStatus(nextMonthLowest), 
                monthName: getMonthName(nextMonthDate.getMonth()) 
            },
            burnRates: rates
        };
    }, [dashboardTransactions, currentOpeningBalance, todayInTimezone, budgetGroups, budgetOverrides, lowBalanceThreshold]);

    const StatusIconComp = restOfCurrentMonthStats.status === 'Critical' ? ShieldAlert : restOfCurrentMonthStats.status === 'Caution' ? ShieldOff : ShieldCheck;

    // Helper for styling based on balance
    const getStylingForBalance = (bal: number) => {
        if (bal < 0) return { text: 'text-relief-critical', border: 'border-relief-critical/50', bg: 'bg-relief-critical/10' };
        if (bal < lowBalanceThreshold) return { text: 'text-relief-warning', border: 'border-relief-warning/50', bg: 'bg-relief-warning/10' };
        return { text: 'text-relief-primary', border: 'border-relief-primary/50', bg: 'bg-relief-primary/10' };
    };

    const displayedBalance = hoveredChartPoint 
        ? (showChartProjected && hoveredChartPoint.projectedBalance !== undefined ? hoveredChartPoint.projectedBalance : hoveredChartPoint.balance)
        : currentBalance;
    
    const displayedLabel = hoveredChartPoint 
        ? `Balance on ${new Date(hoveredChartPoint.dateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}` 
        : "Today's Balance";
    
    const currentBalanceStyle = getStylingForBalance(currentBalance);
    const balanceStyle = hoveredChartPoint 
        ? getStylingForBalance(displayedBalance) 
        : { text: currentBalanceStyle.text, border: 'border-white/5', bg: 'bg-[#0F172A]' };

    return (
        <div className="flex flex-col animate-page-enter">
            <div 
                className="flex-grow relative overflow-hidden z-30 touch-pan-y"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
            >
                <div 
                    className="flex w-[200%] h-full will-change-transform"
                    style={containerStyle}
                >
                    {/* DASHBOARD */}
                    <div className="w-1/2 px-4 pt-2 pb-10 space-y-4 transition-opacity duration-300 opacity-100">
                        <div className={`rounded-2xl border shadow-lg shadow-black/40 relative transition-colors duration-200 overflow-hidden ${balanceStyle.bg} ${balanceStyle.border}`}>
                            <div className="flex flex-col items-center justify-center mb-2 pt-6 relative px-4">
                                <button onClick={() => setShowChartProjected(!showChartProjected)} className={`absolute right-4 top-4 p-2 rounded-lg transition-all ${showChartProjected ? 'text-[#FF4D00]' : 'text-relief-text-secondary hover:text-white'}`}><Flame size={16} /></button>
                                <span className={`text-3xl font-bold tracking-tight transition-colors duration-200 ${balanceStyle.text}`}>${displayedBalance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                                <span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider mt-1">{displayedLabel}</span>
                            </div>
                            <BalanceChart 
                                transactions={dashboardTransactions} 
                                openingBalance={currentOpeningBalance} 
                                currentDate={new Date()} 
                                threshold={lowBalanceThreshold} 
                                todayStr={todayInTimezone} 
                                burnRates={burnRates}
                                showProjected={showChartProjected}
                                monthsToShow={chartMonthsToShow}
                                onPointHover={setHoveredChartPoint}
                            />
                            <div className="flex items-center justify-center gap-2 pb-4 pt-2">
                                <button onClick={() => setChartMonthsToShow(1)} className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors ${chartMonthsToShow === 1 ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>Current</button>
                                <button onClick={() => setChartMonthsToShow(3)} className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors ${chartMonthsToShow === 3 ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>3 Months</button>
                                <button onClick={() => setChartMonthsToShow(6)} className={`text-[10px] font-bold px-3 py-1.5 rounded-full transition-colors ${chartMonthsToShow === 6 ? 'bg-white/20 text-white' : 'bg-white/5 text-slate-400 hover:bg-white/10'}`}>6 Months</button>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className={`p-3 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden ${restOfCurrentMonthStats.status === 'Critical' ? 'border-relief-critical/20' : restOfCurrentMonthStats.status === 'Caution' ? 'border-relief-warning/20' : 'border-relief-primary/20'}`}>
                                <div className="relative z-10 flex flex-col items-center text-center">
                                    <div className="flex items-center gap-1.5 mb-1"><StatusIconComp className={`w-4 h-4 ${restOfCurrentMonthStats.status==='Critical'?'text-relief-critical':restOfCurrentMonthStats.status==='Caution'?'text-relief-warning':'text-relief-primary'}`} /><span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">Status</span></div>
                                    <span className={`text-lg font-bold ${restOfCurrentMonthStats.status==='Critical'?'text-relief-critical':restOfCurrentMonthStats.status==='Caution'?'text-relief-warning':'text-relief-primary'}`}>{restOfCurrentMonthStats.status}</span>
                                    <span className="text-[8px] text-slate-400 mt-1 leading-tight">Your lowest projected balance for the rest of this month is ${Math.round(restOfCurrentMonthStats.lowest)} on {restOfCurrentMonthStats.lowDateStr ? new Date(restOfCurrentMonthStats.lowDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'N/A'}.</span>
                                </div>
                            </div>
                            <button onClick={() => setShowCushionModal(true)} className="p-3 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl flex flex-col items-center justify-center relative text-center">
                                <Info className="w-3 h-3 text-slate-500 absolute top-2 right-2" />
                                <span className="text-[9px] font-bold uppercase text-relief-text-secondary mb-1">{nextMonthStats.monthName}'s Forecast</span>
                                <span className={`text-lg font-bold ${nextMonthStats.status==='Critical'?'text-relief-critical':nextMonthStats.status==='Caution'?'text-relief-warning':'text-relief-primary'}`}>{nextMonthStats.status}</span>
                                <span className="text-[8px] text-slate-400 mt-1 leading-tight">Your lowest projected balance next month is ${Math.round(nextMonthStats.lowest)} on {nextMonthStats.lowDateStr ? new Date(nextMonthStats.lowDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }) : 'N/A'}.</span>
                            </button>
                        </div>

                        <div className="p-4 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl relative">
                            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">Variable Expenses</span><button onClick={() => setShowSortModal(true)} className="p-1 rounded hover:bg-white/10 text-relief-text-secondary"><Settings size={14} /></button></div>
                            <div className="relative group">
                                {showLeftArrow && <button onClick={() => handleScroll('left')} className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-relief-surface border border-relief-border flex items-center justify-center text-white shadow-lg"><ChevronLeft size={16} /></button>}
                                <div 
                                    ref={scrollRef} 
                                    onScroll={checkScroll} 
                                    className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
                                    onTouchStart={(e) => e.stopPropagation()}
                                    onTouchMove={(e) => e.stopPropagation()}
                                    onTouchEnd={(e) => e.stopPropagation()}
                                >
                                    {visibleVariableExpenses.map(v => {
                                        const { emoji } = parseCategoryName(v.name);
                                        return (
                                        <div key={v.id} className="flex-shrink-0 w-[31%] p-3 rounded-xl bg-relief-bg border border-relief-border flex flex-col items-center gap-2">
                                            <CircularProgress percentActual={v.percentActual} remaining={v.remaining} emoji={emoji} />
                                            <div className="text-center w-full"><div className={`text-[10px] font-bold ${v.remaining < 0 ? 'text-relief-critical' : 'text-relief-text-secondary'}`}>${Math.round(v.remaining)} left</div></div>
                                        </div>
                                    )})}
                                </div>
                                {showRightArrow && <button onClick={() => handleScroll('right')} className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-8 h-8 rounded-full bg-relief-surface border border-relief-border flex items-center justify-center text-white shadow-lg"><ChevronRight size={16} /></button>}
                            </div>
                        </div>
                        
                        <div className="p-4 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl mt-4">
                            <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                    <Clock className="w-3 h-3 text-relief-primary" />
                                    <span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">Upcoming Activity</span>
                                </div>
                            </div>
                            <div className="space-y-2">
                                {dashboardTransactions
                                    .filter(t => t.status === 'expected' && normalizeDate(t.transaction_date) >= todayInTimezone)
                                    .sort((a, b) => normalizeDate(a.transaction_date).localeCompare(normalizeDate(b.transaction_date)))
                                    .slice(0, 5)
                                    .map(t => {
                                        const { emoji } = parseCategoryName(t.category || '');
                                        const isPastDue = t.status === 'expected' && normalizeDate(t.transaction_date) < todayInTimezone;
                                        const isExpected = t.status === 'expected';
                                        
                                        return (
                                        <div key={t.id} onClick={() => setEditingTxn(t)} className={`flex items-center justify-between p-3 rounded-xl bg-relief-bg border border-relief-border hover:bg-white/5 transition-colors cursor-pointer group ${isExpected && !isPastDue ? 'opacity-50' : ''}`}>
                                            <div className="overflow-hidden">
                                                <div className="text-xs font-bold text-relief-text-primary truncate group-hover:text-relief-primary transition-colors">
                                                    {emoji && <span className="mr-1.5">{emoji}</span>}
                                                    {t.name || t.merchant || 'Untitled'}
                                                </div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-[10px] text-relief-primary font-bold">{new Date(t.transaction_date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}</span>
                                                </div>
                                            </div>
                                            <div className={`text-xs font-bold whitespace-nowrap ${t.amount >= 0 ? 'text-relief-primary' : 'text-relief-text-secondary'}`}>
                                                {t.amount >= 0 ? '+' : ''}{Math.round(t.amount)}
                                            </div>
                                        </div>
                                    )})}
                            </div>
                        </div>
                    </div>

                    {/* CALENDAR */}
                    <CalendarView 
                        date={date}
                        transactions={transactions}
                        openingBalance={openingBalance}
                        lowBalanceThreshold={lowBalanceThreshold}
                        todayInTimezone={todayInTimezone}
                        showProjected={showProjected}
                        budgetGroups={budgetGroups}
                        budgetOverrides={budgetOverrides}
                        setViewDate={setViewDate}
                        setSelectedDateStr={setSelectedDateStr}
                        selectedDateStr={selectedDateStr}
                        setShowDatePicker={setShowDatePicker}
                        setShowAddTxnModal={setShowAddTxnModal}
                        setShowEditBalanceModal={setShowEditBalanceModal}
                        setShowWhatIfModal={setShowWhatIfModal}
                        setShowProjected={setShowProjected}
                        setEditingTxn={setEditingTxn}
                        isViewLoading={isViewLoading}
                    />
                </div>
            </div>

            <Modal isOpen={showDatePicker} onClose={() => setShowDatePicker(false)} title="Select Month">
                <div className="space-y-4">
                    <Button onClick={() => { setViewDate(new Date()); setShowDatePicker(false); }} className="bg-emerald-400/10 text-emerald-400" fullWidth>Jump to Today</Button>
                    <div className="flex items-center justify-between p-2 mb-4 rounded-xl bg-slate-900/50">
                        <button onClick={() => setPickerYear(y => y - 1)} className="p-2 text-slate-400 hover:text-white"><ChevronLeft /></button>
                        <span className="text-xl font-bold text-emerald-300">{pickerYear}</span>
                        <button onClick={() => setPickerYear(y => y + 1)} className="p-2 text-slate-400 hover:text-white"><ChevronRight /></button>
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                        {Array.from({ length: 12 }).map((_, i) => (
                            <button key={i} onClick={() => { setViewDate(new Date(pickerYear, i, 1)); setShowDatePicker(false); }} className={`py-3 rounded-lg text-xs font-bold uppercase ${date.getMonth() === i ? 'bg-emerald-400 text-emerald-950' : 'bg-white/5 text-slate-300 hover:bg-white/10'}`}>{getMonthName(i).substring(0, 3)}</button>
                        ))}
                    </div>
                    <div className="pt-4"><Button variant="secondary" onClick={() => setShowDatePicker(false)} fullWidth>Cancel</Button></div>
                </div>
            </Modal>

            <Modal isOpen={!!editingTxn} onClose={() => setEditingTxn(null)} title="Transaction Details">
                {editingTxn && <TransactionForm transaction={editingTxn} onSuccess={() => { setEditingTxn(null); triggerRefresh(); }} onCancel={() => setEditingTxn(null)} />}
            </Modal>
            <Modal isOpen={showAddTxnModal} onClose={() => setShowAddTxnModal(false)} title="New Transaction"><TransactionForm initialDate={selectedDateStr} onSuccess={() => { setShowAddTxnModal(false); triggerRefresh(); }} onCancel={() => setShowAddTxnModal(false)} /></Modal>
            <Modal isOpen={showWhatIfModal} onClose={() => setShowWhatIfModal(false)} title="What If?"><WhatIfForm initialDate={selectedDateStr} onSuccess={() => { setShowWhatIfModal(false); triggerRefresh(); }} onCancel={() => setShowWhatIfModal(false)} /></Modal>
            <Modal isOpen={showEditBalanceModal} onClose={() => setShowEditBalanceModal(false)} title="Set Balance"><EditBalanceForm date={selectedDateStr} onSuccess={() => { setShowEditBalanceModal(false); triggerRefresh(); }} onCancel={() => setShowEditBalanceModal(false)} /></Modal>
            
            <Modal isOpen={showCushionModal} onClose={() => setShowCushionModal(false)} title="Forecast Intelligence">
                <div className="space-y-6">
                    <div className={`p-4 border rounded-xl text-center ${cmStatus === 'Critical' ? 'bg-red-500/10 border-red-500/20' : cmStatus === 'Caution' ? 'bg-yellow-500/10 border-yellow-500/20' : 'bg-emerald-500/10 border-emerald-500/20'}`}>
                        <div className="flex flex-col items-center">
                            <StatusIconComp className={`w-8 h-8 mb-2 ${cmStatus==='Critical'?'text-red-400':cmStatus==='Caution'?'text-yellow-400':'text-emerald-400'}`} />
                            <div className={`text-2xl font-bold ${cmStatus==='Critical'?'text-red-400':cmStatus==='Caution'?'text-yellow-400':'text-emerald-400'}`}>{cmStatus}</div>
                            <p className="text-[10px] mt-1 max-w-[90%] mx-auto text-slate-300 opacity-80">
                                {cmStatus === 'Critical' ? `Your projected balance dips below zero in ${getMonthName(new Date(todayInTimezone).getUTCMonth())}.` : 
                                 cmStatus === 'Caution' ? `Your projected balance dips below your balance goal in ${getMonthName(new Date(todayInTimezone).getUTCMonth())}.` :
                                 `Your projected balance stays above your balance goal in ${getMonthName(new Date(todayInTimezone).getUTCMonth())}.`}
                            </p>
                        </div>
                    </div>
                    <Button variant="secondary" onClick={() => setShowCushionModal(false)} fullWidth>Close</Button>
                </div>
            </Modal>

            <Modal isOpen={showSortModal} onClose={() => setShowSortModal(false)} title="Dashboard Display">
                <div className="space-y-2">
                    <p className="text-xs text-slate-500 mb-4">Adjust the order or hide variable expenses from the dashboard.</p>
                    <div className="space-y-2 max-h-[60vh] overflow-y-auto pr-1">
                        {allVariableExpenses.map((cat, idx) => (
                            <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-white/5">
                                <div className="flex items-center gap-3">
                                     <button onClick={() => toggleCategoryVisibility(cat.id)} className={`p-1.5 rounded-lg transition-colors ${preferences.hidden_categories.includes(cat.id) ? 'bg-slate-700 text-slate-500' : 'bg-emerald-400/10 text-emerald-400'}`}>
                                        {preferences.hidden_categories.includes(cat.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <span className={`text-sm font-bold ${preferences.hidden_categories.includes(cat.id) ? 'text-slate-500 line-through decoration-slate-600' : 'text-white'}`}>{cat.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleSortUpdate(cat.id, 'up')} disabled={idx === 0} className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-emerald-500 hover:text-white disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => handleSortUpdate(cat.id, 'down')} disabled={idx === allVariableExpenses.length - 1} className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-emerald-500 hover:text-white disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="pt-4"><Button onClick={() => setShowSortModal(false)} fullWidth>Done</Button></div>
                </div>
            </Modal>
        </div>
    );
};
