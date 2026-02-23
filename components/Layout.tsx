import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Home, Wallet, Activity, Briefcase, User, Sparkles, X, ArrowRight, Settings, Bell, ChevronLeft, CheckSquare, Square } from 'lucide-react'; 
import { Modal } from './ui/Modal';
import { Button } from './ui/Button';
import { useGlobalContext } from '../context/GlobalContext';
import { supabase } from '../services/supabase';
import { RuleCondition, RuleAction, BudgetGroup } from '../types';

export const Layout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const location = useLocation();
    const navigate = useNavigate();
    const { 
        triggerRefresh, 
        ghostTransactions, 
        clearGhostTransactions, 
        ruleCandidate, 
        setRuleCandidate,
        userProfile,
        activeHomeTab,
        setActiveHomeTab,
        showExpected,
        setShowExpected
    } = useGlobalContext();
    
    const [showRuleModal, setShowRuleModal] = useState(false);
    const [ruleName, setRuleName] = useState('');
    const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([]);
    const [ruleActions, setRuleActions] = useState<RuleAction[]>([]);
    const [ruleGroups, setRuleGroups] = useState<BudgetGroup[]>([]);
    const [isBannerVisible, setIsBannerVisible] = useState(false);

    useEffect(() => {
        if (location.pathname === '/index.html') navigate('/');
    }, [location.pathname, navigate]);

    useEffect(() => {
        let dismissTimer: ReturnType<typeof setTimeout>;
        let cleanupTimer: ReturnType<typeof setTimeout>;

        if (ruleCandidate && !showRuleModal) {
            requestAnimationFrame(() => setIsBannerVisible(true));
            dismissTimer = setTimeout(() => {
                setIsBannerVisible(false);
                cleanupTimer = setTimeout(() => setRuleCandidate(null), 300);
            }, 6000);
        } else {
            setIsBannerVisible(false);
        }

        return () => {
            clearTimeout(dismissTimer);
            clearTimeout(cleanupTimer);
        };
    }, [ruleCandidate, showRuleModal, setRuleCandidate]);

    const handleRulePromptClick = async () => {
        if (!ruleCandidate) return;
        setIsBannerVisible(false);
        const { data } = await supabase.from('budget_groups').select('*, categories:budget_categories(*)');
        if (data) setRuleGroups(data);
        setRuleName(`Rule for ${ruleCandidate.merchant || ruleCandidate.name}`);
        setRuleConditions([{ field: 'merchant', operator: 'is', value: ruleCandidate.merchant || '' }]);
        setRuleActions([{ type: 'set_category', value: ruleCandidate.category || '' }]);
        setShowRuleModal(true);
    };

    const handleRuleSave = async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        await supabase.from('transaction_rules').insert({
            user_id: user.id,
            name: ruleName,
            conditions: ruleConditions,
            actions: ruleActions,
            is_active: true
        });
        setShowRuleModal(false);
        setRuleCandidate(null);
        triggerRefresh(); 
    };

    const updateRuleAction = (index: number, field: keyof RuleAction, value: any) => {
        const newActions = [...ruleActions];
        newActions[index] = { ...newActions[index], [field]: value };
        setRuleActions(newActions);
    };

    const getInitials = () => {
        if (!userProfile?.display_name) return 'JD';
        return userProfile.display_name.substring(0, 2).toUpperCase();
    };

    const navItems = [
        { path: '/', label: 'Home', icon: Home, activeColor: 'bg-[#02FF9D]', activeText: 'text-[#020617]' },
        { path: '/budget', label: 'Budget', icon: Wallet, activeColor: 'bg-[#2E93FA]', activeText: 'text-white' },
        { path: '/activity', label: 'Activity', icon: Activity, activeColor: 'bg-[#FFB020]', activeText: 'text-[#020617]' },
        { path: '/insights', label: 'Insights', icon: Sparkles, activeColor: 'bg-[#9D4EDD]', activeText: 'text-white' },
        { path: '/profile', label: 'Profile', icon: User, activeColor: 'bg-[#F8FAFC]', activeText: 'text-[#020617]' }
    ];

    const isHome = location.pathname === '/';

    return (
        <div className="flex flex-col min-h-screen relative text-slate-100 bg-[#020617]">
            
            {/* --- GOD VIEW HEADER (Home Only) --- */}
            {isHome && (
                <div className="fixed top-0 left-0 right-0 z-[100] shadow-lg shadow-black/40">
                    {/* Glassmorphism Background Layer */}
                    <div 
                        className="absolute inset-0 bg-gradient-to-b from-[#0F172A] to-[#0F172A]/0 border-b-2 border-white/10"
                        style={{ 
                            backdropFilter: 'blur(12px) saturate(180%)', 
                            WebkitBackdropFilter: 'blur(12px) saturate(180%)' 
                        }}
                    />
                    
                    <div className="relative z-10 px-4 pt-safe-top pb-2">
                        {/* Top Row: Settings | Logo | Bell */}
                        <div className="flex items-center justify-between h-[50px] mb-2">
                            {/* Left: Preferences */}
                            <button 
                                onClick={() => navigate('/settings/preferences')} 
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white transition-colors active:scale-95"
                            >
                                <Settings size={20} />
                            </button>

                            {/* Middle: Logo */}
                            <div className="flex items-center justify-center">
                                <img 
                                    src="/assets/icon.png" 
                                    alt="Relief" 
                                    className="h-8 w-auto opacity-90" 
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                />
                            </div>

                            {/* Right: Notifications */}
                            <button 
                                onClick={() => navigate('/settings/notifications')} 
                                className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-800/50 border border-white/5 text-slate-400 hover:text-white transition-colors active:scale-95 relative"
                            >
                                <Bell size={20} />
                                <span className="absolute top-2.5 right-3 w-1.5 h-1.5 bg-red-500 rounded-full border border-[#08091E]"></span>
                            </button>
                        </div>

                        {/* Bottom Row: Tab Switcher */}
                        <div className="relative h-10 w-full overflow-hidden">
                            <div 
                                className="absolute left-1/2 flex items-center transition-transform duration-300 ease-out"
                                style={{ 
                                    transform: `translateX(calc(-50% + ${activeHomeTab === 'dashboard' ? '52px' : '-52px'}))` 
                                }}
                            >
                                <button 
                                    onClick={() => setActiveHomeTab('dashboard')} 
                                    className={`w-24 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-center transition-all duration-300 ${activeHomeTab === 'dashboard' ? 'bg-emerald-400 text-emerald-950 shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Dashboard
                                </button>
                                <div className="w-2" />
                                <button 
                                    onClick={() => setActiveHomeTab('calendar')} 
                                    className={`w-24 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider text-center transition-all duration-300 ${activeHomeTab === 'calendar' ? 'bg-emerald-400 text-emerald-950 shadow-[0_0_10px_rgba(52,211,153,0.3)]' : 'text-slate-500 hover:text-slate-300'}`}
                                >
                                    Calendar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Smart Assist Banner */}
            <div className={`fixed ${isHome ? 'top-[130px]' : 'top-0'} left-0 right-0 z-[110] transition-transform duration-300 ease-in-out ${isBannerVisible ? 'translate-y-0' : '-translate-y-[300%]'}`}>
                {ruleCandidate && (
                    <div className={`mx-4 p-4 rounded-2xl shadow-2xl border flex items-center justify-between ${ruleCandidate.candidate_type === 'conflict' ? 'bg-orange-900/90 border-orange-500/30' : 'bg-indigo-900/90 border-indigo-500/30'} backdrop-blur-md`}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-full animate-pulse ${ruleCandidate.candidate_type === 'conflict' ? 'bg-orange-500/20' : 'bg-indigo-500/20'}`}>
                                <Sparkles size={16} className={ruleCandidate.candidate_type === 'conflict' ? 'text-orange-300' : 'text-indigo-300'} />
                            </div>
                            <div>
                                <div className="text-[10px] font-bold text-white uppercase tracking-wider">{ruleCandidate.candidate_type === 'conflict' ? 'Conflict' : 'New Rule'}</div>
                                <div className="text-xs text-slate-200 line-clamp-1">{ruleCandidate.merchant || ruleCandidate.name}</div>
                            </div>
                        </div>
                        <button onClick={handleRulePromptClick} className="px-4 py-2 rounded-xl bg-white text-slate-900 text-[10px] font-bold uppercase tracking-widest active:scale-95 transition-transform shadow-lg">
                            {ruleCandidate.candidate_type === 'conflict' ? 'Fix' : 'Add'}
                        </button>
                    </div>
                )}
            </div>

            {/* What If Banner */}
            {ghostTransactions.length > 0 && !isBannerVisible && (
                <div className={`fixed ${isHome ? 'top-[130px]' : 'top-0'} left-0 right-0 z-40 bg-indigo-600 text-white p-2 flex items-center justify-between shadow-lg animate-fade-in border-b border-indigo-400/30`}>
                    <div className="flex items-center gap-2 px-2">
                        <Sparkles size={14} className="text-indigo-200" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Simulation Active</span>
                    </div>
                    <button onClick={clearGhostTransactions} className="bg-white/20 hover:bg-white/30 text-white text-[9px] font-bold uppercase px-3 py-1 rounded-full flex items-center gap-1 transition-colors">
                        Clear <X size={10} />
                    </button>
                </div>
            )}

            {/* Main content - Home gets extra top padding for fixed header */}
            <main className={`flex-grow relative z-10 ${isHome ? 'pt-[115px]' : ''} pb-24`}>
                {children}
            </main>

            {/* Floating Island Navigation */}
            <nav 
                className="fixed bottom-6 left-4 right-4 z-[80] h-16 rounded-full bg-[#0F172A]/10 border-2 border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.6)] flex items-center justify-between p-1.5 overflow-hidden"
                style={{ 
                    backdropFilter: 'blur(12px) saturate(180%)', 
                    WebkitBackdropFilter: 'blur(12px) saturate(180%)' 
                }}
            >
                {navItems.map((item) => {
                    const isActive = location.pathname === item.path;
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.path}
                            onClick={() => navigate(item.path)}
                            className={`flex items-center justify-center h-10 rounded-full transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden whitespace-nowrap ${
                                isActive 
                                ? `px-4 ${item.activeColor} ${item.activeText} shadow-lg` 
                                : 'w-12 text-slate-500 hover:text-slate-300 bg-transparent'
                            }`}
                        >
                            <Icon className={`flex-shrink-0 w-4 h-4 ${isActive ? '' : 'opacity-70'}`} strokeWidth={2.5} />
                            <div className={`overflow-hidden transition-[max-width,opacity] duration-500 ease-out ${isActive ? 'max-w-[100px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0'}`}>
                                <span className="text-[10px] font-bold uppercase tracking-wider block">
                                    {item.label}
                                </span>
                            </div>
                        </button>
                    );
                })}
            </nav>

            {/* Rule Modal */}
            <Modal isOpen={showRuleModal} onClose={() => { setShowRuleModal(false); setRuleCandidate(null); }} title="Quick Rule">
                <div className="space-y-6">
                    <div>
                        <label className="text-[10px] uppercase font-bold text-slate-500">Rule Name</label>
                        <input value={ruleName} onChange={e => setRuleName(e.target.value)} className="w-full p-3 mt-1 text-sm text-white border rounded-xl bg-slate-800/50 border-white/10 outline-none" />
                    </div>
                    <div className="space-y-3 p-3 rounded-xl bg-slate-800/30 border border-white/5">
                        <div className="text-[10px] uppercase font-bold text-slate-500">Conditions</div>
                        {ruleConditions.map((cond, idx) => (
                            <input key={idx} value={cond.value} readOnly className="w-full p-2 text-xs bg-slate-900/50 border border-white/5 rounded-lg text-slate-400 outline-none" />
                        ))}
                    </div>
                    <div className="flex justify-center"><ArrowRight className="w-5 h-5 text-slate-600 rotate-90" /></div>
                    <div className="space-y-3 p-3 rounded-xl bg-emerald-900/10 border border-emerald-500/20">
                        <div className="text-[10px] uppercase font-bold text-emerald-500">Action: Set Category</div>
                        {ruleActions.map((act, idx) => (
                            <input key={idx} value={act.value} onChange={e => updateRuleAction(idx, 'value', e.target.value)} placeholder="Category name..." className="w-full p-2 text-xs bg-slate-900 border border-white/10 rounded-lg text-white outline-none" />
                        ))}
                    </div>
                    <div className="flex gap-3 pt-4 border-t border-white/10">
                        <Button variant="secondary" onClick={() => { setShowRuleModal(false); setRuleCandidate(null); }} className="flex-1">Cancel</Button>
                        <Button onClick={handleRuleSave} className="flex-1">Save Rule</Button>
                    </div>
                </div>
            </Modal>
        </div>
    );
};