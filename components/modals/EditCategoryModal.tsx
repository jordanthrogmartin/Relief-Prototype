import React, { useState, useEffect } from 'react';
import { BudgetCategory } from '../../types';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { parseCategoryName } from '../../utils/emojiUtils';
import EmojiPicker, { Theme, EmojiClickData } from 'emoji-picker-react';

interface EditCategoryModalProps {
    isOpen: boolean;
    onClose: () => void;
    category: BudgetCategory | null;
    onSave: (name: string, emoji: string, isFixed: boolean) => Promise<void>;
    onDelete: () => void;
}

export const EditCategoryModal: React.FC<EditCategoryModalProps> = ({ isOpen, onClose, category, onSave, onDelete }) => {
    const [name, setName] = useState('');
    const [emoji, setEmoji] = useState('');
    const [isFixed, setIsFixed] = useState(true);
    const [showEmojiPicker, setShowEmojiPicker] = useState(false);

    useEffect(() => {
        if (isOpen) {
            if (category) {
                const { emoji: e, name: n } = parseCategoryName(category.name);
                setName(n);
                setEmoji(e);
                setIsFixed(category.is_fixed);
            } else {
                setName('');
                setEmoji('');
                setIsFixed(true);
            }
            setShowEmojiPicker(false);
        }
    }, [isOpen, category]);

    const handleSave = () => {
        if (!emoji) {
            alert("Please select an icon for this category.");
            return;
        }
        onSave(name, emoji, isFixed);
    };

    const onEmojiClick = (emojiData: EmojiClickData) => {
        setEmoji(emojiData.emoji);
        setShowEmojiPicker(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={category ? "Edit Category" : "New Category"}>
            <div className="space-y-4">
                <div className="flex gap-3">
                    <div className="w-16">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Icon</label>
                        <button 
                            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
                            className="w-full h-[60px] mt-1 text-2xl flex items-center justify-center text-white border rounded-xl bg-slate-800/50 border-white/10 outline-none hover:bg-white/5 transition-colors"
                        >
                            {emoji || <span className="text-slate-600">?</span>}
                        </button>
                    </div>
                    <div className="flex-1">
                        <label className="text-[10px] uppercase font-bold text-slate-500">Name</label>
                        <input 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full p-4 mt-1 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 outline-none"
                        />
                    </div>
                </div>

                {showEmojiPicker && (
                    <div className="p-2 bg-slate-900/80 rounded-xl border border-white/10 flex flex-col items-center">
                        <EmojiPicker 
                            theme={Theme.DARK}
                            onEmojiClick={onEmojiClick}
                            width="100%"
                            height={350}
                            searchDisabled={false}
                            skinTonesDisabled
                            previewConfig={{ showPreview: false }}
                        />
                    </div>
                )}

                <div className="flex gap-2">
                    <button 
                        onClick={() => setIsFixed(true)}
                        className={`px-4 py-2 rounded text-xs font-bold ${isFixed ? 'bg-emerald-400 text-emerald-950' : 'bg-slate-800 text-slate-500'}`}
                    >
                        Fixed
                    </button>
                    <button 
                        onClick={() => setIsFixed(false)}
                        className={`px-4 py-2 rounded text-xs font-bold ${!isFixed ? 'bg-slate-600 text-white' : 'bg-slate-800 text-slate-500'}`}
                    >
                        Variable
                    </button>
                </div>
                <div className="flex gap-3 pt-4 border-t border-white/10 mt-4">
                    {category && (
                        <button onClick={onDelete} className="text-xs font-bold text-red-400 hover:text-red-300 uppercase tracking-wider px-2">
                            Delete Category
                        </button>
                    )}
                    <div className="flex-1"></div>
                    <Button variant="secondary" onClick={onClose}>Cancel</Button>
                    <Button onClick={handleSave}>Save</Button>
                </div>
            </div>
        </Modal>
    );
};
