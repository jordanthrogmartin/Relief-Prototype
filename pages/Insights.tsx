import React, { useState } from 'react';
import { BarChart3, Target, Lock } from 'lucide-react';

export const Insights: React.FC = () => {
    const [activeTab, setActiveTab] = useState<'reports' | 'goals'>('reports');

    return (
        <div className="flex flex-col min-h-screen pt-4 px-4 animate-page-enter pb-24">
            <header className="px-2 mb-6">
                <h1 className="text-2xl font-bold italic text-relief-magic">Insights</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold">Analysis & Planning</p>
            </header>

            {/* Tab Switcher */}
            <div className="flex p-1 mx-2 mb-6 rounded-2xl bg-[#0F172A] border border-white/5 shadow-lg shadow-black/40">
                <button 
                    onClick={() => setActiveTab('reports')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'reports' ? 'bg-relief-surface text-relief-text-primary shadow-sm' : 'text-relief-text-secondary hover:text-relief-text-primary'}`}
                >
                    <BarChart3 className="w-4 h-4" />
                    Reports
                </button>
                <button 
                    onClick={() => setActiveTab('goals')}
                    className={`flex-1 py-2.5 rounded-xl text-xs font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-all ${activeTab === 'goals' ? 'bg-relief-surface text-relief-text-primary shadow-sm' : 'text-relief-text-secondary hover:text-relief-text-primary'}`}
                >
                    <Target className="w-4 h-4" />
                    Goals
                </button>
            </div>

            {/* Content Area */}
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border border-white/5 shadow-lg shadow-black/40 rounded-2xl bg-[#0F172A] mx-2">
                <div className="p-4 rounded-full bg-relief-surface border border-relief-border mb-4">
                    <Lock className="w-8 h-8 text-relief-text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-relief-text-primary mb-2">
                    {activeTab === 'reports' ? 'Advanced Reporting' : 'Goal Tracking'}
                </h3>
                <p className="text-xs text-relief-text-secondary max-w-[200px] leading-relaxed">
                    {activeTab === 'reports' 
                        ? "Deep dive into your spending habits, trends, and forecasts."
                        : "Set financial targets and track your progress automatically."
                    }
                </p>
                <div className="mt-6 px-4 py-2 rounded-full bg-relief-surface border border-relief-border text-[10px] font-bold uppercase tracking-widest text-relief-primary">
                    Coming Soon
                </div>
            </div>
        </div>
    );
};