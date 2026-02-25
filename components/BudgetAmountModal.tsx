import React, { useState, useMemo } from 'react';
import { Delete, ChevronRight, ArrowLeft, Pencil } from 'lucide-react';
import { Transaction } from '../types';
import { normalizeDate, getMonthName } from '../utils/dateUtils';

interface Props {
    categoryName: string;
    currentAmount: number; // The amount currently saved in DB (or default)
    actualSpentThisMonth: number; // Actual spent in the month being edited
    expectedThisMonth: number; // Planned expected
    remaining: number; // Passed in, but we'll calculate dynamic remaining based on input
    spentLastMonth: number;
    averageSpent: number;
    onSave: (newAmount: number, applyToFuture: boolean) => void;
    onCancel: () => void;
    history?: { month: string, amount: number, isCurrent: boolean }[];
    transactions?: Transaction[];
    type?: 'income' | 'expense';
}

export const BudgetAmountModal: React.FC<Props> = ({ 
    categoryName, 
    currentAmount, 
    actualSpentThisMonth,
    expectedThisMonth,
    spentLastMonth,
    averageSpent,
    onSave, 
    onCancel,
    history = [],
    transactions = [],
    type = 'expense'
}) => {
    const [isEditing, setIsEditing] = useState(false);
    
    // Edit State
    const [valueStr, setValueStr] = useState(currentAmount > 0 ? currentAmount.toString() : '0');
    const [applyFuture, setApplyFuture] = useState(false);
    const inputValue = parseInt(valueStr) || 0;

    // Info State
    const [selectedMonthIndex, setSelectedMonthIndex] = useState(history.length - 1);

    const handleNum = (num: number) => {
        if (valueStr === '0') setValueStr(num.toString());
        else setValueStr(prev => prev + num.toString());
    };

    const handleBackspace = () => {
        setValueStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    };

    const handleSave = () => {
        onSave(inputValue, applyFuture);
        setIsEditing(false);
    };

    // Derived Data
    const totalExpected = actualSpentThisMonth + expectedThisMonth;
    
    // Budget Amount Logic:
    // When editing, show the input value. When not editing, show the saved currentAmount.
    const displayBudgetAmount = isEditing ? inputValue : currentAmount;
    
    // Calculate remaining based on type
    const remaining = type === 'income'
        ? (totalExpected) - displayBudgetAmount
        : displayBudgetAmount - totalExpected;

    // Determine colors based on type and remaining amount
    let boxColorClass = '';
    let textColorClass = '';
    
    if (type === 'income') {
        if (remaining > 0) {
            // Over budget (Good)
            boxColorClass = 'border-emerald-500/30 bg-emerald-500/10';
            textColorClass = 'text-emerald-400';
        } else if (remaining < 0) {
            // Under budget (Bad)
            boxColorClass = 'border-red-500/30 bg-red-500/10';
            textColorClass = 'text-red-400';
        } else {
            // At budget
            boxColorClass = 'border-[#2E93FA]/30 bg-[#2E93FA]/10';
            textColorClass = 'text-[#2E93FA]';
        }
    } else {
        // Expense
        if (remaining < 0) {
            // Over budget (Bad)
            boxColorClass = 'border-red-500/30 bg-red-500/10';
            textColorClass = 'text-red-400';
        } else if (remaining === 0) {
            // At budget
            boxColorClass = 'border-[#2E93FA]/30 bg-[#2E93FA]/10';
            textColorClass = 'text-[#2E93FA]';
        } else {
            // Under budget (Good)
            boxColorClass = 'border-emerald-500/30 bg-emerald-500/10';
            textColorClass = 'text-emerald-400';
        }
    }

    // Filter transactions for the selected month in Info tab
    const selectedMonthTransactions = useMemo(() => {
        if (history.length === 0) return [];
        const today = new Date();
        const offset = (history.length - 1) - selectedMonthIndex;
        const targetDate = new Date(today.getFullYear(), today.getMonth() - offset, 1);
        const targetMonthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}`;
        
        return transactions.filter(t => t.transaction_date.startsWith(targetMonthKey));
    }, [selectedMonthIndex, transactions, history]);

    const maxChartValue = Math.max(...history.map(h => h.amount), 1);

    const renderPills = () => (
        <div className="w-full px-4 mt-4 space-y-2">
            <div className="grid grid-cols-3 gap-2">
                <div className="bg-[#0F172A] border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center">
                    <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider text-center">Spent</span>
                    <span className="text-xs font-bold text-white">${actualSpentThisMonth.toLocaleString()}</span>
                </div>
                <div className="bg-[#0F172A] border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center">
                    <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider text-center">Planned</span>
                    <span className="text-xs font-bold text-white">${expectedThisMonth.toLocaleString()}</span>
                </div>
                <div className="bg-[#0F172A] border border-white/5 rounded-xl p-2 flex flex-col items-center justify-center">
                    <span className="text-[8px] text-slate-500 uppercase font-bold tracking-wider text-center">Total</span>
                    <span className="text-xs font-bold text-white">${totalExpected.toLocaleString()}</span>
                </div>
            </div>
            <div className={`bg-[#0F172A] border rounded-xl p-4 flex flex-col items-center justify-center ${boxColorClass}`}>
                <span className={`text-[10px] uppercase font-bold tracking-wider mb-1 ${textColorClass}`}>
                    {type === 'income' ? 'Left to Earn' : 'Available to Spend'}
                </span>
                <span className={`text-2xl font-bold ${textColorClass}`}>
                    ${remaining.toLocaleString()}
                </span>
            </div>
        </div>
    );

    return (
        <div className="flex flex-col h-[100dvh] bg-[#020617] text-relief-text-primary animate-fade-in overflow-hidden relative">
            {/* Header */}
            <div className="flex flex-col shrink-0 bg-[#020617] border-b border-white/5 pt-4 pb-4 z-10">
                <div className="flex justify-between items-center px-4">
                    <button onClick={onCancel} className="text-relief-text-secondary p-2 hover:text-white transition-colors">
                        <ArrowLeft size={24} />
                    </button>
                    <span className="font-bold text-lg text-relief-primary italic truncate max-w-[60%]">{categoryName}</span>
                    <div className="w-10"></div> {/* Spacer for alignment */}
                </div>
            </div>

            {/* Scrollable Content Area */}
            <div className="flex-1 overflow-y-auto min-h-0">
                <div className="flex flex-col items-center py-6">
                    {/* Budget Amount Header */}
                    <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Budget</span>
                        <div className="flex items-center gap-3 text-relief-text-primary">
                            <div className="flex items-start">
                                <span className="text-2xl font-bold mt-2 text-relief-primary">$</span>
                                <span className="text-6xl font-bold tracking-tighter">{displayBudgetAmount.toLocaleString()}</span>
                            </div>
                            <button 
                                onClick={() => setIsEditing(true)}
                                className="p-2 rounded-full bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white transition-colors"
                            >
                                <Pencil size={16} />
                            </button>
                        </div>
                    </div>

                    {/* Pills */}
                    {renderPills()}

                    {/* Info Content (Chart, Stats, Txns) */}
                    <div className="w-full px-4 mt-8 space-y-6 pb-24">
                        {/* History Chart */}
                        <div className="bg-[#0F172A] border border-white/5 rounded-2xl p-4 shadow-lg shadow-black/40">
                            <div className="flex items-end justify-between h-32 gap-2">
                                {history.map((h, i) => (
                                    <div 
                                        key={i} 
                                        onClick={() => setSelectedMonthIndex(i)}
                                        className="flex flex-col items-center gap-2 flex-1 h-full cursor-pointer group"
                                    >
                                        <div className="w-full relative flex items-end justify-center flex-1">
                                            <div 
                                                className={`w-full max-w-[16px] rounded-t-md transition-all duration-300 ${i === selectedMonthIndex ? 'bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.4)]' : 'bg-slate-800 hover:bg-slate-700'}`}
                                                style={{ height: `${(h.amount / maxChartValue) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className={`text-[10px] font-bold uppercase ${i === selectedMonthIndex ? 'text-white' : 'text-slate-600'}`}>{h.month}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Stats Boxes */}
                        <div className="grid grid-cols-2 gap-3">
                            <div className="bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 p-4 rounded-xl flex flex-col justify-between h-20">
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Last Month</div>
                                <div className="text-xl font-bold text-white">${spentLastMonth.toLocaleString()}</div>
                            </div>
                            <div className="bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 p-4 rounded-xl flex flex-col justify-between h-20">
                                <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">6 Mo. Avg</div>
                                <div className="text-xl font-bold text-white">${averageSpent.toLocaleString()}</div>
                            </div>
                        </div>

                        {/* Transaction History Box */}
                        <div className="bg-[#0F172A] border border-white/5 rounded-2xl overflow-hidden shadow-lg shadow-black/40">
                            <div className="p-4 border-b border-white/5">
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                                    Transactions • {history[selectedMonthIndex]?.month}
                                </h3>
                            </div>
                            <div className="max-h-60 overflow-y-auto">
                                {selectedMonthTransactions.length === 0 ? (
                                    <div className="p-8 text-center text-slate-600 text-xs italic">No transactions found</div>
                                ) : (
                                    selectedMonthTransactions.map(t => (
                                        <div key={t.id} className="flex items-center justify-between p-3 border-b border-white/5 last:border-0 hover:bg-white/5">
                                            <div className="flex flex-col min-w-0 pr-2">
                                                <span className="text-sm font-bold text-slate-200 truncate">{t.name}</span>
                                                <span className="text-[10px] text-slate-500">{normalizeDate(t.transaction_date)}</span>
                                            </div>
                                            <span className={`text-sm font-bold ${t.amount > 0 ? 'text-emerald-400' : 'text-slate-200'}`}>
                                                ${Math.abs(t.amount).toLocaleString()}
                                            </span>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Slide-up Keypad Overlay */}
            <div 
                className={`fixed inset-x-0 bottom-0 z-50 bg-[#020617] border-t border-white/10 rounded-t-3xl shadow-2xl transition-transform duration-300 ease-out flex flex-col ${isEditing ? 'translate-y-0' : 'translate-y-full'}`}
                style={{ height: '50vh' }}
            >
                {/* Keypad Header */}
                <div className="flex justify-between items-center px-6 py-3 border-b border-white/5 shrink-0">
                    <button 
                        onClick={() => {
                            setIsEditing(false);
                            setValueStr(currentAmount.toString()); // Reset on close
                        }} 
                        className="text-slate-400 font-bold text-sm hover:text-white transition-colors"
                    >
                        Close
                    </button>
                    <button 
                        onClick={handleSave} 
                        className="text-emerald-400 font-bold text-sm hover:text-emerald-300 transition-colors"
                    >
                        Save
                    </button>
                </div>

                {/* Apply Future Toggle */}
                <div 
                    onClick={() => setApplyFuture(!applyFuture)}
                    className="flex justify-between items-center px-6 py-4 border-b border-white/5 cursor-pointer active:bg-white/5 transition-colors shrink-0"
                >
                    <span className="text-sm font-bold text-slate-200">Apply to future months</span>
                    <div className={`w-12 h-7 rounded-full transition-colors relative ${applyFuture ? 'bg-emerald-500' : 'bg-slate-700'}`}>
                        <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full transition-transform shadow-sm ${applyFuture ? 'left-5.5' : 'left-0.5'}`} />
                    </div>
                </div>

                {/* Numpad */}
                <div className="flex-1 p-2 min-h-0">
                    <div className="grid grid-cols-3 gap-2 h-full max-w-md mx-auto">
                        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                            <button 
                                key={num} 
                                onClick={() => handleNum(num)}
                                className="rounded-xl text-2xl font-medium text-white active:bg-slate-800 transition-colors flex items-center justify-center hover:bg-white/5 bg-white/5"
                            >
                                {num}
                            </button>
                        ))}
                        <div className="flex items-center justify-center"></div> {/* Empty slot */}
                        <button 
                            onClick={() => handleNum(0)}
                            className="rounded-xl text-2xl font-medium text-white active:bg-slate-800 transition-colors flex items-center justify-center hover:bg-white/5 bg-white/5"
                        >
                            0
                        </button>
                        <button 
                            onClick={handleBackspace}
                            className="rounded-xl text-white active:bg-slate-800 transition-colors flex items-center justify-center hover:bg-white/5 bg-white/5"
                        >
                            <Delete className="w-6 h-6" />
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};