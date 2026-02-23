import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './pages/Home';
import { Activity } from './pages/Activity';
import { Budget } from './pages/Budget';
import { Insights } from './pages/Insights';
import { Profile } from './pages/Profile';
import { EditProfileSettings } from './pages/settings/EditProfile';
import { PreferencesSettings } from './pages/settings/Preferences';
import { EditBudgetSettings } from './pages/settings/EditBudget';
import { RulesSettings } from './pages/settings/Rules';
import { Auth } from './pages/Auth';
import { ComingSoon } from './pages/ComingSoon';
import { supabase } from './services/supabase';
import { GlobalProvider, useGlobalContext } from './context/GlobalContext';

// Loading Screen Component
const AppLoader = () => (
    <div className="fixed inset-0 bg-[#020617] flex flex-col items-center justify-center z-50">
        <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-2 border-slate-800"></div>
            <div className="absolute inset-0 rounded-full border-t-2 border-emerald-400 animate-spin"></div>
            <div className="absolute inset-4 rounded-full bg-slate-900 flex items-center justify-center">
                <img src="/assets/icon.png" className="w-8 h-8 opacity-80" onError={(e) => {e.currentTarget.style.display='none'}} />
            </div>
        </div>
        <p className="mt-6 text-xs font-bold text-emerald-500 uppercase tracking-widest animate-pulse">Loading Relief...</p>
    </div>
);

// Main Content Wrapper (consumes context)
const MainContent: React.FC = () => {
    const { isAppLoading } = useGlobalContext();

    if (isAppLoading) return <AppLoader />;

    return (
        <HashRouter>
            <Layout>
                <Routes>
                    <Route path="/" element={<Home />} />
                    <Route path="/activity" element={<Activity />} />
                    <Route path="/budget" element={<Budget />} />
                    <Route path="/insights" element={<Insights />} />
                    <Route path="/profile" element={<Profile />} />
                    
                    {/* Settings Sub-pages */}
                    <Route path="/settings/editprofile" element={<EditProfileSettings />} />
                    <Route path="/settings/preferences" element={<PreferencesSettings />} />
                    <Route path="/settings/budget" element={<EditBudgetSettings />} />
                    <Route path="/settings/rules" element={<RulesSettings />} />
                    
                    {/* Locked Settings Pages */}
                    <Route path="/settings/notifications" element={<ComingSoon />} />
                    <Route path="/settings/security" element={<ComingSoon />} />
                    <Route path="/settings/members" element={<ComingSoon />} />
                    <Route path="/settings/institutions" element={<ComingSoon />} />
                    <Route path="/settings/merchants" element={<ComingSoon />} />
                    <Route path="/settings/data" element={<ComingSoon />} />
                    <Route path="/settings/billing" element={<ComingSoon />} />

                    <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
            </Layout>
        </HashRouter>
    );
};

const App: React.FC = () => {
    const [session, setSession] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            setSession(session);
        });

        return () => subscription.unsubscribe();
    }, []);

    if (loading) {
        return <AppLoader />;
    }

    if (!session) {
        return <Auth />;
    }

    return (
        <GlobalProvider>
            <MainContent />
        </GlobalProvider>
    );
};

export default App;