import React from 'react';
import { BarChart3, Target, Lock } from 'lucide-react';
import { useGlobalContext } from '../context/GlobalContext';

export const Insights: React.FC = () => {
    const { activeInsightsTab } = useGlobalContext();

    return (
        <div className="flex flex-col min-h-screen pt-4 px-4 animate-page-enter pb-24">
            
            {/* Content Area */}
            <div className="flex-grow flex flex-col items-center justify-center text-center p-6 border border-white/5 shadow-lg shadow-black/40 rounded-2xl bg-[#0F172A] mx-2">
                <div className="p-4 rounded-full bg-relief-surface border border-relief-border mb-4">
                    <Lock className="w-8 h-8 text-relief-text-secondary" />
                </div>
                <h3 className="text-lg font-bold text-relief-text-primary mb-2">
                    {activeInsightsTab === 'reports' ? 'Advanced Reporting' : 'Goal Tracking'}
                </h3>
                <p className="text-xs text-relief-text-secondary max-w-[200px] leading-relaxed">
                    {activeInsightsTab === 'reports' 
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