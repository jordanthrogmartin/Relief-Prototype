import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../services/supabase';
import { generateRecurringSeries, uuidv4 } from '../utils/dateUtils';
import { Transaction, BudgetGroup, TransactionType, TransactionRule, TransactionStatus } from '../types';
import { Button } from './ui/Button';
import { useGlobalContext } from '../context/GlobalContext';
import { Sparkles, ArrowRight, Info } from 'lucide-react';

interface Props {
    transaction?: Transaction;
    initialDate?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const TransactionForm: React.FC<Props> = ({ transaction, initialDate, onSuccess, onCancel }) => {
    const { todayInTimezone, setRuleCandidate } = useGlobalContext();

    // Form State
    const [name, setName] = useState(transaction?.name || '');
    const [amount, setAmount] = useState(transaction ? Math.abs(transaction.amount).toString() : '');
    const [date, setDate] = useState(transaction?.transaction_date || initialDate || todayInTimezone);
    const [type, setType] = useState<TransactionType>(transaction?.type || 'expense');
    const [status, setStatus] = useState<TransactionStatus>(transaction?.status || 'cleared');
    const [merchant, setMerchant] = useState(transaction?.merchant || '');
    const [notes, setNotes] = useState(transaction?.notes || '');
    const [group, setGroup] = useState(transaction?.budget_group || '');
    const [category, setCategory] = useState(transaction?.category || '');
    
    // Recurring State
    const [isRecurring, setIsRecurring] = useState(transaction?.is_recurring || false);
    const [freq, setFreq] = useState(transaction?.recur_frequency || 1);
    const [period, setPeriod] = useState<any>(transaction?.recur_period || 'months');
    const [endDate, setEndDate] = useState(transaction?.recur_end_date || '');

    // Data State
    const [budgetGroups, setBudgetGroups] = useState<BudgetGroup[]>([]);
    const [loading, setLoading] = useState(false);
    const [rules, setRules] = useState<TransactionRule[]>([]);
    const [existingMerchants, setExistingMerchants] = useState<string[]>([]);
    
    // Autocomplete & Smart Assist State
    const [merchantSuggestions, setMerchantSuggestions] = useState<string[]>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [activeRule, setActiveRule] = useState<TransactionRule | null>(null);
    const wrapperRef = useRef<HTMLDivElement>(null);
    
    // Recurring Action Modal State
    const [showRecurringModal, setShowRecurringModal] = useState(false);
    const [pendingAction, setPendingAction] = useState<'update' | 'delete' | null>(null);

    useEffect(() => {
        const fetchData = async () => {
            const { data: groupData } = await supabase.from('budget_groups').select('*, categories:budget_categories(*)').order('sort_order');
            if (groupData) setBudgetGroups(groupData);

            const { data: rulesData } = await supabase.from('transaction_rules').select('*').eq('is_active', true);
            if (rulesData) setRules(rulesData);

            // Fetch distinct merchants for autocomplete - Increased limit to 5000
            const { data: txnData } = await supabase.from('transactions')
                .select('merchant')
                .neq('merchant', null)
                .limit(5000);
                
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

    // --- Smart Assist Rule Logic (Pill Visibility) ---
    useEffect(() => {
        if (!merchant && !amount) {
            setActiveRule(null);
            return;
        }

        const numAmount = parseFloat(amount);
        
        // Find a rule that matches conditions
        const found = rules.find(rule => {
            return rule.conditions.every(cond => {
                let testVal: string | number = '';
                // Map fields to current form state for condition checking
                if (cond.field === 'merchant') testVal = merchant.toLowerCase();
                else if (cond.field === 'name') testVal = name.toLowerCase();
                else if (cond.field === 'amount') testVal = isNaN(numAmount) ? 0 : numAmount;
                else if (cond.field === 'original_statement') testVal = (transaction?.original_statement || '').toLowerCase();
                else if (cond.field === 'category') testVal = category.toLowerCase();

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

        // Determine if the found rule is "Satisfied" (Actions match current state)
        // If satisfied, we don't need to show the pill.
        let isSatisfied = false;
        if (found) {
            isSatisfied = found.actions.every(action => {
                if (action.type === 'rename_merchant') return merchant === action.value;
                if (action.type === 'update_note') return notes === action.value;
                if (action.type === 'set_status') return status === action.value;
                if (action.type === 'set_category') return category === action.value;
                return true;
            });
        }

        if (found && !isSatisfied) {
            setActiveRule(found);
        } else {
            setActiveRule(null);
        }

    }, [merchant, name, amount, category, notes, status, rules, transaction]);

    const applySmartRule = () => {
        if (!activeRule) return;

        activeRule.actions.forEach(action => {
            if (action.type === 'rename_merchant') {
                setMerchant(action.value);
            } else if (action.type === 'update_note') {
                setNotes(action.value);
            } else if (action.type === 'set_status') {
                setStatus(action.value as TransactionStatus);
            } else if (action.type === 'set_category') {
                // Find group for this category
                const targetCatName = action.value;
                const targetGroup = budgetGroups.find(g => g.categories.some(c => c.name === targetCatName));
                
                if (targetGroup) {
                    setGroup(targetGroup.name);
                    setCategory(targetCatName);
                    // Also switch the transaction type to match the group
                    if (targetGroup.type === 'income' || targetGroup.type === 'expense' || targetGroup.type === 'goal') {
                        setType(targetGroup.type);
                    }
                }
            }
        });
        // The useEffect above will automatically hide the pill because the state now satisfies the rule
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

    const triggerSubmit = async (action: 'update' | 'delete') => {
        // Check if this is an EXISTING recurring transaction
        if (transaction?.id && transaction?.is_recurring && transaction.recurrence_id) {
            setPendingAction(action);
            setShowRecurringModal(true);
        } else {
            // Standard action (Create New OR Edit Single Non-Recurring)
            if (action === 'delete') await executeDelete('single');
            else await executeSave('single');
        }
    };

    // SNAPSHOT INVALIDATION HELPER
    const invalidateSnapshots = async (txnDateStr: string) => {
        try {
            const monthKey = txnDateStr.substring(0, 7); // YYYY-MM
            await supabase.from('monthly_snapshots').delete().gte('month', monthKey);
        } catch (e) {
            console.warn("Snapshot invalidation failed (non-critical)", e);
        }
    };

    const executeDelete = async (scope: 'single' | 'future') => {
        setLoading(true);
        try {
            if (scope === 'single' || !transaction?.recurrence_id) {
                await supabase.from('transactions').delete().eq('id', transaction!.id);
            } else {
                await supabase.from('transactions')
                    .delete()
                    .eq('recurrence_id', transaction.recurrence_id)
                    .gte('transaction_date', transaction.transaction_date);
            }
            // Invalidate snapshots for affected period
            if (transaction) {
                await invalidateSnapshots(transaction.transaction_date);
            }
            onSuccess();
        } catch (error) {
            console.error(error);
            alert('Failed to delete');
        } finally {
            setLoading(false);
        }
    };

    const executeSave = async (scope: 'single' | 'future') => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            setLoading(false);
            return;
        }

        const finalAmount = parseFloat(amount) * (type === 'income' ? 1 : -1);

        const baseTxn: Transaction = {
            user_id: user.id,
            name: name || merchant, // Default name to merchant if empty
            merchant: merchant,
            amount: finalAmount,
            transaction_date: date,
            type,
            status: status as any,
            budget_group: group || null,
            category: category || null,
            notes,
            is_recurring: isRecurring,
            recur_frequency: isRecurring ? Number(freq) : undefined,
            recur_period: isRecurring ? period : undefined,
            recur_end_date: isRecurring && endDate ? endDate : undefined,
            
            // Preserve original automatic data
            source: transaction?.source || 'manual',
            original_statement: transaction?.original_statement,
            account_id: transaction?.account_id
        };

        try {
            if (transaction?.id) {
                // --- UPDATING EXISTING TRANSACTION ---
                if (!transaction.is_recurring && isRecurring) {
                    const newRecurrenceId = uuidv4();
                    baseTxn.recurrence_id = newRecurrenceId;
                    await supabase.from('transactions').update(baseTxn).eq('id', transaction.id);
                    const series = generateRecurringSeries(baseTxn, newRecurrenceId);
                    const futureRows = series.slice(1);
                    if (futureRows.length > 0) {
                        await supabase.from('transactions').insert(futureRows);
                    }
                } 
                else if (transaction.is_recurring && isRecurring) {
                    if (scope === 'single') {
                        await supabase.from('transactions').update(baseTxn).eq('id', transaction.id);
                    } else {
                        const recurId = transaction.recurrence_id!;
                        baseTxn.recurrence_id = recurId;
                        await supabase.from('transactions').update(baseTxn).eq('id', transaction.id);
                        await supabase.from('transactions')
                            .delete()
                            .eq('recurrence_id', recurId)
                            .gt('transaction_date', transaction.transaction_date);
                        const series = generateRecurringSeries(baseTxn, recurId);
                        const futureRows = series.slice(1);
                        if (futureRows.length > 0) {
                            await supabase.from('transactions').insert(futureRows);
                        }
                    }
                }
                else if (transaction.is_recurring && !isRecurring) {
                     const { recurrence_id, recur_frequency, recur_period, recur_end_date, ...nonRecur } = baseTxn;
                     await supabase.from('transactions').update({
                         ...nonRecur, 
                         is_recurring: false,
                         recurrence_id: null,
                         recur_frequency: null,
                         recur_period: null,
                         recur_end_date: null
                     }).eq('id', transaction.id);
                     if (transaction.recurrence_id) {
                        await supabase.from('transactions')
                            .delete()
                            .eq('recurrence_id', transaction.recurrence_id)
                            .eq('status', 'expected')
                            .gt('transaction_date', transaction.transaction_date);
                     }
                }
                else {
                    await supabase.from('transactions').update(baseTxn).eq('id', transaction.id);
                }

                // Invalidate snapshots
                await invalidateSnapshots(transaction.transaction_date);
                if (transaction.transaction_date !== date) {
                    await invalidateSnapshots(date);
                }

            } else {
                // --- CREATING NEW TRANSACTION ---
                if (isRecurring) {
                    const series = generateRecurringSeries(baseTxn);
                    await supabase.from('transactions').insert(series);
                } else {
                    await supabase.from('transactions').insert([baseTxn]);
                }

                // Invalidate snapshots
                await invalidateSnapshots(date);

                // --- SMART ASSIST BANNER LOGIC (GLOBAL) ---
                if (merchant && merchant.length > 1) {
                    const normalizedMerchant = merchant.trim().toLowerCase();
                    const numAmount = Math.abs(finalAmount);

                    // Check if a rule exists for this transaction
                    const matchedRule = rules.find(rule => {
                        return rule.conditions.every(cond => {
                            let testVal: string | number = '';
                            if (cond.field === 'merchant') testVal = normalizedMerchant;
                            else if (cond.field === 'name') testVal = name.toLowerCase();
                            else if (cond.field === 'amount') testVal = numAmount;
                            
                            const condVal = typeof cond.value === 'string' ? cond.value.toLowerCase() : cond.value;
                            
                            switch (cond.operator) {
                                case 'is': return testVal === condVal;
                                case 'contains': return String(testVal).includes(String(condVal));
                                default: return false; 
                            }
                        });
                    });

                    if (!matchedRule) {
                        // NO RULE EXISTS -> Candidate for creation
                        setRuleCandidate({ ...baseTxn, candidate_type: 'missing' });
                    } else {
                        // RULE EXISTS -> Check if user followed it (Satisfaction check)
                        const isSatisfied = matchedRule.actions.every(action => {
                            if (action.type === 'rename_merchant') return merchant === action.value;
                            if (action.type === 'update_note') return notes === action.value;
                            if (action.type === 'set_status') return status === action.value;
                            if (action.type === 'set_category') return category === action.value;
                            return true;
                        });

                        if (!isSatisfied) {
                            // RULE EXISTS BUT CONFLICT -> Candidate for update
                            setRuleCandidate({ ...baseTxn, candidate_type: 'conflict' });
                        }
                    }
                }
            }
            onSuccess();
        } catch (error) {
            console.error('Error saving:', error);
            alert('Failed to save transaction');
        } finally {
            setLoading(false);
        }
    };

    const currentGroup = budgetGroups.find(g => g.name === group);
    
    // Filter groups based on selected Type
    const filteredGroups = budgetGroups.filter(g => g.type === type);

    // Form Validity Check
    const isFormValid = merchant.trim().length > 0 && 
                        amount.length > 0 && 
                        !isNaN(parseFloat(amount)) && 
                        parseFloat(amount) !== 0 && 
                        group.length > 0 && 
                        category.length > 0;

    const typeColors = {
        income: {
            active: 'border-relief-primary/50 bg-relief-primary/10 text-relief-primary',
            inactive: 'border-white/10 text-relief-text-secondary hover:text-relief-primary'
        },
        expense: {
            active: 'border-relief-critical/50 bg-relief-critical/10 text-relief-critical',
            inactive: 'border-white/10 text-relief-text-secondary hover:text-relief-critical'
        },
        goal: {
            active: 'border-relief-action/50 bg-relief-action/10 text-relief-action',
            inactive: 'border-white/10 text-relief-text-secondary hover:text-relief-action'
        },
        transfer: {
            active: 'border-relief-magic/50 bg-relief-magic/10 text-relief-magic',
            inactive: 'border-white/10 text-relief-text-secondary hover:text-relief-magic'
        }
    };

    if (showRecurringModal) {
        return (
            <div className="space-y-4">
                <h3 className="text-lg font-bold text-white text-center">Recurring Transaction</h3>
                <p className="text-sm text-slate-400 text-center">
                    Do you want to {pendingAction} this transaction only, or this and all future occurrences?
                </p>
                <div className="flex flex-col gap-3 mt-4">
                    <Button onClick={() => pendingAction === 'delete' ? executeDelete('single') : executeSave('single')}>
                        {pendingAction === 'delete' ? 'Delete' : 'Edit'} This Transaction Only
                    </Button>
                    <Button variant="secondary" onClick={() => pendingAction === 'delete' ? executeDelete('future') : executeSave('future')}>
                        {pendingAction === 'delete' ? 'Delete' : 'Edit'} This & Future Transactions
                    </Button>
                    <Button variant="ghost" onClick={() => setShowRecurringModal(false)}>Cancel</Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-5 pb-20">
            {/* --- AUTO-SYNC CONTEXT HEADER --- */}
            {transaction?.source === 'automatic' && transaction.original_statement && (
                <div className="p-3 mb-2 rounded-xl bg-slate-800 border border-white/5 flex items-start gap-3">
                    <Info className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    <div>
                        <div className="text-[10px] font-bold uppercase text-slate-500">Original Statement</div>
                        <div className="text-xs text-slate-300 font-mono mt-1 leading-relaxed break-words">
                            {transaction.original_statement}
                        </div>
                    </div>
                </div>
            )}

            <div>
                <label className="text-[10px] uppercase font-bold text-slate-500 ml-1">Type</label>
                <div className="grid grid-cols-4 gap-2 mt-1">
                    {(['income', 'expense', 'goal', 'transfer'] as const).map(t => (
                        <button
                            key={t}
                            onClick={() => {
                                setType(t);
                                // Reset group/category if they don't match the new type (unless it's transfer which has no groups usually)
                                if (group) {
                                    const g = budgetGroups.find(bg => bg.name === group);
                                    if (g && g.type !== t) {
                                        setGroup('');
                                        setCategory('');
                                    }
                                }
                            }}
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
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Merchant <span className="text-relief-critical">*</span></label>
                    <div className="relative" ref={wrapperRef}>
                        <input 
                            placeholder="e.g. Starbucks" 
                            value={merchant} 
                            onChange={handleMerchantChange}
                            onFocus={() => { if(merchant.length > 1 && merchantSuggestions.length > 0) setShowSuggestions(true); }}
                            className="w-full p-4 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none"
                        />
                        {showSuggestions && (
                            <div className="absolute top-full left-0 right-0 mt-1 bg-relief-surface border border-relief-border rounded-xl shadow-xl z-50 overflow-hidden">
                                {merchantSuggestions.map(s => (
                                    <button
                                        key={s}
                                        onClick={() => selectSuggestion(s)}
                                        className="w-full text-left px-4 py-3 text-sm text-relief-text-secondary hover:bg-white/5 hover:text-relief-text-primary border-b border-white/5 last:border-0"
                                    >
                                        {s}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Smart Assist Pill - Shows 'Apply Smart Assist' if a rule matches but form is different */}
                {activeRule && (
                    <div className="p-3 rounded-xl bg-relief-magic/10 border border-relief-magic/30 flex items-center justify-between animate-fade-in">
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Sparkles className="w-4 h-4 text-relief-magic shrink-0" />
                            <div className="flex flex-col overflow-hidden">
                                <span className="text-[10px] font-bold uppercase text-relief-magic">Smart Assist</span>
                                <span className="text-xs text-indigo-200 truncate pr-2">
                                    Apply "{activeRule.name}"?
                                </span>
                            </div>
                        </div>
                        <button 
                            onClick={applySmartRule}
                            className="shrink-0 px-3 py-1.5 rounded-lg bg-relief-magic text-white text-[10px] font-bold uppercase tracking-wider hover:bg-relief-magic/80 transition-colors flex items-center gap-1"
                        >
                            Apply <ArrowRight className="w-3 h-3" />
                        </button>
                    </div>
                )}

                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Description (Optional)</label>
                    <input 
                        placeholder="Description / Item Name" 
                        value={name} 
                        onChange={e => setName(e.target.value)}
                        className="w-full p-4 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none"
                    />
                </div>
                
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Amount <span className="text-relief-critical">*</span></label>
                    <div className="flex items-center gap-2 p-4 border bg-relief-bg rounded-xl border-relief-border focus-within:border-relief-primary/50">
                        <span className="font-bold text-relief-text-secondary">$</span>
                        <input 
                            type="number" 
                            step="0.01" 
                            placeholder="0.00" 
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            className="w-full text-lg font-bold text-relief-text-primary bg-transparent outline-none"
                        />
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <div className="min-w-0">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Date</label>
                    <input 
                        type="date" 
                        value={date} 
                        onChange={e => setDate(e.target.value)}
                        className="w-full h-[46px] px-3 mt-1 text-sm text-relief-text-primary border bg-relief-bg border-relief-border rounded-xl focus:border-relief-primary/50 outline-none appearance-none"
                    />
                </div>
                <div className="min-w-0">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Status</label>
                    <select 
                        value={status} 
                        onChange={e => setStatus(e.target.value as any)}
                        className="w-full h-[46px] px-3 mt-1 text-sm text-relief-text-primary border bg-relief-bg border-relief-border rounded-xl focus:border-relief-primary/50 outline-none"
                    >
                        <option value="cleared">Cleared</option>
                        <option value="pending">Pending</option>
                        <option value="expected">Expected</option>
                        <option value="skipped">Skipped</option>
                    </select>
                </div>
            </div>

            <div className="pt-2 space-y-4 border-t border-white/5">
                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Budget Group <span className="text-relief-critical">*</span></label>
                    <select 
                        value={group} 
                        onChange={e => { setGroup(e.target.value); setCategory(''); }}
                        className="w-full p-4 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none"
                    >
                        <option value="">-- Select Group --</option>
                        {filteredGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
                    </select>
                </div>

                <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Category <span className="text-relief-critical">*</span></label>
                    <select 
                        value={category} 
                        onChange={e => setCategory(e.target.value)}
                        disabled={!group}
                        className="w-full p-4 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none disabled:opacity-50"
                    >
                        <option value="">-- Select Category --</option>
                        {currentGroup?.categories.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                    </select>
                </div>
            </div>

            {/* Recurring Settings - Show if it's a new txn OR if we are converting existing one */}
            {(!transaction || (transaction && !transaction.is_recurring)) && (
                <div className="p-4 border border-white/5 rounded-xl bg-white/5">
                    <div className="flex items-center gap-3">
                        <input 
                            type="checkbox" 
                            checked={isRecurring} 
                            onChange={e => setIsRecurring(e.target.checked)}
                            className="w-5 h-5 text-emerald-400 rounded bg-slate-700 border-white/20 focus:ring-0"
                        />
                        <label className="text-sm font-bold text-white">Recurring Transaction</label>
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
            
            {/* Show recurring badge/info if editing an existing recurring txn */}
            {transaction && transaction.is_recurring && (
                 <div className="p-4 border border-relief-primary/20 rounded-xl bg-relief-primary/5">
                     <p className="text-xs text-relief-primary font-bold uppercase tracking-widest text-center">
                         Recurring: Every {transaction.recur_frequency} {transaction.recur_period}
                     </p>
                 </div>
            )}

            <div className="flex gap-3 pt-4 border-t border-white/5">
                {transaction && (
                    <Button variant="danger" onClick={() => triggerSubmit('delete')} disabled={loading}>
                        Delete
                    </Button>
                )}
                <Button variant="secondary" onClick={onCancel} className="flex-1" disabled={loading}>
                    Cancel
                </Button>
                <Button onClick={() => triggerSubmit('update')} disabled={loading || !isFormValid} className="flex-[2]">
                    {loading ? 'Saving...' : 'Save'}
                </Button>
            </div>
            
            {/* Validation Message */}
            {!isFormValid && (
                <p className="text-[10px] text-red-400 text-center font-bold mt-3 animate-fade-in">
                    Please fill out all required fields to save.
                </p>
            )}
        </div>
    );
};