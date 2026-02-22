import React from 'react';
import { Lock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ComingSoon: React.FC = () => {
    const navigate = useNavigate();
    return (
        <div className="flex flex-col items-center justify-center min-h-[70vh] space-y-6 pt-4 px-4 animate-fade-in pb-24 text-center">
            <div className="absolute top-4 left-4">
                <button onClick={() => navigate(-1)} className="p-2 rounded-full bg-slate-800 border border-white/10 text-slate-400 hover:text-white">
                    <ArrowLeft className="w-5 h-5" />
                </button>
            </div>
            
            <div className="p-6 rounded-full bg-slate-800/50 border border-white/10 shadow-[0_0_30px_rgba(52,211,153,0.05)]">
                <Lock className="w-12 h-12 text-slate-500" />
            </div>
            <div>
                <h1 className="text-2xl font-bold italic text-slate-300">Locked</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-widest font-bold mt-2">Feature In Development</p>
            </div>
            
            <div className="max-w-xs p-6 border border-dashed border-white/10 rounded-xl bg-slate-800/30">
                <p className="text-sm text-slate-400">
                    This module is currently locked. We are working hard to bring this feature to you in the next update.
                </p>
            </div>
        </div>
    );
};