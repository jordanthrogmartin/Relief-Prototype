import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Zap, Trash2, ArrowRight, X } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { TransactionRule, RuleCondition, RuleAction, BudgetGroup, RuleField, ActionType } from '../../types';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';

// --- UI Components for the Rule Editor ---

const Toggle = ({ checked, onChange }: { checked: boolean, onChange: () => void }) => (
    <div 
        onClick={onChange}
        className={`w-10 h-6 rounded-full relative cursor-pointer transition-colors duration-200 ${checked ? 'bg-emerald-400' : 'bg-slate-600'}`}
    >
        <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow-sm transition-transform duration-200 ${checked ? 'translate-x-5' : 'translate-x-1'}`} />
    </div>
);

export const RulesSettings: React.FC = () => {
    const navigate = useNavigate();
    const [rules, setRules] = useState<TransactionRule[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<TransactionRule | null>(null);
    const [name, setName] = useState('');
    
    // Conditions & Actions Arrays
    const [conditions, setConditions] = useState<RuleCondition[]>([]);
    const [actions, setActions] = useState<RuleAction[]>([]);
    
    // Helper Data
    const [groups, setGroups] = useState<BudgetGroup[]>([]);
    const [confirmDelete, setConfirmDelete] = useState(false);

    useEffect(() => {
        fetchRules();
        fetchGroups();
    }, []);

    const fetchRules = async () => {
        const { data } = await supabase.from('transaction_rules').select('*').order('created_at', { ascending: false });
        if (data) setRules(data);
        setLoading(false);
    };

    const fetchGroups = async () => {
        const { data } = await supabase.from('budget_groups').select('*, categories:budget_categories(*)');
        if (data) setGroups(data);
    };

    const handleOpenModal = (rule?: TransactionRule) => {
        setConfirmDelete(false);
        if (rule) {
            setEditingRule(rule);
            setName(rule.name);
            setConditions(rule.conditions || []);
            setActions(rule.actions || []);
        } else {
            setEditingRule(null);
            setName('');
            setConditions([]);
            setActions([]);
        }
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!name) {
            alert("Please give the rule a name.");
            return;
        }
        if (conditions.length === 0 || actions.length === 0) {
            alert("Rules must have at least one condition and one action.");
            return;
        }

        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const payload = {
            user_id: user.id,
            name,
            conditions,
            actions,
            is_active: true
        };

        if (editingRule) {
            const { error } = await supabase.from('transaction_rules').update(payload).eq('id', editingRule.id);
            if (error) alert(error.message);
        } else {
            const { error } = await supabase.from('transaction_rules').insert(payload);
            if (error) alert(error.message);
        }

        setIsModalOpen(false);
        fetchRules();
    };

    const handleDelete = async () => {
        if (!editingRule) return;
        await supabase.from('transaction_rules').delete().eq('id', editingRule.id);
        setIsModalOpen(false);
        fetchRules();
    };

    // --- Core Logic for Toggling Conditions/Actions ---

    const toggleCondition = (field: RuleField) => {
        const exists = conditions.find(c => c.field === field);
        if (exists) {
            setConditions(prev => prev.filter(c => c.field !== field));
        } else {
            // Default new condition values based on type
            let operator: any = 'contains';
            let value: any = '';
            
            if (field === 'amount') { operator = 'eq'; value = 0; }
            if (field === 'category') { operator = 'is'; }
            
            setConditions(prev => [...prev, { field, operator, value }]);
        }
    };

    const updateCondition = (field: RuleField, key: keyof RuleCondition, value: any) => {
        setConditions(prev => prev.map(c => c.field === field ? { ...c, [key]: value } : c));
    };

    const toggleAction = (type: ActionType) => {
        const exists = actions.find(a => a.type === type);
        if (exists) {
            setActions(prev => prev.filter(a => a.type !== type));
        } else {
            setActions(prev => [...prev, { type, value: '' }]);
        }
    };

    const updateAction = (type: ActionType, value: any) => {
        setActions(prev => prev.map(a => a.type === type ? { ...a, value } : a));
    };

    // --- Render Helpers ---

    const renderCategoryOptions = () => {
        const incomeCats = groups.filter(g => g.type === 'income').flatMap(g => g.categories);
        const expenseCats = groups.filter(g => g.type === 'expense').flatMap(g => g.categories);
        const goalCats = groups.filter(g => g.type === 'goal').flatMap(g => g.categories);

        return (
            <>
                <option value="">-- Select --</option>
                {incomeCats.length > 0 && <optgroup label="Income">{incomeCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
                {expenseCats.length > 0 && <optgroup label="Expenses">{expenseCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
                {goalCats.length > 0 && <optgroup label="Goals">{goalCats.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}</optgroup>}
            </>
        );
    };

    const AVAILABLE_CONDITIONS: { key: RuleField, label: string, type: 'text' | 'number' | 'select' }[] = [
        { key: 'original_statement', label: 'Original Statement', type: 'text' },
        { key: 'merchant', label: 'Merchant Name', type: 'text' },
        { key: 'amount', label: 'Amount', type: 'number' },
        { key: 'category', label: 'Category', type: 'select' },
        { key: 'account_id', label: 'Account Name', type: 'text' } // Using text match for simplicity as requested
    ];

    const AVAILABLE_ACTIONS: { key: ActionType, label: string, type: 'text' | 'select' | 'status' }[] = [
        { key: 'rename_merchant', label: 'Rename Merchant', type: 'text' },
        { key: 'set_category', label: 'Update Category', type: 'select' },
        { key: 'set_status', label: 'Set Status', type: 'status' }
    ];

    return (
        <div className="space-y-6 pt-4 px-4 animate-fade-in pb-24">
            <header className="px-2 flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40">
                    <ChevronLeft className="w-4 h-4 text-relief-text-secondary" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold italic text-relief-primary">Rules</h1>
                    <p className="text-relief-text-secondary text-[10px] uppercase tracking-widest font-bold">Automation Logic</p>
                </div>
            </header>

            <div className="px-2">
                <Button onClick={() => handleOpenModal()} variant="secondary" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" fullWidth>
                    + Add New Rule
                </Button>
            </div>

            {/* Rules List */}
            <div className="px-2 space-y-4">
                {rules.length === 0 && !loading && (
                    <div className="p-6 text-center bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl">
                        <Zap className="w-8 h-8 text-relief-text-secondary mx-auto mb-2" />
                        <p className="text-sm text-relief-text-secondary">No rules set up yet.</p>
                    </div>
                )}

                {rules.map(rule => (
                    <div 
                        key={rule.id} 
                        onClick={() => handleOpenModal(rule)}
                        className="p-4 rounded-2xl bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 hover:bg-relief-surface cursor-pointer transition-colors group"
                    >
                        <div className="flex justify-between items-start mb-2">
                            <h3 className="font-bold text-relief-text-primary group-hover:text-relief-primary">{rule.name}</h3>
                            <div className={`w-2 h-2 rounded-full ${rule.is_active ? 'bg-relief-primary' : 'bg-relief-text-secondary'}`} />
                        </div>
                        <div className="space-y-1">
                            <div className="flex flex-wrap gap-1">
                                {rule.conditions.map((c, i) => (
                                    <span key={i} className="text-[10px] bg-relief-bg text-relief-text-secondary px-1.5 py-0.5 rounded border border-relief-border">
                                        {c.field === 'original_statement' ? 'Statement' : c.field} {c.operator === 'eq' ? '=' : c.operator} {c.value}
                                    </span>
                                ))}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                                <ArrowRight className="w-3 h-3 text-relief-text-secondary" />
                                <div className="flex flex-wrap gap-1">
                                    {rule.actions.map((a, i) => (
                                        <span key={i} className="text-[10px] bg-relief-primary/10 text-relief-primary px-1.5 py-0.5 rounded border border-relief-primary/20">
                                            {a.type.replace('_', ' ')}: {a.value}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Add/Edit Modal */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={editingRule ? "Edit Rule" : "New Rule"}>
                <div className="space-y-6">
                    {confirmDelete ? (
                        <div className="space-y-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-center animate-fade-in">
                            <p className="text-sm font-bold text-red-200">Delete this rule?</p>
                            <div className="flex gap-2 justify-center">
                                <Button variant="secondary" onClick={() => setConfirmDelete(false)}>Cancel</Button>
                                <Button variant="danger" onClick={handleDelete}>Confirm</Button>
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-1">
                                <label className="text-[10px] uppercase font-bold text-slate-500">Rule Name</label>
                                <input 
                                    value={name}
                                    onChange={e => setName(e.target.value)}
                                    placeholder="e.g. Starbucks Categorization"
                                    className="w-full p-3 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 outline-none focus:border-emerald-500/50"
                                />
                            </div>

                            {/* CONDITIONS BLOCK */}
                            <div className="space-y-3">
                                <div className="text-[10px] uppercase font-bold text-slate-500 border-b border-white/5 pb-1">
                                    Conditions (Match ALL)
                                </div>
                                <div className="space-y-2">
                                    {AVAILABLE_CONDITIONS.map((def) => {
                                        const activeCondition = conditions.find(c => c.field === def.key);
                                        const isActive = !!activeCondition;

                                        return (
                                            <div key={def.key} className={`rounded-xl border transition-colors duration-200 ${isActive ? 'bg-slate-800 border-emerald-500/30' : 'bg-slate-800/30 border-white/5'}`}>
                                                <div className="flex items-center justify-between p-3">
                                                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>{def.label}</span>
                                                    <Toggle checked={isActive} onChange={() => toggleCondition(def.key)} />
                                                </div>
                                                
                                                {isActive && activeCondition && (
                                                    <div className="px-3 pb-3 pt-0 flex gap-2 animate-fade-in">
                                                        <select 
                                                            value={activeCondition.operator}
                                                            onChange={e => updateCondition(def.key, 'operator', e.target.value)}
                                                            className="w-1/3 p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none"
                                                        >
                                                            <option value="contains">Contains</option>
                                                            <option value="is">Is Exactly</option>
                                                            <option value="starts_with">Starts With</option>
                                                            <option value="eq">Equals</option>
                                                            <option value="gt">Greater Than</option>
                                                            <option value="lt">Less Than</option>
                                                        </select>
                                                        
                                                        {def.type === 'select' ? (
                                                            <select
                                                                value={activeCondition.value}
                                                                onChange={e => updateCondition(def.key, 'value', e.target.value)}
                                                                className="flex-1 p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none"
                                                            >
                                                                {renderCategoryOptions()}
                                                            </select>
                                                        ) : (
                                                            <input 
                                                                type={def.type === 'number' ? 'number' : 'text'}
                                                                value={activeCondition.value}
                                                                onChange={e => updateCondition(def.key, 'value', e.target.value)}
                                                                placeholder="Value..."
                                                                className="flex-1 p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* ACTIONS BLOCK */}
                            <div className="space-y-3">
                                <div className="text-[10px] uppercase font-bold text-emerald-500 border-b border-white/5 pb-1">
                                    Actions (Apply ALL)
                                </div>
                                <div className="space-y-2">
                                    {AVAILABLE_ACTIONS.map((def) => {
                                        const activeAction = actions.find(a => a.type === def.key);
                                        const isActive = !!activeAction;

                                        return (
                                            <div key={def.key} className={`rounded-xl border transition-colors duration-200 ${isActive ? 'bg-emerald-900/10 border-emerald-500/30' : 'bg-slate-800/30 border-white/5'}`}>
                                                <div className="flex items-center justify-between p-3">
                                                    <span className={`text-xs font-bold ${isActive ? 'text-white' : 'text-slate-400'}`}>{def.label}</span>
                                                    <Toggle checked={isActive} onChange={() => toggleAction(def.key)} />
                                                </div>
                                                
                                                {isActive && activeAction && (
                                                    <div className="px-3 pb-3 pt-0 animate-fade-in">
                                                        {def.type === 'select' ? (
                                                            <select
                                                                value={activeAction.value}
                                                                onChange={e => updateAction(def.key, e.target.value)}
                                                                className="w-full p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none"
                                                            >
                                                                {renderCategoryOptions()}
                                                            </select>
                                                        ) : def.type === 'status' ? (
                                                            <select
                                                                value={activeAction.value}
                                                                onChange={e => updateAction(def.key, e.target.value)}
                                                                className="w-full p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none"
                                                            >
                                                                <option value="">-- Select Status --</option>
                                                                <option value="cleared">Cleared</option>
                                                                <option value="pending">Pending</option>
                                                                <option value="expected">Expected</option>
                                                            </select>
                                                        ) : (
                                                            <input 
                                                                value={activeAction.value}
                                                                onChange={e => updateAction(def.key, e.target.value)}
                                                                placeholder="Value..."
                                                                className="w-full p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none"
                                                            />
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-white/10">
                                {editingRule && (
                                    <Button variant="danger" onClick={() => setConfirmDelete(true)}>Delete</Button>
                                )}
                                <Button variant="secondary" onClick={() => setIsModalOpen(false)} className="flex-1">Cancel</Button>
                                <Button onClick={handleSave} className="flex-1">Save Rule</Button>
                            </div>
                        </>
                    )}
                </div>
            </Modal>
        </div>
    );
};