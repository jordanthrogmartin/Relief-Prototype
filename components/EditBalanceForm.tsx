import React, { useState } from 'react';
import { supabase } from '../services/supabase';
import { Button } from './ui/Button';
import { useGlobalContext } from '../context/GlobalContext';

interface Props {
    date?: string;
    onSuccess: () => void;
    onCancel: () => void;
}

export const EditBalanceForm: React.FC<Props> = ({ date, onSuccess, onCancel }) => {
    const { todayInTimezone } = useGlobalContext();
    const [balance, setBalance] = useState('');
    const [loading, setLoading] = useState(false);
    
    // Default to today in timezone if no date provided
    const targetDate = date || todayInTimezone;

    const handleSave = async () => {
        if (balance === '') return;
        setLoading(true);
        
        try {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) throw new Error("No user found");
            
            // Fetch sum of all ACTIVE transactions UP TO AND INCLUDING the target date for THIS USER
            const { data: txns, error: fetchError } = await supabase
                .from('transactions')
                .select('amount')
                .eq('user_id', user.id)
                .lte('transaction_date', targetDate)
                .neq('status', 'skipped'); // Vital: Exclude skipped transactions from balance calc
            
            if (fetchError) throw fetchError;

            const currentSum = txns?.reduce((acc, t) => acc + (t.amount || 0), 0) || 0;
            const target = parseFloat(balance);
            
            if (isNaN(target)) throw new Error("Invalid balance amount");

            const diff = target - currentSum;

            // Only insert if there's a difference > 0.01 to avoid floating point dust
            if (Math.abs(diff) > 0.009) {
                 const { error: insertError } = await supabase.from('transactions').insert({
                    user_id: user.id,
                    name: "Balance Adjustment",
                    amount: diff,
                    type: diff >= 0 ? 'income' : 'expense',
                    status: 'cleared',
                    transaction_date: targetDate
                });
                if (insertError) throw insertError;

                // Invalidate snapshots
                // Since this changes the balance for this date, any snapshot for this month or FUTURE months is invalid
                const monthKey = targetDate.substring(0, 7); 
                await supabase.from('monthly_snapshots').delete().gte('month', monthKey);
            }
            
            onSuccess();
        } catch (err) {
            console.error(err);
            alert("Failed to update balance. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="text-center">
                <p className="text-xs font-bold uppercase text-slate-400">Set Balance for</p>
                <p className="text-sm font-bold text-emerald-300">{targetDate}</p>
            </div>
            
            <div className="flex items-center gap-2 p-4 border bg-slate-800/50 rounded-xl border-white/10 focus-within:border-emerald-400/50">
                <span className="font-bold text-emerald-400">$</span>
                <input 
                    type="number" 
                    step="0.01" 
                    autoFocus
                    placeholder="0.00" 
                    value={balance}
                    onChange={e => setBalance(e.target.value)}
                    className="w-full text-xl font-bold text-white bg-transparent outline-none"
                />
            </div>
            <div className="flex gap-3">
                <Button variant="secondary" onClick={onCancel} className="flex-1">Cancel</Button>
                <Button onClick={handleSave} disabled={loading} className="flex-1">Update</Button>
            </div>
        </div>
    );
};