/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect, lazy, Suspense } from 'react';
import { Layout } from './core/ui/Layout';
import DashboardScreen from './features/dashboard/DashboardScreen';

// Lazy load non-essential screens to keep initial bundle size minimal
const TransactionsScreen = lazy(() => import('./features/transactions/TransactionsScreen'));
const AddExpenseScreen = lazy(() => import('./features/add_expense/AddExpenseScreen'));
const SmsDetectorScreen = lazy(() => import('./features/sms_detector/SmsDetectorScreen'));
const InsightsScreen = lazy(() => import('./features/insights/InsightsScreen'));
const MoneyScoreScreen = lazy(() => import('./features/money_score/MoneyScoreScreen'));
const OnboardingScreen = lazy(() => import('./features/onboarding/OnboardingScreen'));
const SetBudgetScreen = lazy(() => import('./features/budget/SetBudgetScreen'));
const InstallGuideScreen = lazy(() => import('./features/pwa/InstallGuideScreen').then(module => ({ default: module.InstallGuideScreen })));
const LandingPage = lazy(() => import('./features/landing/LandingPage'));

// Import Privacy Policy dynamically later
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

import { AuthProvider } from './core/auth/AuthProvider';
import { Toaster } from 'react-hot-toast';
import { NOTIFICATION_MESSAGES, requestNotificationPermission, showNotification } from './core/utils/notifications';

function ScreenSkeleton() {
  return (
    <div className="p-6 space-y-6 bg-[#0B0F1A] min-h-screen text-white pt-safe animate-pulse">
      <div className="flex justify-between items-center">
        <div className="w-32 h-6 bg-white/5 rounded-xl"></div>
        <div className="w-10 h-10 bg-white/5 rounded-xl"></div>
      </div>
      <div className="w-full h-44 bg-white/5 rounded-[2rem] border border-white/5"></div>
      <div className="w-full h-12 bg-white/5 rounded-[2rem] border border-white/5"></div>
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="w-full h-20 bg-white/5 rounded-[2rem] border border-white/5"></div>
        ))}
      </div>
    </div>
  );
}

export default function App() {
  const [hasSeenOnboarding, setHasSeenOnboarding] = useState(true);
  const [isInitializing, setIsInitializing] = useState(true);

  useEffect(() => {
    // Check if user has seen onboarding
    const seen = localStorage.getItem('has_seen_onboarding');
    setHasSeenOnboarding(!!seen);
    setIsInitializing(false);
  }, []);

  useEffect(() => {
    const updateActivity = () => localStorage.setItem('LAST_ACTIVITY', Date.now().toString());
    
    // Set initial activity
    updateActivity();

    // Add listeners
    window.addEventListener('click', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);

  useEffect(() => {
    const checkInterval = setInterval(async () => {
      const lastActivity = localStorage.getItem('LAST_ACTIVITY');
      if (!lastActivity) return;

      const last = parseInt(lastActivity, 10);
      const now = Date.now();
      const ONE_HOUR = 60 * 60 * 1000;

      if (now - last > ONE_HOUR) {
        // Check if we already notified recently to avoid spam (e.g., notify at most once per hour)
        const lastNotified = localStorage.getItem('LAST_NOTIFIED');
        if (lastNotified && (now - parseInt(lastNotified, 10) < ONE_HOUR)) return;

        const granted = await requestNotificationPermission();
        if (granted) {
          const msg = NOTIFICATION_MESSAGES[Math.floor(Math.random() * NOTIFICATION_MESSAGES.length)];
          showNotification(msg);
          localStorage.setItem('LAST_NOTIFIED', now.toString());
        }
      }
    }, 5 * 60 * 1000); // Check every 5 minutes

    return () => clearInterval(checkInterval);
  }, []);

  if (isInitializing) return null;

  if (!hasSeenOnboarding) {
    return (
      <Suspense fallback={<ScreenSkeleton />}>
        <OnboardingScreen onComplete={() => setHasSeenOnboarding(true)} />
      </Suspense>
    );
  }

  return (
    <AuthProvider>
      <Toaster 
        position="top-center" 
        reverseOrder={false}
        toastOptions={{
          style: {
            background: '#11101C',
            color: '#FFF',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '1.5rem',
            fontFamily: 'Sora, sans-serif',
            fontSize: '13px',
            fontWeight: 'bold',
            padding: '12px 24px',
            boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
          }
        }} 
      />
      <BrowserRouter>
        <Suspense fallback={<ScreenSkeleton />}>
          <Routes>
            <Route path="/" element={<Layout />}>
              <Route index element={<DashboardScreen />} />
              <Route path="transactions" element={<TransactionsScreen />} />
              <Route path="add" element={<AddExpenseScreen />} />
              <Route path="sms" element={<SmsDetectorScreen />} />
              <Route path="insights" element={<InsightsScreen />} />
              <Route path="score" element={<MoneyScoreScreen />} />
              <Route path="budget" element={<SetBudgetScreen />} />
              <Route path="install-guide" element={<InstallGuideScreen />} />
              <Route path="privacy" element={<PrivacyPolicy />} />
            </Route>
            <Route path="/landing" element={<LandingPage />} />
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
