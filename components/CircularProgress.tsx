import React from 'react';

export const CircularProgress = ({ percentActual, remaining, emoji }: { percentActual: number, remaining: number, emoji?: string }) => {
    const radius = 18;
    const circumference = 2 * Math.PI * radius;
    const strokeActual = ((Math.min(percentActual, 100)) / 100) * circumference;
    return (
        <div className="relative w-12 h-12 flex items-center justify-center">
            <svg className="w-full h-full -rotate-90 transform" viewBox="0 0 40 40">
                <circle className="text-slate-800" strokeWidth="4" stroke="currentColor" fill="transparent" r={radius} cx="20" cy="20" />
                <circle className={remaining < 0 ? "text-red-500" : "text-emerald-400"} strokeWidth="4" strokeDasharray={circumference} strokeDashoffset={circumference - strokeActual} strokeLinecap="round" stroke="currentColor" fill="transparent" r={radius} cx="20" cy="20" />
            </svg>
            <div className="absolute text-[14px] font-bold text-white flex items-center justify-center pointer-events-none">
                {emoji ? emoji : `${Math.round(percentActual)}%`}
            </div>
        </div>
    );
};
