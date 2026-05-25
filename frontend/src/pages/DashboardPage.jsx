import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import useExpenseStore from '../store/useExpenseStore';
import { LogOut, User, LayoutDashboard, History } from 'lucide-react';
import { Link } from 'react-router-dom';
import BudgetCard from '../components/BudgetCard';
import ExpenseForm from '../components/ExpenseForm';
import ExpenseList from '../components/ExpenseList';
import CategoryBreakdown from '../components/CategoryBreakdown';
import SpendingChart from '../components/SpendingChart';
import AIInsightsPanel from '../components/AIInsightsPanel';
import AlertPopup from '../components/AlertPopup';

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const { fetchCurrentBudget, fetchExpenses, fetchSummary } = useExpenseStore();
  
  const [alertOpen, setAlertOpen] = useState(false);
  const [alertPercent, setAlertPercent] = useState(0);

  useEffect(() => {
    fetchCurrentBudget();
    fetchExpenses();
    fetchSummary();
  }, []);

  const handleAlertTrigger = (percentage) => {
    setAlertPercent(percentage);
    setAlertOpen(true);
  };

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-20">
      <AlertPopup
        isOpen={alertOpen}
        onClose={() => setAlertOpen(false)}
        spendingPercentage={alertPercent}
      />

      <header className="glass-panel border-b border-slate-800/80 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <LayoutDashboard className="text-indigo-400" size={20} />
          <h1 className="text-base font-bold uppercase tracking-wider text-white">Smart Spend AI</h1>
        </div>

        <div className="flex items-center gap-4">
          <Link
            to="/history"
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors"
          >
            <History size={16} />
            History
          </Link>

          <div className="h-4 w-px bg-slate-800"></div>

          <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 bg-slate-900/50 border border-slate-800 px-3 py-1.5 rounded-full">
            <User size={12} className="text-indigo-400" />
            <span>{user?.name}</span>
          </div>

          <button
            onClick={logout}
            className="p-2 bg-slate-800/50 hover:bg-red-500/10 text-slate-400 hover:text-red-400 border border-slate-800 rounded-xl transition-all cursor-pointer"
          >
            <LogOut size={14} />
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="space-y-8 lg:col-span-1">
            <BudgetCard />
            <ExpenseForm onAlertTriggered={handleAlertTrigger} />
            <CategoryBreakdown />
          </div>

          <div className="space-y-8 lg:col-span-2">
            <AIInsightsPanel />
            <SpendingChart />
            <ExpenseList />
          </div>
        </div>
      </main>
    </div>
  );
}
