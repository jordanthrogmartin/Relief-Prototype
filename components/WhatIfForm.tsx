import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { generateRecurringSeries, uuidv4 } from '../utils/dateUtils';
import { Transaction, TransactionType, TransactionRule, BudgetGroup } from '../types';
import { Button } from './ui/Button';
import { useGlobalContext } from '../context/GlobalContext';
import { Sparkles, ArrowRight } from 'lucide-react';

interface Props {
    transaction?: Transaction;
    initialDate?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const WhatIfForm: React.FC<Props> = ({ transaction, initialDate, onSuccess, onCancel }) => {
    const { addGhostTransactions, updateGhostTransaction, deleteGhostTransaction, todayInTimezone } = useGlobalContext();

    // Form State
    const [name, setName] = useState(transaction?.name || '');
    const [amount, setAmount] = useState(transaction ? Math.abs(transaction.amount).toString() : '');
    const [date, setDate] = useState(transaction?.transaction_date || initialDate || todayInTimezone);
    const [type, setType] = useState<TransactionType>(transaction?.type || 'expense');
    
    // Recurring State
    const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring || false);
    const [freq, setFreq] = useState(transaction?.recur_frequency || 1);
    const [period, setPeriod] = useState<any>(transaction?.recur_period || 'months');
    const [endDate, setEndDate] = useState(transaction?.recur_end_date || '');

    const handleSubmit = () => {
        const finalAmount = parseFloat(amount) * (type === 'income' ? 1 : -1);
        if (isNaN(finalAmount) || !name) return;

        const baseTxn: Transaction = {
            id: transaction?.id || uuidv4(),
            user_id: 'ghost',
            name,
            merchant: name, // Use name as merchant since merchant input is removed
            amount: finalAmount,
            transaction_date: date,
            type,
            status: 'expected',
            budget_group: 'What If?',
            category: 'Simulation',
            is_recurring: isRecurring,
            recur_frequency: isRecurring ? Number(freq) : undefined,
            recur_period: isRecurring ? period : undefined,
            recur_end_date: isRecurring && endDate ? endDate : undefined,
            is_ghost: true
        };

        if (transaction?.id) {
            updateGhostTransaction(baseTxn);
        } else {
            if (isRecurring) {
                const series = generateRecurringSeries(baseTxn);
                const ghostSeries = series.map(t => ({ ...t, is_ghost: true, id: uuidv4() }));
                addGhostTransactions(ghostSeries);
            } else {
                addGhostTransactions([baseTxn]);
            }
        }
        onSuccess();
    };

    const handleDelete = () => {
        if (transaction?.id) {
            deleteGhostTransaction(transaction.id);
            onSuccess();
        }
    };

    const typeColors = {
        income: {
            active: 'border-emerald-400/50 bg-emerald-400/10 text-emerald-400',
            inactive: 'border-white/10 text-slate-500 hover:text-emerald-400'
        },
        expense: {
            active: 'border-red-400/50 bg-red-400/10 text-red-400',
            inactive: 'border-white/10 text-slate-500 hover:text-red-400'
        },
        goal: {
            active: 'border-blue-400/50 bg-blue-400/10 text-blue-400',
            inactive: 'border-white/10 text-slate-500 hover:text-blue-400'
        }
    };

    return (
        <div className="space-y-5 pb-10">
            <div className="p-3 mb-4 text-xs italic text-center rounded-lg bg-indigo-500/10 text-indigo-300 border border-indigo-500/20">
                This is a temporary "What if?" transaction. It is not saved to the database.
            </div>

            <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Type</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                    {(['income', 'expense', 'goal'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => setType(t)}
                            className={`py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest border transition-all ${
                                type === t ? typeColors[t].active : typeColors[t].inactive
                            }`}
                        >
                            {t}
                        </button>
                    ))}
                </div>
            </div>

            <div className="space-y-4 relative">
                <input 
                    placeholder="Simulation Name" 
                    value={name} 
                    onChange={e => setName(e.target.value)}
                    className="w-full p-4 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 focus:border-indigo-400/50 outline-none"
                />
                
                <div className="flex items-center gap-2 p-4 border bg-slate-800/50 rounded-xl border-white/10 focus-within:border-indigo-400/50">
                    <span className="font-bold text-slate-400">$</span>
                    <input 
                        type="number" 
                        step="0.01" 
                        placeholder="0.00" 
                        value={amount}
                        onChange={e => setAmount(e.target.value)}
                        className="w-full text-lg font-bold text-white bg-transparent outline-none"
                    />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="min-w-0">
                    <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Date</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                        className="w-full h-[46px] px-3 mt-1 text-sm text-white border bg-slate-800/50 border-white/10 rounded-xl focus:border-indigo-400/50 outline-none appearance-none"
                    />
                </div>
            </div>

            {!transaction && (
                <div className="p-4 border border-white/5 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            checked={isRecurring} 
                            onChange={e => setIsRecurring(e.target.checked)}
                            className="w-5 h-5 text-indigo-400 rounded bg-slate-700 border-white/20 focus:ring-0"
                        />
                        <label className="text-sm font-bold text-white">Recurring Simulation</label>
                    </div>
                    {isRecurring && (
                        <div className="pt-3 space-y-3">
                            <div className="flex gap-2">
                                <input 
                                    type="number" 
                                    value={freq} 
                                    onChange={e => setFreq(Number(e.target.value))}
                                    className="w-20 p-2 text-sm text-white border rounded-lg bg-slate-900/50 border-white/10"
                                />
                                <select 
                                    value={period} 
                                    onChange={e => setPeriod(e.target.value)}
                                    className="flex-1 p-2 text-sm text-white border rounded-lg bg-slate-900/50 border-white/10"
                                >
                                    <option value="days">Days</option>
                                    <option value="weeks">Weeks</option>
                                    <option value="months">Months</option>
                                    <option value="years">Years</option>
                                </select>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-white/5">
                {transaction && (
                     <Button variant="danger" onClick={handleDelete}>
                         Delete
                     </Button>
                )}
                <Button variant="secondary" onClick={onCancel} className="flex-1">
                    Cancel
                </Button>
                <Button onClick={handleSubmit} className="flex-[2] bg-indigo-500 hover:bg-indigo-400 text-white">
                    {transaction ? 'Update' : 'Add'}
                </Button>
            </div>
        </div>
    );
};