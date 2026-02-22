import React, { useEffect, useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { Transaction, BudgetCategory } from '../types';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Settings } from 'lucide-react';
import { getMonthName, normalizeDate } from '../utils/dateUtils';
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
        isViewLoading
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
        return override ? override.amount : cat.planned_amount;
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
            window.location.reload(); // Simplest way to ensure global context gets new overrides for now without adding more context logic.
        } catch (error) {
            console.error(error);
            alert("Failed to save budget.");
        }
    };

    const calculateCategoryActual = (categoryName: string, type: string, txns = visibleTransactions) => {
        return txns
            .filter(t => 
                t.category === categoryName && 
                t.type === type && 
                (t.status === 'cleared' || t.status === 'pending')
            )
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    };
    
    const calculateCategoryExpected = (categoryName: string, type: string, txns = visibleTransactions) => {
        return txns
            .filter(t => 
                t.category === categoryName && 
                t.type === type && 
                t.status === 'expected'
            )
            .reduce((acc, t) => acc + Math.abs(t.amount), 0);
    };

    // --- Left to Budget Calculation ---
    const getBudgetBreakdown = () => {
        let totalIncome = 0;
        let totalExpense = 0;
        let totalGoals = 0;

        groups.forEach(g => {
            g.categories.forEach(c => {
                const planned = getPlannedAmount(c);
                if (g.type === 'income') totalIncome += planned;
                else if (g.type === 'expense') totalExpense += planned;
                else if (g.type === 'goal') totalGoals += planned;
            });
        });

        return {
            income: totalIncome,
            expense: totalExpense,
            goals: totalGoals,
            left: totalIncome - totalExpense - totalGoals
        };
    };

    const { left: leftToBudget, income: totalIncome, expense: totalExpense, goals: totalGoals } = getBudgetBreakdown();
    
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
        
        const averageSpent = totalSixMonths / 6;

        return {
            categoryName: cat.name,
            currentAmount: planned,
            actualSpentThisMonth: actualThisMonth, // Pass actual for dynamic calculation
            remaining,
            spentLastMonth,
            averageSpent: Math.round(averageSpent),
            history
        };
    };

    const modalProps = getModalProps();

    return (
        <div className="space-y-4 pt-4 px-4 animate-page-enter pb-24">
            <header className="px-2 flex justify-between items-end">
                <div>
                    <h1 className="text-2xl font-bold italic text-emerald-300">Budget</h1>
                    <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Planned vs Actual</p>
                </div>
                {/* Settings Button */}
                <button onClick={() => navigate('/settings/budget')} className="p-2 rounded-xl bg-slate-800 border border-white/10 text-slate-400 hover:text-white transition-colors">
                    <Settings className="w-5 h-5" />
                </button>
            </header>

            {/* Month Switcher Bar */}
            <div className="flex items-center justify-between px-2 py-2">
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

            {/* Left to Budget Header */}
            <div className="px-2">
                <button 
                    onClick={() => setShowBudgetBreakdown(true)}
                    className={`w-full p-4 rounded-2xl border flex flex-col items-center justify-center gap-1 shadow-lg shadow-black/40 transition-all active:scale-95 bg-[#0F172A] ${leftToBudget >= 0 ? 'border-relief-primary/50' : 'border-relief-critical/50'}`}
                >
                    <span className={`text-[10px] font-bold uppercase tracking-wider ${leftToBudget >= 0 ? 'text-relief-primary' : 'text-relief-critical'}`}>Left to Budget</span>
                    <span className={`text-xl font-bold ${leftToBudget >= 0 ? 'text-relief-primary' : 'text-relief-critical'}`}>
                        {leftToBudget < 0 ? '-' : ''}${Math.abs(leftToBudget).toLocaleString()}
                    </span>
                </button>
            </div>

            <div className={`space-y-6 px-2 transition-opacity duration-200 ${isViewLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {['income', 'expense', 'goal'].map(type => {
                    const typeGroups = groups.filter(g => g.type === type);
                    // Header colors based on type
                    const headerColor = type === 'income' ? 'text-emerald-400' : type === 'goal' ? 'text-blue-400' : 'text-slate-400';
                    
                    return (
                        <div key={type} className="space-y-3">
                            {/* Header Row */}
                            <div className="flex items-center px-3 mb-2 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                                <div className="w-[35%]">
                                    <h3 className={headerColor}>
                                        {type === 'goal' ? 'Goals' : type}
                                    </h3>
                                </div>
                                <div className="w-[20%] text-right pr-1">Budget</div>
                                <div className="w-[20%] text-right pr-1">Exp.</div>
                                <div 
                                    className="w-[25%] text-right cursor-pointer hover:text-white transition-colors select-none"
                                    onClick={() => setDisplayMode(prev => prev === 'actual' ? 'remaining' : 'actual')}
                                >
                                    <span className="border-b border-dashed border-slate-600 hover:border-white pb-0.5">
                                        {displayMode === 'actual' ? 'Actual' : 'Left'}
                                    </span>
                                </div>
                            </div>
                            
                            {typeGroups.length === 0 && <div className="p-4 border border-dashed border-white/10 rounded-xl text-center text-[10px] text-slate-500 italic">No {type === 'goal' ? 'Goals' : type} Groups</div>}
                            
                            {typeGroups.map(group => {
                                // Calculate Group Totals
                                const groupPlanned = group.categories.reduce((sum, cat) => sum + getPlannedAmount(cat), 0);
                                const groupActual = group.categories.reduce((sum, cat) => sum + calculateCategoryActual(cat.name, type), 0);
                                const groupExpected = group.categories.reduce((sum, cat) => sum + calculateCategoryExpected(cat.name, type), 0);
                                const groupRemaining = groupPlanned - groupActual - groupExpected;
                                
                                const groupDisplayValue = displayMode === 'actual' ? groupActual : groupRemaining;

                                return (
                                    <div key={group.id} className="rounded-2xl border border-white/5 bg-[#0F172A] shadow-lg shadow-black/40 overflow-hidden">
                                        <div className="p-3 bg-relief-surface border-b border-relief-border flex items-center">
                                            <div className="w-[35%] font-bold text-sm text-relief-text-primary truncate pr-2">{group.name}</div>
                                            <div className="w-[20%] text-right px-1 text-xs font-bold text-relief-text-secondary">${groupPlanned.toFixed(0)}</div>
                                            <div className="w-[20%] text-right px-1 text-xs font-bold text-relief-text-secondary">${groupExpected.toFixed(0)}</div>
                                            <div className={`w-[25%] text-right pl-1 text-xs font-bold ${displayMode === 'remaining' && groupRemaining < 0 && type === 'expense' ? 'text-relief-critical' : 'text-relief-text-secondary'}`}>
                                                ${groupDisplayValue.toFixed(0)}
                                            </div>
                                        </div>
                                        <div>
                                            {group.categories.map(cat => {
                                                const actual = calculateCategoryActual(cat.name, type);
                                                const expected = calculateCategoryExpected(cat.name, type);
                                                const planned = getPlannedAmount(cat);
                                                const remaining = planned - actual - expected;
                                                
                                                const percentActual = planned > 0 ? Math.min((actual / planned) * 100, 100) : 0;
                                                const percentTotal = planned > 0 ? Math.min(((actual + expected) / planned) * 100, 100) : 0;
                                                
                                                // Progress bar color logic
                                                let barColor = 'bg-slate-600';
                                                if (type === 'expense') {
                                                    if (actual > planned) barColor = 'bg-relief-critical';
                                                    else barColor = 'bg-relief-primary';
                                                } else {
                                                    if (actual >= planned) barColor = 'bg-relief-primary';
                                                    else barColor = 'bg-relief-warning';
                                                }

                                                const expectedColor = 'bg-slate-500';
                                                const displayValue = displayMode === 'actual' ? actual : remaining;

                                                return (
                                                    <div key={cat.id} className="relative p-3 border-b border-relief-border last:border-0 group hover:bg-white/5">
                                                        <div className="flex items-center relative z-10">
                                                            <div className="w-[35%] min-w-0 pr-2">
                                                                <div className="text-xs text-relief-text-primary font-medium truncate">{cat.name}</div>
                                                                <div className="text-[9px] text-relief-text-secondary mt-0.5">{cat.is_fixed ? 'FIXED' : 'VARIABLE'}</div>
                                                            </div>
                                                            <div className="w-[20%] px-1 text-right">
                                                                <button 
                                                                    onClick={() => setEditingCatId(cat.id)}
                                                                    className="w-full text-right bg-relief-primary/10 hover:bg-relief-primary/20 text-xs font-bold text-relief-primary rounded px-1 py-1 transition-colors"
                                                                >
                                                                    ${planned.toLocaleString()}
                                                                </button>
                                                            </div>
                                                            <div className="w-[20%] px-1 text-right">
                                                                    <span className="text-xs font-bold text-relief-text-secondary">${expected.toFixed(0)}</span>
                                                            </div>
                                                            <div className="w-[25%] pl-1 text-right">
                                                                <span className={`text-xs font-bold ${displayMode === 'remaining' && remaining < 0 && type === 'expense' ? 'text-relief-critical' : 'text-relief-text-secondary'}`}>
                                                                    ${displayValue.toFixed(0)}
                                                                </span>
                                                            </div>
                                                        </div>
                                                        <div className="absolute bottom-0 left-0 right-0 h-1 bg-relief-bg">
                                                            <div 
                                                                className={`absolute top-0 left-0 h-full transition-all duration-500 ${expectedColor}`} 
                                                                style={{ width: `${percentTotal}%` }}
                                                            />
                                                            <div 
                                                                className={`absolute top-0 left-0 h-full transition-all duration-500 ${barColor}`} 
                                                                style={{ width: `${percentActual}%` }}
                                                            />
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )
                })}
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