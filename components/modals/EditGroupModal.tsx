import React, { useState, useEffect } from 'react';
import { BudgetGroup } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';

interface EditGroupModalProps {
    isOpen: boolean;
    onClose: () => void;
    group: BudgetGroup | null;
    onSave: (name: string, type: 'income' | 'expense' | 'goal') => Promise<void>;
    onDelete: () => void;
}

export const EditGroupModal: React.FC<EditGroupModalProps> = ({ isOpen, onClose, group, onSave, onDelete }) => {
    const [name, setName] = useState('');
    const [type, setType] = useState<'income' | 'expense' | 'goal'>('expense');

    useEffect(() => {
        if (isOpen) {
            if (group) {
                setName(group.name);
                setType(group.type as any);
            } else {
                setName('');
                setType('expense');
            }
        }
    }, [isOpen, group]);

    const handleSave = () => {
        onSave(name, type);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={group ? "Edit Group" : "New Group"}>
            <div className="space-y-4">
                <input 
                    placeholder="Group Name" 
                    value={name}
                    onChange={e => setName(e.target.value)}
                    className="w-full p-4 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 outline-none"
                />
                <div className="flex gap-2">
                    <button 
                        onClick={() => setType('expense')}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase ${type === 'expense' ? 'bg-slate-700 text-white' : 'bg-slate-800 text-slate-500'}`}
                    >
                        Expense
                    </button>
                    <button 
                        onClick={() => setType('income')}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase ${type === 'income' ? 'bg-emerald-600/50 text-emerald-100' : 'bg-slate-800 text-slate-500'}`}
                    >
                        Income
                    </button>
                    <button 
                        onClick={() => setType('goal')}
                        className={`flex-1 py-3 rounded-lg text-xs font-bold uppercase ${type === 'goal' ? 'bg-blue-600/50 text-blue-100' : 'bg-slate-800 text-slate-500'}`}
                    >
                        Goal
                    </button>
                </div>
                <div className="flex gap-3 pt-4">
                    {group && <Button variant="danger" onClick={onDelete}>Delete</Button>}
                    <Button variant="secondary" onClick={onClose} className="flex-1">Cancel</Button>
                    <Button onClick={handleSave} className="flex-1">Save</Button>
                </div>
            </div>
        </Modal>
    );
};
