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
    const [merchant, setMerchant] = useState(transaction?.merchant || '');
    
    // Recurring State
    const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring || false);
    const [freq, setFreq] = useState(transaction?.recur_frequency || 1);
    const [period, setPeriod] = useState<any>(transaction?.recur_period || 'months');
    const [endDate, setEndDate] = useState(transaction?.recur_end_date || '');

    // Autocomplete & Smart Assist State
    const [rules, setRules] = useState<TransactionRule[]>([]);
    const [existingMerchants, setExistingMerchants] = useState<string[]>([]);
    const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeRule, setActiveRule] = useState<TransactionRule | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);

    useEffect(() => {
        const fetchData = async () => {
             // Need groups for categorization rules logic if necessary, though WhatIf usually doesn't have deep categorization UI, 
             // but if a rule sets category, we might want to respect it or at least show it.
            const { data: groupData } = await supabase.from('budget_groups').select('*, categories:budget_categories(*)').order('sort_order');
            if (groupData) setBudgetGroups(groupData);

            const { data: rulesData } = await supabase.from('transaction_rules').select('*').eq('is_active', true);
            if (rulesData) setRules(rulesData);

            // Fetch distinct merchants for autocomplete
            const { data: txnData } = await supabase.from('transactions').select('merchant').neq('merchant', null).limit(1000);
            if (txnData) {
                // Trim whitespace and remove duplicates
                const unique = Array.from(new Set(
                    txnData
                        .map((t: any) => t.merchant?.trim())
                        .filter((m: any) => m && m.length > 0)
                ));
                setExistingMerchants(unique as string[]);
            }
        };
        fetchData();

        // Click outside listener for suggestions
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setShowSuggestions(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, []);

    // --- Smart Assist Rule Logic ---
    useEffect(() => {
        if (!merchant && !amount) {
            setActiveRule(null);
            return;
        }
        const numAmount = parseFloat(amount);
        const found = rules.find(rule => {
            return rule.conditions.every(cond => {
                let testVal: string | number = '';
                if (cond.field === 'merchant') testVal = merchant.toLowerCase();
                else if (cond.field === 'name') testVal = name.toLowerCase();
                else if (cond.field === 'amount') testVal = isNaN(numAmount) ? 0 : numAmount;

                const condVal = typeof cond.value === 'string' ? cond.value.toLowerCase() : cond.value;

                switch (cond.operator) {
                    case 'is': return testVal === condVal;
                    case 'contains': return String(testVal).includes(String(condVal));
                    case 'starts_with': return String(testVal).startsWith(String(condVal));
                    case 'eq': return testVal == condVal;
                    case 'gt': return testVal > condVal;
                    case 'lt': return testVal < condVal;
                    default: return false;
                }
            });
        });
        setActiveRule(found || null);
    }, [merchant, name, amount, rules]);

    const applySmartRule = () => {
        if (!activeRule) return;
        activeRule.actions.forEach(action => {
            if (action.type === 'rename_merchant') setMerchant(action.value);
            // Note: WhatIf form currently doesn't have a category dropdown in this version, 
            // but we can at least support merchant renaming or maybe in future category.
            // If the user adds category field to WhatIf form, we'd set it here.
        });
        setActiveRule(null);
    };

    // --- Autocomplete Logic ---
    const handleMerchantChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const val = e.target.value;
        setMerchant(val);
        if (val.length > 1) {
            const matches = existingMerchants.filter(m => m.toLowerCase().startsWith(val.toLowerCase())).slice(0, 5);
            setMerchantSuggestions(matches);
            setShowSuggestions(matches.length > 0);
        } else {
            setShowSuggestions(false);
        }
    };

    const selectSuggestion = (val: string) => {
        setMerchant(val);
        setShowSuggestions(false);
    };

    const handleSubmit = () => {
        const finalAmount = parseFloat(amount) * (type === 'income' ? 1 : -1);
        if (isNaN(finalAmount) || !name) return;

        const baseTxn: Transaction = {
            id: transaction?.id || uuidv4(),
            user_id: 'ghost',
            name,
            merchant: merchant || name,
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
                {/* Merchant Input with Autocomplete */}
                <div className="relative" ref={wrapperRef}>
                    <input 
                        placeholder="Merchant (Optional)" 
                        value={merchant} 
                        onChange={handleMerchantChange}
                        onFocus={() => { if(merchant.length > 1 && merchantSuggestions.length > 0) setShowSuggestions(true); }}
                        className="w-full p-4 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 focus:border-indigo-400/50 outline-none"
                    />
                     {showSuggestions && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-slate-800 border border-white/10 rounded-xl shadow-xl z-50 overflow-hidden">
                            {merchantSuggestions.map(s => (
                                <button
                                    key={s}
                                    onClick={() => selectSuggestion(s)}
                                    className="w-full text-left px-4 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white border-b border-white/5 last:border-0"
                                >
                                    {s}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                 {/* Smart Assist Pill */}
                 {activeRule && (
                    <div className="p-3 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Sparkles className="w-4 h-4 text-indigo-400 shrink-0" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-bold uppercase text-indigo-400">Smart Assist</span>
                                <span className="text-xs text-indigo-200 truncate pr-2">
                                    Apply "{activeRule.name}"?
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={applySmartRule}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-indigo-500 text-white text-[10px] font-bold uppercase tracking-wider hover:bg-indigo-400 transition-colors flex items-center gap-1"
                        >
                            Apply <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                )}

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