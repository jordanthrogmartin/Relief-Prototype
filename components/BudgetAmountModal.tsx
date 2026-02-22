import React, { useState } from 'react';
import { Delete } from 'lucide-react';

interface Props {
    categoryName: string;
    currentAmount: number; // The amount currently saved in DB (or default)
    actualSpentThisMonth: number; // Actual spent in the month being edited
    remaining: number; // Passed in, but we'll calculate dynamic remaining based on input
    spentLastMonth: number;
    averageSpent: number;
    onSave: (newAmount: number, applyToFuture: boolean) => void;
    onCancel: () => void;
    history?: { month: string, amount: number, isCurrent: boolean }[];
}

export const BudgetAmountModal: React.FC<Props> = ({ 
    categoryName, 
    currentAmount, 
    actualSpentThisMonth,
    spentLastMonth,
    averageSpent,
    onSave, 
    onCancel,
    history = []
}) => {
    // Initialize with current amount, handle 0 gracefully
    const [valueStr, setValueStr] = useState(currentAmount > 0 ? currentAmount.toString() : '0');
    const [applyFuture, setApplyFuture] = useState(false);

    const inputValue = parseInt(valueStr) || 0;
    
    // Dynamic Remaining Calculation: (What user typed) - (What was actually spent)
    const dynamicRemaining = inputValue - actualSpentThisMonth;
    const isNegative = dynamicRemaining < 0;

    const handleNum = (num: number) => {
        if (valueStr === '0') setValueStr(num.toString());
        else setValueStr(prev => prev + num.toString());
    };

    const handleBackspace = () => {
        setValueStr(prev => prev.length > 1 ? prev.slice(0, -1) : '0');
    };

    const handleSave = () => {
        onSave(inputValue, applyFuture);
    };

    // Find max value for chart scaling
    const maxChartValue = Math.max(...history.map(h => h.amount), 1);

    return (
        <div className="flex flex-col h-[100dvh] bg-[#020617] text-relief-text-primary animate-fade-in overflow-hidden">
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-4 shrink-0">
                <button onClick={onCancel} className="text-relief-text-secondary font-medium text-sm p-2">Cancel</button>
                <span className="font-bold text-lg text-relief-primary italic truncate max-w-[50%]">{categoryName}</span>
                <button onClick={handleSave} className="text-relief-primary font-bold text-sm p-2">Save</button>
            </div>

            {/* Main Content - Flex Grow/Shrink to fit */}
            <div className="flex-1 flex flex-col justify-evenly min-h-0 overflow-y-auto">
                {/* Main Amount Display */}
                <div className="flex flex-col items-center justify-center py-1 shrink-0">
                    <div className="flex items-start text-relief-text-primary">
                        <span className="text-2xl font-bold mt-2 text-relief-primary">$</span>
                        <span className="text-6xl font-bold tracking-tighter">{inputValue.toLocaleString()}</span>
                    </div>
                    <div className={`mt-2 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest bg-relief-surface border border-relief-border ${isNegative ? 'text-relief-critical' : 'text-relief-primary'}`}>
                        Remaining: ${dynamicRemaining.toLocaleString()}
                    </div>
                    <span className="text-[10px] text-relief-text-secondary mt-1 font-medium">Spent so far: ${actualSpentThisMonth.toLocaleString()}</span>
                </div>

                {/* History Chart */}
                <div className="px-6 py-2 shrink-0">
                    <div className="flex items-end justify-between h-16 gap-2 pb-1 border-b border-white/5">
                        {history.map((h, i) => (
                            <div key={i} className="flex flex-col items-center gap-1 flex-1 h-full group">
                                <div className="w-full relative flex items-end justify-center flex-1">
                                    <div 
                                        className={`w-full max-w-[12px] rounded-t-sm transition-all duration-500 ${h.isCurrent ? 'bg-relief-primary shadow-[0_0_8px_rgba(52,211,153,0.3)]' : 'bg-slate-700'}`}
                                        style={{ height: `${(h.amount / maxChartValue) * 100}%` }}
                                    ></div>
                                </div>
                                <span className={`text-[8px] font-bold uppercase ${h.isCurrent ? 'text-relief-text-primary' : 'text-relief-text-secondary'}`}>{h.month.substring(0,1)}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 gap-3 px-4 shrink-0 mb-2">
                    <div className="bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 p-3 rounded-xl flex flex-col justify-between h-14">
                        <div className="text-[9px] uppercase font-bold text-relief-text-secondary tracking-wider">Last Month</div>
                        <div className="text-base font-bold text-relief-text-primary">${spentLastMonth.toLocaleString()}</div>
                    </div>
                    <div className="bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 p-3 rounded-xl flex flex-col justify-between h-14">
                        <div className="text-[9px] uppercase font-bold text-relief-text-secondary tracking-wider">6 Mo. Avg</div>
                        <div className="text-base font-bold text-relief-text-primary">${averageSpent.toLocaleString()}</div>
                    </div>
                </div>
            </div>

            {/* Controls - Fixed at bottom, NO EXTRA PADDING since nav bar is covered */}
            <div className="bg-[#020617] border-t border-white/5 pb-6 pt-2 shrink-0">
                {/* Apply Future Toggle */}
                <div 
                    onClick={() => setApplyFuture(!applyFuture)}
                    className="flex justify-between items-center px-6 py-2 mb-1 cursor-pointer active:bg-relief-surface transition-colors"
                >
                    <div className="flex flex-col">
                        <span className="text-xs font-bold text-relief-text-primary">Apply to future months</span>
                        <span className="text-[9px] text-relief-text-secondary">Update budget for this and all upcoming months</span>
                    </div>
                    <div className={`w-10 h-6 rounded-full transition-colors relative ${applyFuture ? 'bg-relief-primary' : 'bg-slate-700'}`}>
                        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform shadow-sm ${applyFuture ? 'left-5' : 'left-1'}`} />
                    </div>
                </div>

                {/* Numpad */}
                <div className="grid grid-cols-3 gap-1 px-1 max-w-md mx-auto">
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                        <button 
                            key={num} 
                            onClick={() => handleNum(num)}
                            className="h-12 rounded-lg text-xl font-medium text-relief-text-primary active:bg-relief-surface transition-colors flex flex-col items-center justify-center hover:bg-white/5"
                        >
                            {num}
                        </button>
                    ))}
                    <div className="h-12"></div> {/* Empty slot */}
                    <button 
                        onClick={() => handleNum(0)}
                        className="h-12 rounded-lg text-xl font-medium text-relief-text-primary active:bg-relief-surface transition-colors flex items-center justify-center hover:bg-white/5"
                    >
                        0
                    </button>
                    <button 
                        onClick={handleBackspace}
                        className="h-12 rounded-lg text-relief-text-primary active:bg-relief-surface transition-colors flex items-center justify-center hover:bg-white/5"
                    >
                        <Delete className="w-5 h-5" />
                    </button>
                </div>
            </div>
        </div>
    );
};