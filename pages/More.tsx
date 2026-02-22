import React, { useEffect, useState } from 'react';
import { Settings, HelpCircle, BarChart3, Target, MessageSquare } from 'lucide-react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';

export const More: React.FC = () => {
    const navigate = useNavigate();
    const [profile, setProfile] = useState<UserProfile | null>(null);

    useEffect(() => {
        const fetchProfile = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('*').eq('id', user.id).single();
                if (data) setProfile(data);
                else setProfile({ id: user.id, display_name: user.email?.split('@')[0] });
            }
        };
        fetchProfile();
    }, []);

    const getInitials = () => {
        if (!profile?.display_name) return '??';
        return profile.display_name.substring(0, 2).toUpperCase();
    };

    return (
        <div className="space-y-6 pt-4 px-4 animate-fade-in pb-24">
            <header className="px-2">
                <h1 className="text-2xl font-bold italic text-emerald-300">More</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Tools & Options</p>
            </header>

            {/* Profile Card */}
            <div className="mx-2 p-4 rounded-2xl bg-slate-800/80 border border-white/5 flex items-center gap-4 shadow-lg">
                <div className="w-14 h-14 rounded-full border-2 border-emerald-400 flex items-center justify-center bg-slate-900 shadow-[0_0_15px_rgba(52,211,153,0.2)]">
                    <span className="text-lg font-bold text-emerald-400">{getInitials()}</span>
                </div>
                <div>
                    <h2 className="text-lg font-bold text-white">{profile?.display_name || 'Member'}</h2>
                    <p className="text-xs text-slate-400">Relief Member</p>
                </div>
            </div>

            <div className="px-2 space-y-6">
                
                {/* Tools Section */}
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-2">Tools</h3>
                    <div className="space-y-3">
                        <button 
                            onClick={() => navigate('/reports')}
                            className="w-full p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center justify-between active:scale-95 transition-transform group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300 group-hover:bg-slate-700 transition-colors">
                                    <BarChart3 className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-200">Reports</div>
                                </div>
                            </div>
                            <div className="text-slate-600 group-hover:text-white transition-colors">›</div>
                        </button>

                        <button 
                            onClick={() => navigate('/goals')}
                            className="w-full p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center justify-between active:scale-95 transition-transform group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300 group-hover:bg-slate-700 transition-colors">
                                    <Target className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-200">Goals</div>
                                </div>
                            </div>
                            <div className="text-slate-600 group-hover:text-white transition-colors">›</div>
                        </button>
                    </div>
                </div>

                {/* System Section */}
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-2">System</h3>
                    <div className="space-y-3">
                        <button 
                            onClick={() => navigate('/settings')}
                            className="w-full p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center justify-between active:scale-95 transition-transform group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300 group-hover:bg-slate-700 transition-colors">
                                    <Settings className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-200">Settings</div>
                                </div>
                            </div>
                            <div className="text-slate-600 group-hover:text-white transition-colors">›</div>
                        </button>

                        <button 
                            onClick={() => navigate('/settings/faq')}
                            className="w-full p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center justify-between active:scale-95 transition-transform group"
                        >
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300 group-hover:bg-slate-700 transition-colors">
                                    <HelpCircle className="w-5 h-5" />
                                </div>
                                <div className="text-left">
                                    <div className="text-sm font-bold text-slate-200">FAQ</div>
                                </div>
                            </div>
                            <div className="text-slate-600 group-hover:text-white transition-colors">›</div>
                        </button>

                        <button 
                            className="w-full p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center gap-3 opacity-50 cursor-not-allowed"
                        >
                            <div className="p-2 rounded-lg bg-slate-700/50 text-slate-300">
                                <MessageSquare className="w-5 h-5" />
                            </div>
                            <div className="text-left">
                                <div className="text-sm font-bold text-slate-200">Support (Coming Soon)</div>
                            </div>
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};