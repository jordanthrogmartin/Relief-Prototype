import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { Button } from '../../components/ui/Button';

export const PreferencesSettings: React.FC = () => {
    const navigate = useNavigate();
    const [threshold, setThreshold] = useState('');
    const [loading, setLoading] = useState(false);
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        const fetchSettings = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUserId(user.id);
                const { data } = await supabase.from('profiles').select('balance_warning_threshold').eq('id', user.id).single();
                if (data) {
                    setThreshold(data.balance_warning_threshold?.toString() || '500');
                }
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async () => {
        if (!userId) return;
        setLoading(true);
        const { error } = await supabase.from('profiles').update({
            balance_warning_threshold: parseInt(threshold)
        }).eq('id', userId);
        
        setLoading(false);
        if (error) alert('Error updating settings');
        else navigate(-1);
    };

    return (
        <div className="space-y-6 pt-4 px-4 animate-fade-in pb-24">
            <header className="px-2 flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40">
                    <ChevronLeft className="w-4 h-4 text-relief-text-secondary" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold italic text-relief-primary">Preferences</h1>
                    <p className="text-relief-text-secondary text-[10px] uppercase tracking-widest font-bold">General Settings</p>
                </div>
            </header>

            <div className="px-4 space-y-6">
                <div className="p-4 bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 rounded-2xl">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary">Balance Goal ($)</label>
                    <div className="flex items-center gap-3 mt-2">
                        <span className="text-xl font-bold text-relief-text-secondary">$</span>
                        <input 
                            type="number"
                            value={threshold}
                            onChange={e => setThreshold(e.target.value)}
                            className="flex-1 p-2 bg-transparent text-relief-text-primary font-bold text-lg border-b border-relief-border focus:border-relief-primary outline-none"
                        />
                    </div>
                    <p className="text-[10px] text-relief-text-secondary mt-2">Days with a balance below this amount will be highlighted yellow on your calendar.</p>
                </div>

                <Button onClick={handleSave} disabled={loading} fullWidth>
                    {loading ? 'Saving...' : 'Save Settings'}
                </Button>
            </div>
        </div>
    );
};