import React from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { User, Bell, Shield, Users, Sliders, Landmark, Wallet, Store, Zap, Database, CreditCard, LogOut, ChevronRight, HelpCircle } from 'lucide-react';
import { useGlobalContext } from '../context/GlobalContext';

export const Profile: React.FC = () => {
    const navigate = useNavigate();
    const { userProfile } = useGlobalContext();

    const getInitials = () => {
        if (!userProfile?.display_name) return '??';
        return userProfile.display_name.substring(0, 2).toUpperCase();
    };

    const MenuItem = ({ icon, label, path, locked, subtext }: { icon: React.ReactNode, label: string, path?: string, locked?: boolean, subtext?: string }) => (
        <button 
            onClick={() => path && navigate(path)}
            className={`w-full p-4 rounded-xl border border-relief-border bg-relief-bg flex items-center justify-between active:scale-95 transition-transform group hover:bg-relief-surface ${locked ? 'opacity-60 cursor-not-allowed' : ''}`}
        >
            <div className="flex items-center gap-4">
                <div className="p-2 rounded-lg bg-relief-surface border border-relief-border text-relief-text-secondary group-hover:text-relief-text-primary transition-colors">
                    {icon}
                </div>
                <div className="text-left">
                    <span className="text-sm font-bold text-relief-text-primary block">{label}</span>
                    {subtext && <span className="text-[10px] text-relief-text-secondary font-medium">{subtext}</span>}
                </div>
            </div>
            {locked ? (
                <LockIcon />
            ) : (
                <ChevronRight className="w-4 h-4 text-relief-text-secondary group-hover:text-relief-text-primary" />
            )}
        </button>
    );

    const LockIcon = () => (
        <span className="text-[9px] font-bold uppercase bg-relief-surface text-relief-text-secondary px-2 py-1 rounded border border-relief-border">Locked</span>
    );

    return (
        <div className="space-y-6 pt-4 px-4 pb-24 animate-page-enter">
            <header className="px-2">
                <h1 className="text-2xl font-bold italic text-emerald-300">Profile</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Account & Settings</p>
            </header>

            {/* Profile Card */}
            <div className="mx-2 p-5 rounded-3xl bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40 flex items-center gap-5 relative overflow-hidden">
                <div className="absolute top-0 right-0 p-4 opacity-10">
                    <User className="w-32 h-32" />
                </div>
                <div className="w-16 h-16 rounded-full border-2 border-relief-border flex items-center justify-center bg-relief-bg text-xl font-bold text-relief-primary shadow-lg relative z-10">
                    {getInitials()}
                </div>
                <div className="relative z-10">
                    <h2 className="text-lg font-bold text-relief-text-primary">{userProfile?.display_name || 'Member'}</h2>
                    <p className="text-xs text-relief-text-secondary font-medium">{userProfile?.full_name || 'Relief User'}</p>
                    <button onClick={() => navigate('/settings/profile')} className="mt-2 text-[10px] bg-white/10 hover:bg-white/20 px-3 py-1 rounded-full text-white font-bold transition-colors">
                        Edit Profile
                    </button>
                </div>
            </div>

            <div className="px-2 space-y-8">
                {/* Account Section */}
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-2">Account</h3>
                    <div className="space-y-2">
                        <MenuItem icon={<Bell className="w-4 h-4" />} label="Notifications" locked subtext="Alerts & Reminders" />
                        <MenuItem icon={<Shield className="w-4 h-4" />} label="Security" locked subtext="Password & 2FA" />
                        <MenuItem icon={<CreditCard className="w-4 h-4" />} label="Billing" locked subtext="Subscription" />
                    </div>
                </div>

                {/* Configuration Section */}
                <div>
                    <h3 className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-3 ml-2">Configuration</h3>
                    <div className="space-y-2">
                        <MenuItem icon={<Sliders className="w-4 h-4" />} label="Preferences" path="/settings/calendar" subtext="Display & Thresholds" />
                        <MenuItem icon={<Wallet className="w-4 h-4" />} label="Budget Config" path="/settings/budget" subtext="Categories & Groups" />
                        <MenuItem icon={<Zap className="w-4 h-4" />} label="Rules" path="/settings/rules" subtext="Smart Automation" />
                        <MenuItem icon={<Store className="w-4 h-4" />} label="Merchants" locked subtext="Manage Payees" />
                    </div>
                </div>

                <div className="pt-4">
                    <button 
                        onClick={() => supabase.auth.signOut()} 
                        className="w-full p-4 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-center gap-2 active:scale-95 transition-transform hover:bg-red-500/10"
                    >
                        <LogOut className="w-4 h-4 text-red-400" />
                        <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Sign Out</span>
                    </button>
                    
                    <div className="text-center mt-6">
                        <p className="text-[10px] text-slate-600">Relief App v0.8.2 (Prototype)</p>
                    </div>
                </div>
            </div>
        </div>
    );
};