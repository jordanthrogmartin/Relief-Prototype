import React, { useState, useMemo } from 'react';
import { CheckSquare, Square, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Search } from 'lucide-react';
import { useGlobalContext } from '../context/GlobalContext';
import { Transaction } from '../types';
import { normalizeDate, getMonthName } from '../utils/dateUtils';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { TransactionForm } from '../components/TransactionForm';
import { parseCategoryName } from '../utils/emojiUtils';

export const Activity: React.FC = () => {
    // Directly use transactions from Global Context.
    // They are already windowed by viewDate (+/- range)
    const { 
        refreshTrigger, 
        showExpected, 
        setShowExpected, 
        ghostTransactions,
        transactions: contextTransactions, // These are transactions for the current view window
        viewDate,
        setViewDate,
        isViewLoading,
        budgetGroups,
        todayInTimezone
    } = useGlobalContext();

    const [search, setSearch] = useState('');
    const [editingTxn, setEditingTxn] = useState<Transaction | null>(null);
    
    // We synchronize local date view with Global Context View Date
    const currentDate = viewDate;

    // Month Picker State
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [pickerYear, setPickerYear] = useState(new Date().getFullYear());

    // Filter transactions to strictly match the selected month
    const visibleTransactions = useMemo(() => {
        const year = currentDate.getFullYear();
        const month = currentDate.getMonth(); 
        const startStr = `${year}-${String(month + 1).padStart(2, '0')}-01`;
        // Find last day of month
        const daysInMonth = new Date(year, month + 1, 0).getDate();
        const endStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

        // Combine Real + Ghost
        // Ghosts are also in context if we used `allTransactions` but let's stick to explicit combine
        const ghostsInMonth = ghostTransactions.filter(g => {
            const d = normalizeDate(g.transaction_date);
            return d >= startStr && d <= endStr;
        });

        // Context transactions cover a wider range, filter down
        const realInMonth = contextTransactions.filter(t => {
            const d = normalizeDate(t.transaction_date);
            return d >= startStr && d <= endStr;
        });

        const combined = [...realInMonth, ...ghostsInMonth];

        // Apply Search & Toggle
        return combined.filter(t => {
            const matchesSearch = (t.name + (t.merchant || '')).toLowerCase().includes(search.toLowerCase());
            const matchesExpected = showExpected ? true : t.status !== 'expected';
            return matchesSearch && matchesExpected;
        }).sort((a, b) => b.transaction_date.localeCompare(a.transaction_date));

    }, [contextTransactions, ghostTransactions, currentDate, search, showExpected]);

    const handleEditSuccess = () => {
        setEditingTxn(null);
        // refreshTrigger in context handles refetch
    };

    // Date Logic
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

    const changeMonth = (direction: 'prev' | 'next') => {
        const d = new Date(currentDate);
        d.setMonth(currentDate.getMonth() + (direction === 'next' ? 1 : -1));
        setViewDate(d);
    };

    // Grouping
    const groupedTransactions: { [date: string]: Transaction[] } = {};
    visibleTransactions.forEach(t => {
        const dateKey = normalizeDate(t.transaction_date);
        if (!groupedTransactions[dateKey]) {
            groupedTransactions[dateKey] = [];
        }
        groupedTransactions[dateKey].push(t);
    });

    const sortedDates = Object.keys(groupedTransactions).sort((a, b) => b.localeCompare(a));

    const getRowStyle = (t: Transaction) => {
        let base = "w-full p-4 rounded-xl border border-relief-border bg-relief-bg flex justify-between items-center hover:bg-relief-surface transition-colors text-left group";
        const isPastDue = t.status === 'expected' && normalizeDate(t.transaction_date) < todayInTimezone;
        const isExpected = t.status === 'expected';
        
        if (t.is_ghost) return `${base} border-purple-500 border-2 bg-purple-500/10 hover:bg-purple-500/20`; 
        if (isPastDue) return `${base} border-yellow-500 border-2 animate-pulse bg-yellow-500/10 hover:bg-yellow-500/20`;
        if (t.status === 'skipped') return `${base} bg-slate-800/20 opacity-50`; 
        if (isExpected) return `${base} opacity-50`;
        return base;
    };

    return (
        <div className="space-y-4 pt-4 px-4 pb-24 animate-page-enter">
            {/* Month Picker Bar */}
            <div className="flex items-center justify-between px-2 py-2">
                <button onClick={() => changeMonth('prev')} className="p-2 text-slate-400 hover:text-white border border-white/5 rounded-lg bg-slate-800/50">
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <button 
                    onClick={() => { setPickerYear(currentDate.getFullYear()); setShowDatePicker(true); }}
                    className="flex items-center gap-2 px-4 py-2 text-sm font-bold text-white border rounded-xl bg-slate-800/50 border-white/10 hover:bg-white/5 transition-colors"
                >
                    <CalendarIcon className="w-4 h-4 text-emerald-400" />
                    {getMonthName(currentDate.getMonth())} {currentDate.getFullYear()}
                </button>
                <button onClick={() => changeMonth('next')} className="p-2 text-slate-400 hover:text-white border border-white/5 rounded-lg bg-slate-800/50">
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>

            <div className="px-2 flex gap-2">
                <div className="flex-grow flex items-center bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl px-3">
                    <Search className="w-4 h-4 text-relief-text-secondary" />
                    <input 
                        className="w-full bg-transparent p-3 text-sm text-relief-text-primary outline-none placeholder:text-relief-text-secondary"
                        placeholder="Search..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                </div>
                <button 
                    onClick={() => setShowExpected(!showExpected)}
                    className={`flex items-center justify-center p-3 rounded-2xl border shadow-lg shadow-black/40 transition-all active:scale-95 ${showExpected ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-[#0F172A] border-white/5 text-slate-500'}`}
                >
                    {showExpected ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                </button>
            </div>

            <div className={`space-y-6 px-2 transition-opacity duration-200 ${isViewLoading ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                {sortedDates.length === 0 && !isViewLoading && (
                    <div className="text-center text-slate-500 py-10 text-xs italic">No transactions found for this period.</div>
                )}

                {sortedDates.map(date => (
                    <div key={date}>
                        <div className="sticky top-0 bg-[#020617]/95 backdrop-blur-sm z-10 py-2 mb-2 border-b border-white/5">
                            <h3 className="text-xs font-bold text-slate-400">
                                {new Date(date).toLocaleDateString('en-US', { weekday: 'short', month: 'long', day: 'numeric', timeZone: 'UTC' })}
                            </h3>
                        </div>
                        <div className="space-y-2">
                            {groupedTransactions[date].map(t => {
                                const { emoji } = parseCategoryName(t.category || '');
                                const isSkipped = t.status === 'skipped';
                                return (
                                    <button 
                                        key={t.id} 
                                        onClick={() => setEditingTxn(t)}
                                        className={getRowStyle(t)}
                                    >
                                        <div className="overflow-hidden mr-3">
                                            <div className={`font-bold text-sm truncate transition-colors ${isSkipped ? 'text-slate-500 line-through decoration-red-500 decoration-2' : 'text-white group-hover:text-emerald-300'}`}>
                                                {emoji && <span className="mr-1.5">{emoji}</span>}
                                                {t.name || t.merchant || 'Untitled'}
                                            </div>
                                            <div className="text-[10px] text-slate-500 font-medium truncate mt-1 flex items-center gap-1.5">
                                                <span className={`uppercase ${t.status === 'cleared' ? 'text-emerald-500' : 'text-slate-500'} ${isSkipped ? 'line-through decoration-red-500 decoration-2' : ''}`}>{t.status}</span>
                                            </div>
                                        </div>
                                        <div className={`font-bold text-sm whitespace-nowrap ${t.amount >= 0 ? 'text-emerald-400' : 'text-slate-200'} ${t.is_ghost ? 'text-indigo-400' : ''} ${isSkipped ? 'text-slate-500 line-through decoration-red-500 decoration-2' : ''}`}>
                                            {t.amount >= 0 ? '+' : ''}{t.amount.toFixed(2)}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </div>

            <Modal isOpen={!!editingTxn} onClose={() => setEditingTxn(null)} title="Edit Transaction">
                {editingTxn && (
                    <TransactionForm 
                        transaction={editingTxn} 
                        onSuccess={handleEditSuccess} 
                        onCancel={() => setEditingTxn(null)} 
                    />
                )}
            </Modal>

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