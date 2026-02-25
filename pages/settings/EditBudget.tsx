import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Menu } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { BudgetGroup, BudgetCategory } from '../../types';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { formatCategoryName } from '../../utils/emojiUtils';
import { EditGroupModal } from '../../components/modals/EditGroupModal';
import { EditCategoryModal } from '../../components/modals/EditCategoryModal';

export const EditBudgetSettings: React.FC = () => {
    const navigate = useNavigate();
    const [groups, setGroups] = useState<BudgetGroup[]>([]);
    
    // Modal State
    const [editingCategory, setEditingCategory] = useState<BudgetCategory | null>(null);
    const [editingGroup, setEditingGroup] = useState<BudgetGroup | null>(null);
    const [isGroupModalOpen, setIsGroupModalOpen] = useState(false);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    
    // Move Group Modal State
    const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);
    const [targetGroupId, setTargetGroupId] = useState('');

    // Confirmation Modal State
    const [confirmState, setConfirmState] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        onConfirm: () => void;
    }>({ isOpen: false, title: '', message: '', onConfirm: () => {} });

    // State for new category group selection
    const [selectedGroupId, setSelectedGroupId] = useState('');

    // Drag State
    const [draggedGroupIdx, setDraggedGroupIdx] = useState<number | null>(null);
    const [draggedCategory, setDraggedCategory] = useState<{groupId: string, catIndex: number} | null>(null);

    // Ghost State for Touch Drag
    const [dragGhost, setDragGhost] = useState<{
        x: number;
        y: number;
        type: 'group' | 'category';
        name: string;
        width: number;
    } | null>(null);

    useEffect(() => {
        fetchGroups();
    }, []);

    const fetchGroups = async () => {
        const { data } = await supabase.from('budget_groups').select('*, categories:budget_categories(*)').order('sort_order');
        if (data) {
            const sorted = data.map(g => ({
                ...g,
                categories: g.categories.sort((a, b) => a.sort_order - b.sort_order)
            }));
            setGroups(sorted);
        }
    };

    // --- Actions ---

    const handleAddGroup = () => {
        setEditingGroup(null);
        setIsGroupModalOpen(true);
    };

    const handleEditGroup = (g: BudgetGroup) => {
        setEditingGroup(g);
        setIsGroupModalOpen(true);
    };

    const handleAddCategory = (groupId: string) => {
        setEditingCategory(null);
        setSelectedGroupId(groupId);
        setIsCatModalOpen(true);
    };

    const handleEditCategory = (c: BudgetCategory) => {
        setEditingCategory(c);
        setIsCatModalOpen(true);
    };

    // --- Saves ---

    const saveGroup = async (name: string, type: 'income' | 'expense' | 'goal') => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        try {
            if (editingGroup) {
                const { error } = await supabase.from('budget_groups').update({ name, type }).eq('id', editingGroup.id);
                if (error) throw error;
            } else {
                const maxSort = groups.length > 0 ? Math.max(...groups.map(g => g.sort_order)) : 0;
                const { error } = await supabase.from('budget_groups').insert({
                    user_id: user.id,
                    name,
                    type,
                    sort_order: maxSort + 1
                });
                if (error) throw error;
            }
            setIsGroupModalOpen(false);
            fetchGroups();
        } catch (err: any) {
            console.error("Error saving group:", err);
            alert(`Failed to save group: ${err.message}`);
        }
    };

    // --- Delete Group Logic ---

    const handleDeleteGroupClick = () => {
        if (!editingGroup) return;
        
        if (editingGroup.categories.length > 0) {
            // Has categories: Prompt to move
            setConfirmState({
                isOpen: true,
                title: 'Delete Group',
                message: 'This action will delete the group. All categories in this group must be moved to another group before deleting.',
                onConfirm: () => {
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                    setTargetGroupId('');
                    setIsMoveModalOpen(true);
                }
            });
        } else {
            // Empty group: Simple delete
            setConfirmState({
                isOpen: true,
                title: 'Delete Group',
                message: 'Are you sure you want to delete this group?',
                onConfirm: async () => {
                    await performGroupDelete();
                    setConfirmState(prev => ({ ...prev, isOpen: false }));
                }
            });
        }
    };

    const performGroupDelete = async () => {
        try {
            const { error } = await supabase.from('budget_groups').delete().eq('id', editingGroup!.id);
            if (error) throw error;
            setIsGroupModalOpen(false);
            fetchGroups();
        } catch (err: any) {
            alert(`Failed to delete group: ${err.message}`);
        }
    }

    const performMoveAndDelete = async () => {
        if (!targetGroupId || !editingGroup) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            const targetGroup = groups.find(g => g.id === targetGroupId);
            if (!targetGroup) return;

            // 1. Move Categories
            await supabase.from('budget_categories')
                .update({ group_id: targetGroupId })
                .eq('group_id', editingGroup.id);

            // 2. Update Transactions (Old Group Name -> New Group Name)
            await supabase.from('transactions')
                .update({ budget_group: targetGroup.name })
                .eq('user_id', user?.id)
                .eq('budget_group', editingGroup.name);

            // 3. Delete Group
            await supabase.from('budget_groups').delete().eq('id', editingGroup.id);

            setIsMoveModalOpen(false);
            setIsGroupModalOpen(false);
            fetchGroups();

        } catch (err: any) {
            alert(`Error: ${err.message}`);
        }
    }

    // --- Delete Category Logic ---

    const saveCategory = async (name: string, emoji: string, isFixed: boolean) => {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("You must be logged in.");

            if (!name.trim()) {
                alert("Please enter a category name.");
                return;
            }

            const fullName = formatCategoryName(emoji, name);

            if (editingCategory) {
                // Update existing
                const { error } = await supabase.from('budget_categories').update({
                    name: fullName,
                    is_fixed: isFixed
                }).eq('id', editingCategory.id);
                
                if (error) throw error;

                // Update transactions if name changed
                if (editingCategory.name !== fullName) {
                    await supabase.from('transactions')
                        .update({ category: fullName })
                        .eq('user_id', user.id)
                        .eq('category', editingCategory.name);
                }

            } else {
                // Insert new
                if (!selectedGroupId) throw new Error("No group selected.");
                
                const group = groups.find(g => g.id === selectedGroupId);
                const maxSort = group && group.categories.length > 0 ? Math.max(...group.categories.map(c => c.sort_order)) : 0;
                
                const { error } = await supabase.from('budget_categories').insert({
                    user_id: user.id, // Essential for RLS
                    group_id: selectedGroupId,
                    name: fullName,
                    planned_amount: 0, 
                    is_fixed: isFixed,
                    sort_order: maxSort + 1
                });
                
                if (error) throw error;
            }
            setIsCatModalOpen(false);
            fetchGroups();
        } catch (err: any) {
            console.error("Error saving category:", err);
            alert(`Failed to save category: ${err.message}`);
        }
    };

    const handleDeleteCategoryClick = () => {
        if (!editingCategory) return;
        setConfirmState({
            isOpen: true,
            title: 'Delete Category',
            message: 'This action will delete the category. All transactions within this category will no longer be associated with any budget group or category.',
            onConfirm: performDeleteCategory
        });
    };

    const performDeleteCategory = async () => {
        if (!editingCategory) return;
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            
            // Find parent group to properly unassociate transactions
            const parentGroup = groups.find(g => g.categories.some(c => c.id === editingCategory.id));

            // 1. Unassociate transactions
            const query = supabase.from('transactions')
                .update({ category: null, budget_group: null })
                .eq('user_id', user?.id)
                .eq('category', editingCategory.name);
            
            // If we found the parent group, adding extra safety check on group name
            if (parentGroup) {
                query.eq('budget_group', parentGroup.name);
            }

            await query;

            // 2. Delete Category
            const { error } = await supabase.from('budget_categories').delete().eq('id', editingCategory.id);
            if (error) throw error;
            
            setConfirmState(prev => ({ ...prev, isOpen: false }));
            setIsCatModalOpen(false);
            fetchGroups();
        } catch (err: any) {
            alert(`Failed to delete category: ${err.message}`);
        }
    };

    // --- Drag and Drop (Mouse & Touch) ---

    // === GROUP DRAG ===
    const handleGroupDragStart = (e: React.DragEvent, index: number) => {
        setDraggedGroupIdx(index);
        setDraggedCategory(null);
        e.dataTransfer.effectAllowed = "move";
    };

    const handleGroupDragOver = (e: React.DragEvent, index: number) => {
        e.preventDefault();
        if (draggedGroupIdx === null || draggedGroupIdx === index) return;
        
        // Reorder locally immediately for visual feedback
        const newGroups = [...groups];
        const [movedGroup] = newGroups.splice(draggedGroupIdx, 1);
        newGroups.splice(index, 0, movedGroup);
        
        setGroups(newGroups);
        setDraggedGroupIdx(index);
    };

    // Touch Handlers for Groups (Shim for Mobile Drag)
    // We use a simple swap-on-move logic.
    // NOTE: This relies on the 'id' of the element to find index, or explicit index passing.
    
    // We store touch state here to avoid complex DOM lookup if possible, 
    // but we need to know WHICH item we are hovering over.
    const [touchDraggingGroupIdx, setTouchDraggingGroupIdx] = useState<number | null>(null);

    const handleGroupTouchStart = (e: React.TouchEvent, index: number) => {
        // e.preventDefault(); // Do NOT prevent default here or clicks won't work. prevent default on MOVE.
        setTouchDraggingGroupIdx(index);
        const touch = e.touches[0];
        const target = e.currentTarget.closest('[data-group-id]');
        if (target) {
            const rect = target.getBoundingClientRect();
            setDragGhost({
                x: touch.clientX,
                y: touch.clientY,
                type: 'group',
                name: groups[index].name,
                width: rect.width
            });
        }
    };

    const handleGroupTouchMove = (e: React.TouchEvent) => {
        if (touchDraggingGroupIdx === null) return;
        
        // Prevent scrolling while dragging
        if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        setDragGhost(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);

        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        
        if (!target) return;
        
        // Traverse up to find the group container with data-group-index
        const groupEl = target.closest('[data-group-index]');
        if (groupEl) {
            const hoverIndex = parseInt(groupEl.getAttribute('data-group-index') || '-1');
            if (hoverIndex !== -1 && hoverIndex !== touchDraggingGroupIdx) {
                // Swap logic
                const newGroups = [...groups];
                const [movedGroup] = newGroups.splice(touchDraggingGroupIdx, 1);
                newGroups.splice(hoverIndex, 0, movedGroup);
                setGroups(newGroups);
                setTouchDraggingGroupIdx(hoverIndex);
            }
        }
    };

    const handleGroupTouchEnd = async () => {
        setDragGhost(null);
        if (touchDraggingGroupIdx !== null) {
            setTouchDraggingGroupIdx(null);
            // Save order
            for (let idx = 0; idx < groups.length; idx++) {
                const g = groups[idx];
                await supabase.from('budget_groups').update({ sort_order: idx + 1 }).eq('id', g.id);
            }
        }
    };

    const handleGroupDrop = async () => {
        setDraggedGroupIdx(null);
        for (let idx = 0; idx < groups.length; idx++) {
            const g = groups[idx];
            await supabase.from('budget_groups').update({ sort_order: idx + 1 }).eq('id', g.id);
        }
    };


    // === CATEGORY DRAG ===
    const handleCatDragStart = (e: React.DragEvent, groupId: string, catIndex: number) => {
        e.stopPropagation();
        setDraggedCategory({ groupId, catIndex });
        setDraggedGroupIdx(null);
    };

    const handleCatDragOver = (e: React.DragEvent, targetGroupId: string, targetCatIndex: number) => {
        e.preventDefault();
        e.stopPropagation();
        if (!draggedCategory || draggedCategory.groupId !== targetGroupId) return; 
        
        if (draggedCategory.catIndex === targetCatIndex) return;

        const groupIndex = groups.findIndex(g => g.id === targetGroupId);
        
        // Immutable update for category
        const newGroups = [...groups];
        const newGroup = { ...newGroups[groupIndex] }; 
        const newCats = [...newGroup.categories]; 
        
        const [movedCat] = newCats.splice(draggedCategory.catIndex, 1);
        newCats.splice(targetCatIndex, 0, movedCat);
        
        newGroup.categories = newCats;
        newGroups[groupIndex] = newGroup;

        setGroups(newGroups);
        setDraggedCategory({ groupId: targetGroupId, catIndex: targetCatIndex });
    };

    const handleCatDrop = async (groupId: string) => {
        setDraggedCategory(null);
        const group = groups.find(g => g.id === groupId);
        if (!group) return;

        for (let idx = 0; idx < group.categories.length; idx++) {
            const c = group.categories[idx];
            await supabase.from('budget_categories').update({ sort_order: idx + 1 }).eq('id', c.id);
        }
    };

    // Touch Handlers for Categories
    const [touchDraggingCat, setTouchDraggingCat] = useState<{groupId: string, index: number} | null>(null);

    const handleCatTouchStart = (e: React.TouchEvent, groupId: string, index: number) => {
        e.stopPropagation(); // Don't trigger group drag
        setTouchDraggingCat({ groupId, index });

        const touch = e.touches[0];
        const target = e.currentTarget.closest('[data-cat-index]'); // Use closest on currentTarget to be safe, or just target
        // Actually currentTarget is the handle div. We need the row.
        // The handle is inside the row.
        const row = e.currentTarget.closest('.flex.justify-between'); // The row container
        
        if (row) {
            const rect = row.getBoundingClientRect();
            // Find category name
            const group = groups.find(g => g.id === groupId);
            const cat = group?.categories[index];
            
            if (cat) {
                setDragGhost({
                    x: touch.clientX,
                    y: touch.clientY,
                    type: 'category',
                    name: cat.name,
                    width: rect.width
                });
            }
        }
    };

    const handleCatTouchMove = (e: React.TouchEvent) => {
        if (!touchDraggingCat) return;
        if (e.cancelable) e.preventDefault();

        const touch = e.touches[0];
        setDragGhost(prev => prev ? { ...prev, x: touch.clientX, y: touch.clientY } : null);

        const target = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!target) return;

        const catEl = target.closest('[data-cat-index]');
        // Also ensure we are in the same group
        const groupContainer = target.closest('[data-group-id]');
        
        if (catEl && groupContainer) {
            const targetGroupId = groupContainer.getAttribute('data-group-id');
            const targetIndex = parseInt(catEl.getAttribute('data-cat-index') || '-1');

            if (targetGroupId === touchDraggingCat.groupId && targetIndex !== -1 && targetIndex !== touchDraggingCat.index) {
                // Swap logic
                const groupIndex = groups.findIndex(g => g.id === targetGroupId);
                const newGroups = [...groups];
                const newGroup = { ...newGroups[groupIndex] };
                const newCats = [...newGroup.categories];

                const [movedCat] = newCats.splice(touchDraggingCat.index, 1);
                newCats.splice(targetIndex, 0, movedCat);

                newGroup.categories = newCats;
                newGroups[groupIndex] = newGroup;
                setGroups(newGroups);
                setTouchDraggingCat({ groupId: targetGroupId, index: targetIndex });
            }
        }
    };

    const handleCatTouchEnd = async () => {
        setDragGhost(null);
        if (touchDraggingCat) {
            const groupId = touchDraggingCat.groupId;
            setTouchDraggingCat(null);
            
            // Save
            const group = groups.find(g => g.id === groupId);
            if (!group) return;
            for (let idx = 0; idx < group.categories.length; idx++) {
                const c = group.categories[idx];
                await supabase.from('budget_categories').update({ sort_order: idx + 1 }).eq('id', c.id);
            }
        }
    };


    return (
        <div className="space-y-6 pt-4 px-4 animate-fade-in pb-32">
            <header className="px-2 flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40">
                    <ChevronLeft className="w-4 h-4 text-relief-text-secondary" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold italic text-relief-primary">Budget</h1>
                    <p className="text-relief-text-secondary text-[10px] uppercase tracking-widest font-bold">Edit Configuration</p>
                </div>
            </header>

            <div className="px-2">
                <Button onClick={handleAddGroup} variant="secondary" className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10" fullWidth>
                    + Add Group
                </Button>
            </div>

            <div className="space-y-8 px-2">
                {['income', 'expense', 'goal'].map(type => {
                     const typeGroups = groups.map((g, i) => ({...g, originalIndex: i})).filter(g => g.type === type);
                     const headerColor = type === 'income' ? 'text-emerald-400' : type === 'goal' ? 'text-blue-400' : 'text-slate-400';
                     
                     return (
                        <div key={type}>
                            <h3 className={`text-[10px] font-bold uppercase tracking-widest mb-3 ${headerColor}`}>
                                {type === 'goal' ? 'Goals' : type}
                            </h3>
                            <div className="space-y-4">
                                {typeGroups.map((group) => (
                                    <div 
                                        key={group.id}
                                        data-group-index={group.originalIndex}
                                        data-group-id={group.id}
                                        draggable
                                        onDragStart={(e) => handleGroupDragStart(e, group.originalIndex)}
                                        onDragOver={(e) => handleGroupDragOver(e, group.originalIndex)}
                                        onDrop={handleGroupDrop}
                                        className={`rounded-2xl border border-white/5 bg-[#0F172A] shadow-lg shadow-black/40 overflow-hidden ${draggedGroupIdx === group.originalIndex ? 'opacity-50 border-relief-primary' : ''}`}
                                    >
                                        <div className="p-3 bg-relief-surface border-b border-relief-border flex justify-between items-center group">
                                            <div className="flex items-center gap-3">
                                                {/* Grip Handle for Touch */}
                                                <div 
                                                    className="touch-none cursor-grab active:cursor-grabbing p-2 -ml-2"
                                                    onTouchStart={(e) => handleGroupTouchStart(e, group.originalIndex)}
                                                    onTouchMove={handleGroupTouchMove}
                                                    onTouchEnd={handleGroupTouchEnd}
                                                >
                                                    <Menu className="w-4 h-4 text-relief-text-secondary hover:text-relief-text-primary" />
                                                </div>

                                                <span 
                                                    onClick={() => handleEditGroup(group)}
                                                    className="font-bold text-sm text-relief-text-primary cursor-pointer hover:text-relief-primary"
                                                >
                                                    {group.name}
                                                </span>
                                            </div>
                                            <button 
                                                onClick={() => handleAddCategory(group.id)}
                                                className="text-[10px] font-bold text-relief-primary hover:text-relief-primary/80 uppercase px-2 py-1 rounded bg-relief-primary/10"
                                            >
                                                + Category
                                            </button>
                                        </div>
                                        <div>
                                            {group.categories.map((cat, cIdx) => (
                                                <div 
                                                    key={cat.id} 
                                                    data-cat-index={cIdx}
                                                    draggable
                                                    onDragStart={(e) => handleCatDragStart(e, group.id, cIdx)}
                                                    onDragOver={(e) => handleCatDragOver(e, group.id, cIdx)}
                                                    onDrop={() => handleCatDrop(group.id)}
                                                    className="flex justify-between items-center p-3 border-b border-relief-border last:border-0 hover:bg-white/5 group"
                                                >
                                                    <div className="flex items-center gap-3 w-full">
                                                        {/* Grip Handle for Touch Categories */}
                                                        <div 
                                                            className="touch-none cursor-grab active:cursor-grabbing p-2 -ml-2"
                                                            onTouchStart={(e) => handleCatTouchStart(e, group.id, cIdx)}
                                                            onTouchMove={handleCatTouchMove}
                                                            onTouchEnd={handleCatTouchEnd}
                                                        >
                                                            <Menu className="w-3 h-3 text-relief-text-secondary hover:text-relief-text-primary" />
                                                        </div>

                                                        <div onClick={() => handleEditCategory(cat)} className="cursor-pointer flex-1">
                                                            <div className="text-sm text-relief-text-secondary font-medium">{cat.name}</div>
                                                            <div className="flex gap-2 mt-0.5">
                                                                <span className="text-[10px] text-relief-text-secondary bg-relief-bg px-1 rounded">{cat.is_fixed ? 'FIXED' : 'VAR'}</span>
                                                                <span className="text-[10px] text-relief-text-secondary">${cat.planned_amount}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                     );
                })}
            </div>

            <EditGroupModal 
                isOpen={isGroupModalOpen} 
                onClose={() => setIsGroupModalOpen(false)} 
                group={editingGroup} 
                onSave={saveGroup} 
                onDelete={handleDeleteGroupClick}
            />

            <EditCategoryModal 
                isOpen={isCatModalOpen} 
                onClose={() => setIsCatModalOpen(false)} 
                category={editingCategory} 
                onSave={saveCategory} 
                onDelete={handleDeleteCategoryClick}
            />

             {/* Move Categories Modal (When deleting group) */}
             <Modal isOpen={isMoveModalOpen} onClose={() => setIsMoveModalOpen(false)} title="Move Categories">
                <div className="space-y-4">
                    <p className="text-sm text-slate-400">
                        Please select a new group for the categories currently in <span className="text-white font-bold">{editingGroup?.name}</span>.
                    </p>
                    <select 
                        value={targetGroupId} 
                        onChange={e => setTargetGroupId(e.target.value)}
                        className="w-full p-4 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 outline-none"
                    >
                        <option value="">-- Select Group --</option>
                        {groups.filter(g => g.id !== editingGroup?.id).map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                        ))}
                    </select>
                    <div className="pt-2">
                        <Button 
                            variant="danger" 
                            onClick={performMoveAndDelete} 
                            disabled={!targetGroupId}
                            fullWidth
                        >
                            Move & Delete Group
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Confirmation Modal */}
            <Modal isOpen={confirmState.isOpen} onClose={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} title={confirmState.title}>
                <div className="space-y-4">
                    <p className="text-sm text-slate-300 leading-relaxed">{confirmState.message}</p>
                    <div className="flex gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setConfirmState(prev => ({ ...prev, isOpen: false }))} fullWidth>
                            Cancel
                        </Button>
                        <Button variant="danger" onClick={confirmState.onConfirm} fullWidth>
                            Confirm
                        </Button>
                    </div>
                </div>
            </Modal>

            {/* Drag Ghost Overlay */}
            {dragGhost && (
                <div 
                    className="fixed z-[100] pointer-events-none bg-slate-800/90 border border-emerald-500/50 rounded-xl shadow-2xl flex items-center px-4 py-3 text-white font-bold text-sm backdrop-blur-sm"
                    style={{ 
                        left: dragGhost.x, 
                        top: dragGhost.y, 
                        width: dragGhost.width,
                        transform: 'translate(-24px, -50%) scale(1.05)'
                    }}
                >
                    <Menu className="w-4 h-4 mr-3 text-emerald-400" />
                    {dragGhost.name}
                </div>
            )}
        </div>
    );
};
