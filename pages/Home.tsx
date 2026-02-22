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

// --- Types ---
interface ChartPoint {
    day: number;
    balance: number;
    projectedBalance?: number;
    isFuture: boolean;
    isToday: boolean;
}

// --- Helper Components ---

const BalanceChart = ({ 
    transactions, 
    openingBalance,
    currentDate, 
    threshold,
    todayStr,
    burnRateInfo,
    showProjected,
    onPointHover
}: { 
    transactions: Transaction[], 
    openingBalance: number,
    currentDate: Date, 
    threshold: number,
    todayStr: string,
    burnRateInfo: { rate: number, startDay: number, isProjected: boolean },
    showProjected: boolean,
    onPointHover: (point: ChartPoint | null) => void
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [width, setWidth] = useState(300);
    const height = 160; 
    const padding = { top: 30, right: 0, bottom: 20, left: 0 };

    const [activePoint, setActivePoint] = useState<ChartPoint | null>(null);

    useEffect(() => {
        if (containerRef.current) {
            setWidth(containerRef.current.clientWidth);
        }
    }, []);

    // Notify parent when active point changes
    useEffect(() => {
        onPointHover(activePoint);
    }, [activePoint, onPointHover]);

    const data = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth();
        
        const startOfMonthStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        const daysInMonth = new Date(year, month + 1, 0).getDate();

        const windowPriorBalance = transactions
            .filter(t => normalizeDate(t.transaction_date) < startOfMonthStr && t.status !== 'skipped')
            .reduce((acc, t) => acc + t.amount, 0);

        const initialBalance = openingBalance + windowPriorBalance;

        const points: ChartPoint[] = [];
        let currentBalance = initialBalance;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const dayTxns = transactions.filter(t => normalizeDate(t.transaction_date) === dateStr && t.status !== 'skipped');
            const dayTotal = dayTxns.reduce((acc, t) => acc + t.amount, 0);
            
            currentBalance += dayTotal;

            let projected = undefined;
            if (showProjected && burnRateInfo.isProjected && d >= burnRateInfo.startDay) {
                const daysIntoProjection = d - burnRateInfo.startDay + 1;
                const variableDrag = daysIntoProjection * burnRateInfo.rate;
                projected = currentBalance - variableDrag;
            }

            points.push({
                day: d,
                balance: currentBalance,
                projectedBalance: projected,
                isFuture: dateStr > todayStr,
                isToday: dateStr === todayStr
            });
        }
        return points;
    }, [transactions, openingBalance, currentDate, todayStr, showProjected, burnRateInfo]);

    if (data.length <= 1) return null;

    const todayPoint = data.find(d => d.isToday);

    const balances = data.map(d => d.balance);
    const projectedBalances = data.map(d => d.projectedBalance).filter(b => b !== undefined) as number[];
    const allValues = [...balances, ...projectedBalances, 0, threshold];

    const minBal = Math.min(...allValues); 
    const maxBal = Math.max(...allValues);
    const range = maxBal - minBal || 1; 
    const paddedMin = minBal - (range * 0.1);
    const paddedMax = maxBal + (range * 0.1);
    const activeRange = paddedMax - paddedMin;

    const mapX = (day: number) => {
        const maxDays = data.length; 
        return padding.left + ((day - 1) / (maxDays - 1)) * (width - padding.left - padding.right);
    };

    const mapY = (val: number) => {
        return height - padding.bottom - ((val - paddedMin) / activeRange) * (height - padding.top - padding.bottom);
    };

    const yZero = mapY(0);
    const yThreshold = mapY(threshold);

    const createPath = (points: ChartPoint[], key: 'balance' | 'projectedBalance') => {
        return points
            .filter(p => p[key] !== undefined)
            .map((p, i) => {
                const prefix = i === 0 ? 'M' : 'L';
                return `${prefix} ${mapX(p.day)} ${mapY(p[key] as number)}`;
            }).join(' ');
    };

    const futureIndex = data.findIndex(d => d.isFuture);
    let pastPoints = data;
    let futurePoints: ChartPoint[] = [];

    if (futureIndex !== -1) {
        pastPoints = data.slice(0, futureIndex + 1); 
        futurePoints = data.slice(futureIndex); 
    }

    const solidPath = createPath(pastPoints, 'balance');
    const dottedPath = futurePoints.length > 0 ? createPath(futurePoints, 'balance') : '';
    const projectedPath = showProjected ? createPath(data, 'projectedBalance') : '';

    const handleInteraction = (clientX: number) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = clientX - rect.left;
        const chartWidth = width - padding.left - padding.right;
        
        const maxDays = data.length;
        const rawDayIndex = ((x - padding.left) / chartWidth) * (maxDays - 1);
        const index = Math.max(0, Math.min(Math.round(rawDayIndex), maxDays - 1));
        
        setActivePoint(data[index]);
    };

    return (
        <div 
            ref={containerRef} 
            className="w-full relative touch-none" 
            style={{ height: `${height}px` }}
            onPointerMove={(e) => handleInteraction(e.clientX)}
            onPointerLeave={() => setActivePoint(null)}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchMove={(e) => {
                e.stopPropagation();
                handleInteraction(e.touches[0].clientX);
            }}
            onTouchEnd={(e) => {
                e.stopPropagation();
                setActivePoint(null);
            }}
        >
            <svg width={width} height={height} className="overflow-visible">
                <defs>
                    <linearGradient id="chartColorGradient" gradientUnits="userSpaceOnUse" x1="0" y1={height - padding.bottom} x2="0" y2={padding.top}>
                        <stop offset="0%" stopColor="#f87171" />
                        <stop offset="50%" stopColor="#fbbf24" />
                        <stop offset="100%" stopColor="#34d399" />
                    </linearGradient>
                </defs>

                <line x1={padding.left} y1={yZero} x2={width - padding.right} y2={yZero} stroke="#fff" strokeOpacity="0.1" strokeWidth="1" />
                <line x1={padding.left} y1={yThreshold} x2={width - padding.right} y2={yThreshold} stroke="#fbbf24" strokeOpacity="0.3" strokeDasharray="4 4" strokeWidth="1" />

                {projectedPath && (
                     <path d={projectedPath} fill="none" stroke="#FF4D00" strokeWidth="2" strokeOpacity="0.6" strokeDasharray="2 2" />
                )}

                <path d={solidPath} fill="none" stroke="#2E93FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                {dottedPath && <path d={dottedPath} fill="none" stroke="#2E93FA" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="3 3" strokeOpacity="0.5" />}

                {/* Today Circle */}
                {todayPoint && (
                    <g>
                        <circle 
                            cx={mapX(todayPoint.day)} 
                            cy={mapY(todayPoint.balance)} 
                            r="8" 
                            fill="#fff"
                            opacity="0.2"
                        >
                            <animate attributeName="r" values="6;12;6" dur="3s" repeatCount="indefinite" />
                            <animate attributeName="opacity" values="0.6;0;0.6" dur="3s" repeatCount="indefinite" />
                        </circle>
                        <circle 
                            cx={mapX(todayPoint.day)} 
                            cy={mapY(todayPoint.balance)} 
                            r="5" 
                            fill="#0F172A" 
                            stroke="#fff" 
                            strokeWidth="2" 
                        />
                    </g>
                )}

                {activePoint && (
                    <g>
                        <line x1={mapX(activePoint.day)} y1={padding.top} x2={mapX(activePoint.day)} y2={height - padding.bottom} stroke="#cbd5e1" strokeWidth="1" strokeOpacity="0.5" />
                        <circle cx={mapX(activePoint.day)} cy={mapY(activePoint.balance)} r="4" fill="#34d399" stroke="#0f172a" strokeWidth="2" />
                    </g>
                )}
            </svg>
        </div>
    );
};

const CircularProgress = ({ percentActual, remaining }: { percentActual: number, remaining: number }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeActual = ((Math.min(percentActual, 100)) / 100) * circumference;
    return (
        <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 40 40">
                <circle className="text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r={radius} cx="20" cy="20" />
                <circle className={remaining < 0 ? "text-red-500" : "text-emerald-400"} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={circumference - strokeActual} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="20" cy="20" />
            </svg>
            <div className="absolute text-[9px] font-bold text-white">{Math.round(percentActual)}%</div>
        </div>
    );
};

export const Home: React.FC = () => {
    const navigate = useNavigate();
    const { 
        selectedDate: selectedDateStr, 
        setSelectedDate: setSelectedDateStr, 
        triggerRefresh, 
        allTransactions,
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

    const handleSortUpdate = (catId: string, direction: 'up' | 'down') => {
        const allVarIds = visibleVariableExpenses.map(v => v.id); 
        let currentOrder = preferences.dashboard_order || [];
        const currentIndex = currentOrder.indexOf(catId);
        if (currentIndex === -1) {
             currentOrder = [...currentOrder, catId];
        }
        const newOrder = [...currentOrder];
        updatePreferences({ ...preferences, dashboard_order: newOrder });
    };

    const getPlannedAmount = (cat: BudgetCategory, monthKey: string) => {
        const override = budgetOverrides.find(o => o.category_id === cat.id && o.month === monthKey);
        return override ? override.amount : cat.planned_amount;
    };

    const getCalendarBurnRate = (viewDate: Date) => {
        const today = new Date(todayInTimezone);
        if (viewDate.getFullYear() < today.getFullYear() || (viewDate.getFullYear() === today.getFullYear() && viewDate.getMonth() < today.getMonth())) return { rate: 0, startDay: 0, isProjected: false };
        const monthKey = `${viewDate.getFullYear()}-${String(viewDate.getMonth() + 1).padStart(2, '0')}`;
        const daysInMonth = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 0).getDate();
        let totalVarPlanned = 0;
        budgetGroups.forEach(g => { if (g.type === 'expense' || g.type === 'goal') g.categories.filter(c => !c.is_fixed).forEach(c => totalVarPlanned += getPlannedAmount(c, monthKey)); });
        const todayDate = today.getDate();
        return { rate: totalVarPlanned / daysInMonth, startDay: todayDate, isProjected: true };
    };

    const calculateCumulativeOffset = (targetDate: Date) => {
        return 0; 
    };

    const renderCalendar = () => {
        const days = [];
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
        
        const { rate: burnRate, startDay: burnStartDay, isProjected: canProject } = getCalendarBurnRate(date);
        
        const startOfMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        const offset = transactions.filter(t => normalizeDate(t.transaction_date) < startOfMonthStr && t.status !== 'skipped').reduce((a,x)=>a+x.amount, 0) + openingBalance;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const activeTxns = transactions.filter(t => normalizeDate(t.transaction_date) === dateStr && t.status !== 'skipped');
            const dayTotal = activeTxns.reduce((acc, t) => acc + t.amount, 0);
            
            const runningBal = offset + transactions.filter(t => normalizeDate(t.transaction_date) >= startOfMonthStr && normalizeDate(t.transaction_date) <= dateStr && t.status !== 'skipped').reduce((a,x)=>a+x.amount, 0);
            
            let finalBalance = runningBal;
            if (showProjected && canProject && d >= burnStartDay) {
                finalBalance -= (d - burnStartDay + 1) * burnRate;
            }

            const isToday = todayInTimezone === dateStr;
            const isNegative = finalBalance < 0;
            const isLow = !isNegative && finalBalance < lowBalanceThreshold;

            days.push(
                <div key={d} onClick={() => setSelectedDateStr(dateStr)} className={`relative h-14 rounded-lg border p-1 flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${isNegative ? "bg-red-500/20 border-red-500/30" : isLow ? "bg-yellow-500/10 border-yellow-500/20" : "bg-slate-800/30 border-white/5"} ${selectedDateStr === dateStr ? "ring-1 ring-white" : ""} ${isToday ? "border-emerald-400 border-2" : ""}`}>
                    <span className={`text-[9px] font-bold ${isToday ? 'text-emerald-300' : 'text-slate-400'}`}>{d}</span>
                    <div className="flex justify-center -mt-1">{activeTxns.length > 0 && <span className={`text-[9px] font-bold ${dayTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(dayTotal)}</span>}</div>
                    <span className="text-[9px] font-bold text-center opacity-80">${Math.round(finalBalance)}</span>
                </div>
            );
        }
        return days;
    };

    const visibleVariableExpenses = useMemo(() => {
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const startStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        const endStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()}`;
        
        let vars: any[] = [];
        budgetGroups.forEach(g => {
            if (g.type === 'expense' || g.type === 'goal') {
                g.categories.filter(c => !c.is_fixed).forEach(c => {
                    const planned = getPlannedAmount(c, monthKey);
                    const actual = transactions.filter(t => t.category === c.name && normalizeDate(t.transaction_date) >= startStr && normalizeDate(t.transaction_date) <= endStr && (t.amount < 0 || g.type === 'goal') && t.status !== 'skipped').reduce((a, t) => a + Math.abs(t.amount), 0);
                    vars.push({ id: c.id, name: c.name, planned, remaining: planned - actual, percentActual: planned > 0 ? (actual/planned)*100 : 0 });
                });
            }
        });
        if (preferences.dashboard_order?.length) vars.sort((a,b) => (preferences.dashboard_order.indexOf(a.id) === -1 ? 999 : preferences.dashboard_order.indexOf(a.id)) - (preferences.dashboard_order.indexOf(b.id) === -1 ? 999 : preferences.dashboard_order.indexOf(b.id)));
        return vars.filter(v => !preferences.hidden_categories.includes(v.id));
    }, [budgetGroups, transactions, date, budgetOverrides, preferences]);

    const handleScroll = (dir: 'left' | 'right') => scrollRef.current?.scrollBy({ left: dir === 'left' ? -200 : 200, behavior: 'smooth' });
    const checkScroll = () => { if (scrollRef.current) { const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current; setShowLeftArrow(scrollLeft > 0); setShowRightArrow(scrollLeft < scrollWidth - clientWidth - 5); } };
    useEffect(() => { checkScroll(); window.addEventListener('resize', checkScroll); return () => window.removeEventListener('resize', checkScroll); }, [visibleVariableExpenses]);

    const cmStatus = currentMonthStats?.status || 'Healthy';
    const StatusIconComp = cmStatus === 'Critical' ? ShieldAlert : cmStatus === 'Caution' ? ShieldOff : ShieldCheck;

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
        ? `Balance on ${getMonthName(new Date().getMonth()).substring(0,3)} ${hoveredChartPoint.day}` 
        : "Today's Balance";
    
    const balanceStyle = hoveredChartPoint ? getStylingForBalance(displayedBalance) : { text: 'text-white', border: 'border-white/5', bg: 'bg-[#0F172A]' };

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
                                transactions={transactions} 
                                openingBalance={openingBalance} 
                                currentDate={new Date()} 
                                threshold={lowBalanceThreshold} 
                                todayStr={todayInTimezone} 
                                burnRateInfo={getCalendarBurnRate(new Date())} 
                                showProjected={showChartProjected}
                                onPointHover={setHoveredChartPoint}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className={`p-3 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl flex flex-col items-center justify-center relative overflow-hidden ${cmStatus === 'Critical' ? 'border-relief-critical/20' : cmStatus === 'Caution' ? 'border-relief-warning/20' : 'border-relief-primary/20'}`}>
                                <div className="relative z-10 flex flex-col items-center">
                                    <div className="flex items-center gap-1.5 mb-1"><StatusIconComp className={`w-4 h-4 ${cmStatus==='Critical'?'text-relief-critical':cmStatus==='Caution'?'text-relief-warning':'text-relief-primary'}`} /><span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">Status</span></div>
                                    <span className={`text-lg font-bold ${cmStatus==='Critical'?'text-relief-critical':cmStatus==='Caution'?'text-relief-warning':'text-relief-primary'}`}>{cmStatus}</span>
                                </div>
                            </div>
                            <button onClick={() => setShowCushionModal(true)} className="p-3 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl flex flex-col items-center justify-center">
                                <span className="text-[9px] font-bold uppercase text-relief-text-secondary mb-1">Forecast</span>
                                <span className="text-lg font-bold text-relief-text-primary italic">View Details</span>
                            </button>
                        </div>

                        <div className="p-4 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl relative">
                            <div className="flex items-center justify-between mb-3"><span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">Expenses</span><button onClick={() => setShowSortModal(true)} className="p-1 rounded hover:bg-white/10 text-relief-text-secondary"><Settings size={14} /></button></div>
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
                                    {visibleVariableExpenses.map(v => (
                                        <div key={v.id} className="flex-shrink-0 w-[31%] p-3 rounded-xl bg-relief-bg border border-relief-border flex flex-col items-center gap-2">
                                            <CircularProgress percentActual={v.percentActual} remaining={v.remaining} />
                                            <div className="text-center w-full"><div className="text-[10px] font-bold text-relief-text-primary truncate">{v.name}</div><div className={`text-[10px] font-bold ${v.remaining < 0 ? 'text-relief-critical' : 'text-relief-text-secondary'}`}>${Math.round(v.remaining)}</div></div>
                                        </div>
                                    ))}
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
                                {transactions
                                    .filter(t => t.status === 'expected' && normalizeDate(t.transaction_date) >= todayInTimezone)
                                    .sort((a, b) => normalizeDate(a.transaction_date).localeCompare(normalizeDate(b.transaction_date)))
                                    .slice(0, 5)
                                    .map(t => {
                                        const { emoji } = parseCategoryName(t.category || '');
                                        return (
                                        <div key={t.id} onClick={() => setEditingTxn(t)} className="flex items-center justify-between p-3 rounded-xl bg-relief-bg border border-relief-border hover:bg-white/5 transition-colors cursor-pointer group">
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
                    <div className="w-1/2 px-4 pt-2 pb-10 space-y-4 transition-opacity duration-300 opacity-100">
                        <div className="p-3 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl">
                            <div className="flex items-center justify-between mb-4">
                                <button onClick={() => setViewDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="p-2 border rounded-xl bg-relief-bg border-relief-border hover:text-white text-relief-text-secondary"><ChevronLeft size={16} /></button>
                                <button onClick={() => setShowDatePicker(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold border rounded-xl bg-relief-bg border-relief-border hover:bg-white/5 text-relief-text-primary"><CalendarIcon size={14} className="text-relief-primary" />{getMonthName(date.getMonth())} {date.getFullYear()}</button>
                                <button onClick={() => setViewDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="p-2 border rounded-xl bg-relief-bg border-relief-border hover:text-white text-relief-text-secondary"><ChevronRight size={16} /></button>
                            </div>
                            <div className="grid grid-cols-7 gap-1 mb-2 text-center">{['S','M','T','W','T','F','S'].map((d, i) => (<div key={i} className="text-[9px] font-bold text-relief-text-secondary uppercase">{d}</div>))}</div>
                            <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
                            <div className="flex justify-between items-center px-4 mt-6">
                                <button onClick={() => setShowAddTxnModal(true)} className="w-12 h-12 rounded-full bg-relief-surface border border-relief-primary/50 flex items-center justify-center text-relief-primary shadow-lg active:scale-95 transition-transform"><Plus size={24} /></button>
                                <button onClick={() => setShowEditBalanceModal(true)} className="w-12 h-12 rounded-full bg-relief-surface border border-relief-action/50 flex items-center justify-center text-relief-action active:scale-95 transition-transform"><Edit3 size={20} /></button>
                                <button onClick={() => setShowWhatIfModal(true)} className="w-12 h-12 rounded-full bg-relief-surface border border-relief-magic/50 flex items-center justify-center text-relief-magic active:scale-95 transition-transform"><Sparkles size={20} /></button>
                                <button onClick={() => setShowProjected(!showProjected)} className={`w-12 h-12 rounded-full flex items-center justify-center border transition-all active:scale-95 ${showProjected ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-lg' : 'bg-relief-surface border-relief-border text-relief-text-secondary'}`}><Flame size={20} /></button>
                            </div>
                        </div>

                        {/* Activity on Selected Date */}
                        <div className="p-4 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl">
                            <div className="flex items-center gap-2 mb-3">
                                <Clock className="w-3 h-3 text-relief-primary" />
                                <span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">
                                    Activity on {new Date(selectedDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                                </span>
                            </div>
                            <div className="space-y-2">
                                {transactions
                                    .filter(t => normalizeDate(t.transaction_date) === selectedDateStr && t.status !== 'skipped')
                                    .length > 0 ? (
                                        transactions
                                            .filter(t => normalizeDate(t.transaction_date) === selectedDateStr && t.status !== 'skipped')
                                            .map(t => (
                                                <div key={t.id} onClick={() => setEditingTxn(t)} className="flex items-center justify-between p-3 rounded-xl bg-relief-bg border border-relief-border hover:bg-white/5 transition-colors cursor-pointer group">
                                                    <div className="overflow-hidden">
                                                        <div className="text-xs font-bold text-relief-text-primary truncate group-hover:text-relief-primary transition-colors">{t.name || t.merchant || 'Untitled'}</div>
                                                        <div className="flex items-center gap-2 mt-0.5">
                                                        </div>
                                                    </div>
                                                    <div className={`text-xs font-bold whitespace-nowrap ${t.amount >= 0 ? 'text-relief-primary' : 'text-relief-text-secondary'}`}>
                                                        {t.amount >= 0 ? '+' : ''}{Math.round(t.amount)}
                                                    </div>
                                                </div>
                                            ))
                                    ) : (
                                        <div className="text-center py-4 text-xs text-relief-text-secondary italic">No activity on this date.</div>
                                    )
                                }
                            </div>
                        </div>
                    </div>
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
                                {cmStatus === 'Critical' ? `Your projected balance dips below zero in ${getMonthName(date.getMonth())}.` : 
                                 cmStatus === 'Caution' ? `Your projected balance dips below your balance goal in ${getMonthName(date.getMonth())}.` :
                                 `Your projected balance stays above your balance goal in ${getMonthName(date.getMonth())}.`}
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
                        {visibleVariableExpenses.map((cat, idx) => (
                            <div key={cat.id} className="flex items-center justify-between p-3 rounded-xl bg-slate-800 border border-white/5">
                                <div className="flex items-center gap-3">
                                     <button onClick={() => toggleCategoryVisibility(cat.id)} className={`p-1.5 rounded-lg transition-colors ${preferences.hidden_categories.includes(cat.id) ? 'bg-slate-700 text-slate-500' : 'bg-emerald-400/10 text-emerald-400'}`}>
                                        {preferences.hidden_categories.includes(cat.id) ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                    </button>
                                    <span className={`text-sm font-bold ${preferences.hidden_categories.includes(cat.id) ? 'text-slate-500 line-through decoration-slate-600' : 'text-white'}`}>{cat.name}</span>
                                </div>
                                <div className="flex gap-2">
                                    <button onClick={() => handleSortUpdate(cat.id, 'up')} disabled={idx === 0} className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-emerald-500 hover:text-white disabled:opacity-20"><ArrowUp className="w-4 h-4" /></button>
                                    <button onClick={() => handleSortUpdate(cat.id, 'down')} disabled={idx === visibleVariableExpenses.length - 1} className="p-1 rounded bg-slate-700 text-slate-300 hover:bg-emerald-500 hover:text-white disabled:opacity-20"><ArrowDown className="w-4 h-4" /></button>
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