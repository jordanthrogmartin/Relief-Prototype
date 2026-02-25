import React from 'react';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Plus, Edit3, Sparkles, Flame, Clock } from 'lucide-react';
import { Transaction, BudgetGroup, BudgetMonth } from '../types';
import { getMonthName, normalizeDate } from '../utils/dateUtils';
import { getCalendarBurnRate } from '../utils/budgetUtils';
import { parseCategoryName } from '../utils/emojiUtils';

interface CalendarViewProps {
    date: Date;
    transactions: Transaction[];
    openingBalance: number;
    lowBalanceThreshold: number;
    todayInTimezone: string;
    showProjected: boolean;
    budgetGroups: BudgetGroup[];
    budgetOverrides: BudgetMonth[];
    setViewDate: (date: Date) => void;
    setSelectedDateStr: (dateStr: string) => void;
    selectedDateStr: string;
    setShowDatePicker: (show: boolean) => void;
    setShowAddTxnModal: (show: boolean) => void;
    setShowEditBalanceModal: (show: boolean) => void;
    setShowWhatIfModal: (show: boolean) => void;
    setShowProjected: (show: boolean) => void;
    setEditingTxn: (txn: Transaction) => void;
    isViewLoading?: boolean;
}

export const CalendarView: React.FC<CalendarViewProps> = ({
    date,
    transactions,
    openingBalance,
    lowBalanceThreshold,
    todayInTimezone,
    showProjected,
    budgetGroups,
    budgetOverrides,
    setViewDate,
    setSelectedDateStr,
    selectedDateStr,
    setShowDatePicker,
    setShowAddTxnModal,
    setShowEditBalanceModal,
    setShowWhatIfModal,
    setShowProjected,
    setEditingTxn,
    isViewLoading = false
}) => {
    const renderCalendar = () => {
        const days = [];
        const firstDay = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
        const daysInMonth = new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
        for (let i = 0; i < firstDay; i++) days.push(<div key={`empty-${i}`} />);
        
        const { rate: burnRate, startDay: burnStartDay, isProjected: canProject } = getCalendarBurnRate(date, todayInTimezone, budgetGroups, budgetOverrides, transactions);
        
        const startOfMonthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-01`;
        const offset = transactions.filter(t => normalizeDate(t.transaction_date) < startOfMonthStr && t.status !== 'skipped').reduce((a,x)=>a+x.amount, 0) + openingBalance;

        for (let d = 1; d <= daysInMonth; d++) {
            const dateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
            const allDayTxns = transactions.filter(t => normalizeDate(t.transaction_date) === dateStr);
            const activeTxns = allDayTxns.filter(t => t.status !== 'skipped');
            const dayTotal = activeTxns.reduce((acc, t) => acc + t.amount, 0);
            
            const runningBal = offset + transactions.filter(t => normalizeDate(t.transaction_date) >= startOfMonthStr && normalizeDate(t.transaction_date) <= dateStr && t.status !== 'skipped').reduce((a,x)=>a+x.amount, 0);
            
            let finalBalance = runningBal;
            if (showProjected && canProject && d >= burnStartDay) {
                finalBalance -= (d - burnStartDay + 1) * burnRate;
            }

            const isToday = todayInTimezone === dateStr;
            const isNegative = finalBalance < 0;
            const isLow = !isNegative && finalBalance < lowBalanceThreshold;
            const isSelected = selectedDateStr === dateStr;

            // Indicators
            const hasActivity = activeTxns.length > 0;
            const hasPastDue = allDayTxns.some(t => t.status === 'expected' && dateStr < todayInTimezone);
            const hasSkipped = allDayTxns.some(t => t.status === 'skipped');
            const hasGhost = allDayTxns.some(t => t.is_ghost);

            let borderClass = "border-white/5";
            let bgClass = "bg-slate-800/30";

            if (isNegative) {
                bgClass = "bg-red-500/20";
                borderClass = "border-red-500/30";
            } else if (isLow) {
                bgClass = "bg-yellow-500/10";
                borderClass = "border-yellow-500/20";
            }

            if (isToday) {
                borderClass = "border-emerald-400 border-2";
            }

            const dimClass = !hasActivity && !isToday ? "opacity-50" : "";

            days.push(
                <div key={d} onClick={() => setSelectedDateStr(dateStr)} className={`relative h-[52px] rounded-lg border p-1 flex flex-col justify-between cursor-pointer transition-all active:scale-95 ${bgClass} ${borderClass} ${isSelected && !isToday ? "ring-1 ring-white" : ""} ${dimClass}`}>
                    <div className="flex justify-between items-start w-full">
                        <span className={`text-[9px] font-bold ${isToday ? 'text-emerald-300' : 'text-slate-400'}`}>{d}</span>
                        <div className="flex items-center gap-0.5">
                            {hasGhost && <div className="w-1.5 h-1.5 rounded-full bg-purple-500 animate-pulse" />}
                            {hasSkipped && (
                                <div className="relative w-1.5 h-1.5 rounded-full border border-slate-500">
                                    <div className="absolute top-1/2 left-1/2 w-full h-[1px] bg-red-500 -translate-x-1/2 -translate-y-1/2 rotate-45" />
                                </div>
                            )}
                            {hasPastDue && <div className="w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse" />}
                        </div>
                    </div>
                    <div className="flex justify-center -mt-2">{activeTxns.length > 0 && <span className={`text-[9px] font-bold ${dayTotal >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{Math.round(dayTotal)}</span>}</div>
                    <span className="text-[9px] font-bold text-center opacity-80">${Math.round(finalBalance)}</span>
                </div>
            );
        }
        return days;
    };

    return (
        <div className="w-1/2 px-4 pt-2 pb-10 space-y-4">
            <div className="p-3 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl relative min-h-[400px]">
                <div className={`flex items-center justify-between mb-4 transition-opacity duration-200 ${isViewLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <button onClick={() => setViewDate(new Date(date.getFullYear(), date.getMonth() - 1, 1))} className="p-2 border rounded-xl bg-relief-bg border-relief-border hover:text-white text-relief-text-secondary"><ChevronLeft size={16} /></button>
                    <button onClick={() => setShowDatePicker(true)} className="flex items-center gap-2 px-4 py-2 text-sm font-bold border rounded-xl bg-relief-bg border-relief-border hover:bg-white/5 text-relief-text-primary"><CalendarIcon size={14} className="text-relief-primary" />{getMonthName(date.getMonth())} {date.getFullYear()}</button>
                    <button onClick={() => setViewDate(new Date(date.getFullYear(), date.getMonth() + 1, 1))} className="p-2 border rounded-xl bg-relief-bg border-relief-border hover:text-white text-relief-text-secondary"><ChevronRight size={16} /></button>
                </div>
                
                {isViewLoading ? (
                    <div className="absolute inset-0 flex items-center justify-center z-10">
                        <div className="w-8 h-8 border-2 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
                    </div>
                ) : (
                    <>
                        <div className="grid grid-cols-7 gap-1 mb-2 text-center">{['S','M','T','W','T','F','S'].map((d, i) => (<div key={i} className="text-[9px] font-bold text-relief-text-secondary uppercase">{d}</div>))}</div>
                        <div className="grid grid-cols-7 gap-1">{renderCalendar()}</div>
                        <div className="flex justify-between items-center px-4 mt-6">
                            <button onClick={() => setShowAddTxnModal(true)} className="w-12 h-12 rounded-full bg-emerald-500/20 border-2 border-emerald-500/50 flex items-center justify-center text-emerald-400 shadow-lg active:scale-95 transition-transform"><Plus size={24} /></button>
                            <button onClick={() => setShowEditBalanceModal(true)} className="w-12 h-12 rounded-full bg-blue-500/20 border-2 border-blue-500/50 flex items-center justify-center text-blue-400 active:scale-95 transition-transform"><Edit3 size={20} /></button>
                            <button onClick={() => setShowWhatIfModal(true)} className="w-12 h-12 rounded-full bg-purple-500/20 border-2 border-purple-500/50 flex items-center justify-center text-purple-400 active:scale-95 transition-transform"><Sparkles size={20} /></button>
                            <button onClick={() => setShowProjected(!showProjected)} className={`w-12 h-12 rounded-full flex items-center justify-center border-2 transition-all active:scale-95 ${showProjected ? 'bg-[#FF4D00] text-white border-[#FF4D00] shadow-[0_0_15px_rgba(255,77,0,0.6)] animate-pulse' : 'bg-slate-800/50 border-slate-700 text-slate-400'}`}><Flame size={20} /></button>
                        </div>
                    </>
                )}
            </div>

            {/* Activity on Selected Date */}
            <div className={`p-4 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl transition-opacity duration-200 ${isViewLoading ? 'opacity-50' : 'opacity-100'}`}>
                <div className="flex items-center gap-2 mb-3">
                    <Clock className="w-3 h-3 text-relief-primary" />
                    <span className="text-[10px] font-bold uppercase text-relief-text-secondary tracking-wider">
                        Activity on {new Date(selectedDateStr).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}
                    </span>
                </div>
                <div className="space-y-2">
                    {transactions
                        .filter(t => normalizeDate(t.transaction_date) === selectedDateStr)
                        .length > 0 ? (
                            transactions
                                .filter(t => normalizeDate(t.transaction_date) === selectedDateStr)
                                .map(t => {
                                    const isGhost = t.is_ghost;
                                    const isPastDue = t.status === 'expected' && normalizeDate(t.transaction_date) < todayInTimezone;
                                    const isSkipped = t.status === 'skipped';
                                    
                                    let borderClass = "border-relief-border";
                                    let bgClass = "bg-relief-bg hover:bg-white/5";
                                    let textClass = "text-relief-text-primary";
                                    let amountClass = t.amount >= 0 ? 'text-relief-primary' : 'text-relief-text-secondary';
                                    
                                    if (isGhost) {
                                        borderClass = "border-purple-500 border-2";
                                        bgClass = "bg-purple-500/10 hover:bg-purple-500/20";
                                    } else if (isPastDue) {
                                        borderClass = "border-yellow-500 border-2 animate-pulse";
                                        bgClass = "bg-yellow-500/10 hover:bg-yellow-500/20";
                                    } else if (isSkipped) {
                                        textClass = "text-slate-500 line-through decoration-red-500 decoration-2 opacity-50";
                                        amountClass = "text-slate-500 line-through decoration-red-500 decoration-2 opacity-50";
                                        bgClass = "bg-slate-800/20 opacity-50";
                                    }

                                    return (
                                        <div key={t.id} onClick={() => setEditingTxn(t)} className={`flex items-center justify-between p-3 rounded-xl ${bgClass} ${borderClass} transition-colors cursor-pointer group`}>
                                            <div className="overflow-hidden">
                                                <div className={`text-xs font-bold truncate group-hover:text-relief-primary transition-colors ${textClass}`}>{t.name || t.merchant || 'Untitled'}</div>
                                                <div className="flex items-center gap-2 mt-0.5">
                                                </div>
                                            </div>
                                            <div className={`text-xs font-bold whitespace-nowrap ${amountClass}`}>
                                                {t.amount >= 0 ? '+' : ''}{Math.round(t.amount)}
                                            </div>
                                        </div>
                                    );
                                })
                        ) : (
                            <div className="text-center py-4 text-xs text-relief-text-secondary italic">No activity on this date.</div>
                        )
                    }
                </div>
            </div>
        </div>
    );
};
