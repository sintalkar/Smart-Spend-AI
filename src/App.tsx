/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { Layout } from './core/ui/Layout';
import DashboardScreen from './features/dashboard/DashboardScreen';
import TransactionsScreen from './features/transactions/TransactionsScreen';
import AddExpenseScreen from './features/add_expense/AddExpenseScreen';
import SmsDetectorScreen from './features/sms_detector/SmsDetectorScreen';
import InsightsScreen from './features/insights/InsightsScreen';
import MoneyScoreScreen from './features/money_score/MoneyScoreScreen';
import AdminRoute from './features/admin/AdminRoute';
import OnboardingScreen from './features/onboarding/OnboardingScreen';
import SetBudgetScreen from './features/budget/SetBudgetScreen';

import { AuthProvider } from './core/auth/AuthProvider';
import { NOTIFICATION_MESSAGES, requestNotificationPermission, showNotification } from './core/utils/notifications';
import { InstallGuideScreen } from './features/pwa/InstallGuideScreen';
import LandingPage from './features/landing/LandingPage';

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
    return <OnboardingScreen onComplete={() => setHasSeenOnboarding(true)} />;
  }

  const isSecretAdminPath = window.location.pathname === '/v90369-secure-access-portal';

  if (isSecretAdminPath) {
    return (
      <AuthProvider>
        <BrowserRouter>
          <div className="min-h-screen bg-background">
            <AdminRoute />
          </div>
        </BrowserRouter>
      </AuthProvider>
    );
  }

  return (
    <AuthProvider>
      <BrowserRouter>
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
          </Route>
          <Route path="/landing" element={<LandingPage />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
