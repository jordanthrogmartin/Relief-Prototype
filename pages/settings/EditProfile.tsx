import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft } from 'lucide-react';
import { supabase } from '../../services/supabase';
import { UserProfile } from '../../types';
import { Button } from '../../components/ui/Button';
import { useGlobalContext } from '../../context/GlobalContext';

export const EditProfileSettings: React.FC = () => {
    const navigate = useNavigate();
    const { updateUserTimezone } = useGlobalContext();
    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [fullName, setFullName] = useState('');
    const [displayName, setDisplayName] = useState('');
    const [birthday, setBirthday] = useState('');
    const [timezone, setTimezone] = useState('');
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) {
                    setProfile(data);
                    setFullName(data.full_name || '');
                    setDisplayName(data.display_name || '');
                    setBirthday(data.birthday || '');
                    // Default to browser timezone if not set in DB
                    setTimezone(data.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone);
                }
            }
        };
        fetchProfile();
    }, []);

    const handleSave = async () => {
        if (!profile) return;
        setLoading(true);
        const { error } = await supabase.from('profiles').update({
            full_name: fullName,
            display_name: displayName,
            birthday: birthday,
            timezone: timezone
        }).eq('id', profile.id);
        
        // Update Global Context immediately so UI reflects change
        updateUserTimezone(timezone);

        setLoading(false);
        if (error) alert('Error updating profile');
        else navigate(-1);
    };

    // Get list of supported timezones - Handle TS error for older lib definitions
    const supportedTimezones = (Intl as any).supportedValuesOf ? (Intl as any).supportedValuesOf('timeZone') : [Intl.DateTimeFormat().resolvedOptions().timeZone];

    return (
        <div className="space-y-6 pt-4 px-4 animate-fade-in pb-24 overflow-x-hidden">
            <header className="px-2 flex items-center gap-2">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40">
                    <ChevronLeft className="w-4 h-4 text-relief-text-secondary" />
                </button>
                <div>
                    <h1 className="text-2xl font-bold italic text-relief-primary">Profile</h1>
                    <p className="text-relief-text-secondary text-[10px] uppercase tracking-widest font-bold">Personal Info</p>
                </div>
            </header>

            <div className="px-4 space-y-5">
                <div className="w-full">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Full Name</label>
                    <input 
                        value={fullName}
                        onChange={e => setFullName(e.target.value)}
                        className="w-full p-4 mt-1 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none box-border"
                    />
                </div>
                <div className="w-full">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Display Name</label>
                    <input 
                        value={displayName}
                        onChange={e => setDisplayName(e.target.value)}
                        className="w-full p-4 mt-1 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none box-border"
                    />
                </div>
                <div className="w-full">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Birthday</label>
                    <div className="relative w-full">
                         <input 
                            type="date"
                            value={birthday}
                            onChange={e => setBirthday(e.target.value)}
                            className="w-full p-4 mt-1 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none appearance-none min-w-0 box-border"
                        />
                    </div>
                </div>
                <div className="w-full">
                    <label className="text-[10px] uppercase font-bold text-relief-text-secondary ml-1">Time Zone</label>
                    <div className="relative w-full">
                         <select
                            value={timezone}
                            onChange={e => setTimezone(e.target.value)}
                            className="w-full p-4 mt-1 text-sm text-relief-text-primary border rounded-xl bg-relief-bg border-relief-border focus:border-relief-primary/50 outline-none appearance-none min-w-0 box-border"
                        >
                            {supportedTimezones.map((tz: string) => (
                                <option key={tz} value={tz}>{tz}</option>
                            ))}
                        </select>
                    </div>
                    <p className="text-[9px] text-relief-text-secondary mt-1 ml-1">Ensures the calendar and 'Today' align with your local time.</p>
                </div>

                <div className="pt-2">
                    <Button onClick={handleSave} disabled={loading} fullWidth>
                        {loading ? 'Saving...' : 'Save Changes'}
                    </Button>
                </div>
            </div>
        </div>
    );
};