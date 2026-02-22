import React from 'react';
import { supabase } from '../services/supabase';
import { useNavigate } from 'react-router-dom';
import { User, Calendar, Wallet, ChevronRight, Zap, Store, CreditCard, Shield, Bell, Users, Landmark, Database, Sliders } from 'lucide-react';

export const SettingsPage: React.FC = () => {
    const navigate = useNavigate();

    const accountItems = [
        {
            icon: <User className="w-5 h-5 text-emerald-400" />,
            label: "Profile",
            path: "/settings/profile",
            locked: false
        },
        {
            icon: <Bell className="w-5 h-5 text-yellow-400" />,
            label: "Notifications",
            path: "/settings/notifications",
            locked: true
        },
        {
            icon: <Shield className="w-5 h-5 text-red-400" />,
            label: "Security",
            path: "/settings/security",
            locked: true
        }
    ];

    const householdItems = [
        {
            icon: <Users className="w-5 h-5 text-indigo-400" />,
            label: "Members",
            path: "/settings/members",
            locked: true
        },
        {
            icon: <Sliders className="w-5 h-5 text-blue-400" />,
            label: "Preferences", 
            path: "/settings/calendar",
            locked: false
        },
        {
            icon: <Landmark className="w-5 h-5 text-pink-400" />,
            label: "Institutions",
            path: "/settings/institutions",
            locked: true
        },
        {
            icon: <Wallet className="w-5 h-5 text-purple-400" />,
            label: "Budgets",
            path: "/settings/budget",
            locked: false
        },
        {
            icon: <Store className="w-5 h-5 text-orange-400" />,
            label: "Merchants",
            path: "/settings/merchants",
            locked: true
        },
        {
            icon: <Zap className="w-5 h-5 text-yellow-400" />,
            label: "Rules",
            path: "/settings/rules",
            locked: false
        },
        {
            icon: <Database className="w-5 h-5 text-cyan-400" />,
            label: "Data",
            path: "/settings/data",
            locked: true
        },
        {
            icon: <CreditCard className="w-5 h-5 text-green-400" />,
            label: "Billing",
            path: "/settings/billing",
            locked: true
        }
    ];

    const renderItem = (item: any, idx: number) => (
        <button 
            key={`${item.label}-${idx}`}
            onClick={() => navigate(item.path)}
            className="w-full p-4 rounded-xl border border-white/5 bg-slate-800/50 flex items-center justify-between active:scale-95 transition-transform group"
        >
            <div className="flex items-center gap-4">
                <div className={`p-2 rounded-lg bg-slate-700/30 ${item.locked ? 'opacity-70' : ''}`}>
                    {item.icon}
                </div>
                <span className={`text-sm font-bold ${item.locked ? 'text-slate-400' : 'text-slate-200'}`}>{item.label}</span>
            </div>
            {item.locked ? (
                 <div className="flex items-center gap-2">
                    <span className="text-[9px] font-bold uppercase bg-slate-700 text-slate-400 px-1.5 py-0.5 rounded">Locked</span>
                    <ChevronRight className="w-4 h-4 text-slate-700" />
                </div>
            ) : (
                <ChevronRight className="w-4 h-4 text-slate-600" />
            )}
        </button>
    );

    return (
        <div className="space-y-6 pt-4 px-4 pb-24 animate-page-enter">
            <header className="px-2">
                <h1 className="text-2xl font-bold italic text-emerald-300">Settings</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">App Configuration</p>
            </header>
            
            <div className="px-2 space-y-3">
                <h3 className="text-[10px] font-bold uppercase text-slate-500 px-2 mt-4 mb-2">Account</h3>
                {accountItems.map(renderItem)}

                <h3 className="text-[10px] font-bold uppercase text-slate-500 px-2 mt-6 mb-2">Household</h3>
                {householdItems.map(renderItem)}

                <button 
                    onClick={() => supabase.auth.signOut()} 
                    className="w-full p-4 mt-8 rounded-xl border border-red-500/20 bg-red-500/5 flex items-center justify-center gap-2 active:scale-95 transition-transform"
                >
                    <span className="text-xs font-bold text-red-400 uppercase tracking-widest">Log Out</span>
                </button>
            </div>
        </div>
    );
};