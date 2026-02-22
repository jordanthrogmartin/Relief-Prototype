import React from 'react';
import { Lock } from 'lucide-react';

export const MapPage: React.FC = () => {
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 pt-4 animate-fade-in pb-24 px-6 text-center">
            <div className="p-6 rounded-full bg-slate-800/50 border border-white/10 shadow-[0_0_30px_rgba(52,211,153,0.05)]">
                <Lock className="w-12 h-12 text-slate-500" />
            </div>
            <div>
                <h1 className="text-2xl font-bold italic text-slate-300">The Map</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mt-2">12 Phases to Freedom</p>
            </div>
            
            <div className="max-w-xs p-6 border border-dashed border-white/10 rounded-xl bg-slate-800/30">
                <p className="text-sm text-slate-400">
                    This module is currently locked. Complete your initial setup and stabilize your cushion to unlock the financial roadmap.
                </p>
                <div className="mt-4 text-xs font-bold text-emerald-500 uppercase tracking-widest">
                    Coming Soon
                </div>
            </div>
        </div>
    );
};