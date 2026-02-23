import React, { useState, useEffect } from 'react';
import { supabase } from '../services/supabase';
import { Check, Circle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const Auth: React.FC = () => {
    // Note: useNavigate might not work if Auth is rendered outside HashRouter in App.tsx
    // But in App.tsx logic, Auth is rendered when !session. 
    // Wait, MainContent has HashRouter. Auth is rendered directly in App.
    // So we can't use useNavigate here easily unless we wrap Auth.
    // However, App.tsx detects session change and renders MainContent.
    // MainContent defaults to Home.
    // So explicitly changing window.location.hash might be the safest brute force for "automatically put me on profile" bug.
    
    const [view, setView] = useState<'signin' | 'signup' | 'recovery'>('signin');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [msg, setMsg] = useState('');

    // Password requirements state
    const [reqs, setReqs] = useState({
        length: false,
        upper: false,
        lower: false,
        number: false,
        special: false
    });

    useEffect(() => {
        setReqs({
            length: password.length >= 8,
            upper: /[A-Z]/.test(password),
            lower: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*(),.?":{}|<>]/.test(password)
        });
    }, [password]);

    const handleAuth = async () => {
        setLoading(true);
        setMsg('');
        try {
            if (view === 'signup') {
                const { error } = await supabase.auth.signUp({ 
                    email, 
                    password,
                    options: {
                        data: {
                            full_name: '',
                            display_name: email.split('@')[0]
                        }
                    }
                });
                if (error) {
                    if (
                        error.message.includes("already registered") || 
                        error.message.includes("already exists") || 
                        error.status === 422 || 
                        error.status === 400
                    ) {
                        throw new Error("This email is already in use. Please sign in.");
                    }
                    throw error;
                }
                setMsg('Check your email for the confirmation link. Check your spam folder if you don\'t see it.');
            } else {
                // Force URL reset to root on login to prevent lingering hash routes
                window.location.hash = '/';
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) {
                    if (error.message.includes("Invalid login")) {
                        throw new Error("Incorrect email or password.");
                    }
                    throw error;
                }
                // Double check redirect
                if (!error) {
                     window.location.hash = '/';
                }
            }
        } catch (err: any) {
            setMsg(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleRecovery = async () => {
        if (!email) {
            setMsg('Please enter your email address.');
            return;
        }
        setLoading(true);
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/#/profile',
        });
        setLoading(false);
        if (error) setMsg(error.message);
        else setMsg('Recovery link sent to your email.');
    };

    const Requirement = ({ met, text }: { met: boolean, text: string }) => (
        <div className="flex items-center gap-2 text-[10px]">
            {met ? (
                <div className="bg-emerald-400 rounded-full p-0.5">
                    <Check className="w-2 h-2 text-slate-900" strokeWidth={4} />
                </div>
            ) : (
                <Circle className="w-3 h-3 text-slate-600" />
            )}
            <span className={met ? 'text-emerald-400 font-bold' : 'text-slate-500'}>{text}</span>
        </div>
    );

    const isSignUpValid = reqs.length && reqs.upper && reqs.lower && reqs.number && reqs.special;

    return (
        <div className="flex flex-col items-center justify-center min-h-[80vh] px-4 animate-fade-in">
            <div className="mb-10 text-center">
                <h1 className="text-4xl font-bold italic tracking-tighter text-emerald-300">Relief</h1>
                <p className="text-slate-500 text-[10px] uppercase tracking-[0.3em] font-bold mt-2">Financial Clarity</p>
            </div>

            <div className="w-full max-w-sm p-6 border shadow-2xl bg-slate-800/50 backdrop-blur-md rounded-3xl border-white/10">
                
                {view === 'recovery' ? (
                    <div className="space-y-6 animate-fade-in">
                        <div className="space-y-2">
                             <input 
                                type="email" 
                                placeholder="Email" 
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full p-4 text-white transition-all border rounded-xl bg-slate-900/50 border-white/10 focus:border-emerald-400/50 outline-none"
                            />
                        </div>
                        <button 
                            onClick={handleRecovery}
                            disabled={loading}
                            className="w-full py-4 font-bold transition-colors bg-emerald-400 rounded-xl text-emerald-950 hover:bg-emerald-300 disabled:opacity-50"
                        >
                            {loading ? 'Sending...' : 'Send Recovery Link'}
                        </button>
                        <button 
                            onClick={() => { setView('signin'); setMsg(''); }}
                            className="w-full text-[10px] font-bold uppercase tracking-widest text-slate-500 hover:text-white"
                        >
                            Back to Login
                        </button>
                    </div>
                ) : (
                    <div className="space-y-4 animate-fade-in">
                        <div className="flex p-1 mb-6 rounded-xl bg-slate-900/50">
                            <button 
                                onClick={() => setView('signin')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${view === 'signin' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Sign In
                            </button>
                            <button 
                                onClick={() => setView('signup')}
                                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all ${view === 'signup' ? 'bg-emerald-400 text-emerald-950 shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                            >
                                Sign Up
                            </button>
                        </div>

                        <input 
                            type="email" 
                            placeholder="Email" 
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full p-4 text-white transition-all border rounded-xl bg-slate-900/50 border-white/10 focus:border-emerald-400/50 outline-none"
                        />
                        
                        <input 
                            type="password" 
                            placeholder="Password" 
                            value={password}
                            onChange={e => setPassword(e.target.value)}
                            className="w-full p-4 text-white transition-all border rounded-xl bg-slate-900/50 border-white/10 focus:border-emerald-400/50 outline-none"
                        />

                        {view === 'signup' && (
                            <div className="space-y-1.5 px-2 pt-2 pb-2">
                                <Requirement met={reqs.length} text="Min 8 characters" />
                                <Requirement met={reqs.upper} text="At least 1 uppercase letter" />
                                <Requirement met={reqs.lower} text="At least 1 lowercase letter" />
                                <Requirement met={reqs.number} text="At least 1 number" />
                                <Requirement met={reqs.special} text="At least 1 symbol (!@#$...)" />
                            </div>
                        )}

                        {view === 'signin' && (
                            <div className="flex justify-end px-1">
                                <button 
                                    onClick={() => { setView('recovery'); setMsg(''); }}
                                    className="text-[10px] text-slate-400 hover:text-emerald-400 transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        <button 
                            onClick={handleAuth}
                            disabled={loading || (view === 'signup' && !isSignUpValid)}
                            className="w-full py-4 mt-2 font-bold transition-colors bg-emerald-400 rounded-xl text-emerald-950 hover:bg-emerald-300 disabled:opacity-50 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(52,211,153,0.3)]"
                        >
                            {loading ? 'Processing...' : (view === 'signin' ? 'Sign In' : 'Create Account')}
                        </button>
                    </div>
                )}

                {msg && <p className="mt-4 text-xs font-bold text-center text-red-400 animate-pulse">{msg}</p>}
            </div>
        </div>
    );
};