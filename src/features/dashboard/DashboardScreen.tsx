import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  Bell, User as UserIcon, Sparkles, ChevronRight, ShoppingBag, Coffee, 
  Car, Trash2, ArrowDownLeft, ArrowUpRight, Activity, LogOut, Target, 
  AlertCircle, Mic, Shield, Zap, RefreshCw, Plus, Settings 
} from 'lucide-react';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthProvider';
import { TransactionType, BudgetPeriod } from '../../db/models';
import { isSameMonth } from 'date-fns';
import { insightsService } from '../insights/GeminiInsightsService';
import { scoreCalculator } from '../money_score/MoneyScoreCalculator';
import { EmptyState } from '../../core/ui/EmptyState';

import { BillsManager, Bill } from '../../lib/billsManager';
import { AnomalyDetector } from '../../lib/anomalyDetector';
import { BurnRatePredictor, BurnRateProjection } from '../../lib/burnRatePredictor';
import { AmountDisplay } from '../../core/ui/components/AmountDisplay';
import { GlassCard } from '../../core/ui/components/GlassCard';

const categoryIcons: Record<string, any> = {
  'shopping': ShoppingBag,
  'food_dining': Coffee,
  'transportation': Car,
  'entertainment': Activity,
  'bills_utilities': Activity,
  'salary': Activity,
  'other': Activity,
};

const categoryNames: Record<string, string> = {
  'food_dining': 'Dining',
  'transportation': 'Transport',
  'shopping': 'Shopping',
  'entertainment': 'Entertainment',
  'bills_utilities': 'Bills',
  'salary': 'Salary',
  'other': 'Other'
};

function AnimatedCounter({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    const duration = 1200;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      // Ease out expo
      const easeProgress = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);
      setDisplayValue(value * easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };

    requestAnimationFrame(animate);
  }, [value]);

  return (
    <span>
      {displayValue.toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
    </span>
  );
}

export default function DashboardScreen() {
  const [showTip, setShowTip] = useState(true);
  const navigate = useNavigate();
  const transactions = useLiveQuery(() => db.transactions.where('isDeleted').equals(0).reverse().sortBy('dateTime')) || [];
  
  const { user, logout } = useAuth();
  const [smartGreeting, setSmartGreeting] = useState<string | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [isBudgetAlertOpen, setIsBudgetAlertOpen] = useState(false);

  const [upcomingBills, setUpcomingBills] = useState<Bill[]>([]);
  const [anomalies, setAnomalies] = useState<any[]>([]);
  const [burnRateProjection, setBurnRateProjection] = useState<BurnRateProjection | null>(null);

  useEffect(() => {
    // Check and process due recurring transactions on launch
    import('../../lib/recurringManager').then(({ RecurringManager }) => {
      RecurringManager.checkAndProcessDueRecurring().catch(console.warn);
    });

    const loadPremiumDashboardFeatures = async () => {
      try {
        const allBills = await BillsManager.getAllBills();
        const today = new Date().getDate();
        // filter bills due in next 7 days
        const dueSoon = allBills.filter(b => b.isPaid === 0 && (b.dueDay >= today && b.dueDay <= today + 7));
        setUpcomingBills(dueSoon);

        const activeAnom = await AnomalyDetector.getUnacknowledgedAnomalies();
        setAnomalies(activeAnom);

        const proj = await BurnRatePredictor.calculateProjection();
        setBurnRateProjection(proj);
      } catch (e) {
        console.warn("Failed to load dashboard premium items:", e);
      }
    };

    loadPremiumDashboardFeatures();
    
    // Check and trigger weekly sunday push digest
    import('../../lib/weeklyDigestManager').then(({ WeeklyDigestManager }) => {
      WeeklyDigestManager.triggerSundayPushNotification().catch(console.warn);
    });
  }, [transactions]);
  
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const globalBudget = budgets.find(b => b.categoryId === 'global');

  const handleResetData = async () => {
    if (window.confirm('Are you sure you want to clear all transactions and budgets? This cannot be undone.')) {
      setIsResetting(true);
      try {
        await db.clearAllData();
        window.location.reload();
      } catch (error) {
        console.error("Reset failed", error);
        alert("Reset failed");
      } finally {
        setIsResetting(false);
      }
    }
  };
  
  const monthlySpent = useLiveQuery(() => 
    db.transactions.toArray().then(arr => {
      const currentMonthTx = arr.filter(t => {
        try {
          return t.isDeleted === 0 && 
            t.type === TransactionType.DEBIT && 
            isSameMonth(new Date(t.dateTime), new Date());
        } catch (e) {
          return false;
        }
      });
      
      const total = currentMonthTx.reduce((acc, t) => acc + t.amount, 0);
      const catTotals: Record<string, number> = {};
      currentMonthTx.forEach(t => {
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
      });
      
      return { total, catTotals };
    }).catch(err => {
      console.error("Failed to calculate monthly spent:", err);
      return { total: 0, catTotals: {} };
    })
  ) || { total: 0, catTotals: {} };

  const budgetLimit = globalBudget?.amount || 0;
  const budgetProgress = budgetLimit > 0 ? Math.min((monthlySpent.total / budgetLimit) * 100, 100) : 0;
  const isBudgetSet = budgetLimit > 0;

  const recentTransactions = transactions.slice(0, 5);

  const [initialBalanceState, setInitialBalanceState] = useState<number | null>(() => {
    const stored = localStorage.getItem('initial_balance');
    return stored ? Number(stored) : null;
  });

  const [initBalInput, setInitBalInput] = useState('');
  const [initBalError, setInitBalError] = useState<string | null>(null);

  const [isAddBalanceOpen, setIsAddBalanceOpen] = useState(false);
  const [addBalanceInput, setAddBalanceInput] = useState('');
  const [addBalanceNote, setAddBalanceNote] = useState('');
  const [addBalanceError, setAddBalanceError] = useState<string | null>(null);

  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);

  const handleAddBalanceSubmit = async () => {
    const val = Number(addBalanceInput);
    if (!addBalanceInput || isNaN(val) || val <= 0) {
      setAddBalanceError("Please enter a valid positive amount");
      return;
    }
    
    try {
      const { v4: uuidv4 } = await import('uuid');
      await db.transactions.add({
        id: uuidv4(),
        amount: val,
        currency: 'INR',
        type: TransactionType.CREDIT,
        categoryId: 'other',
        dateTime: Date.now(),
        note: addBalanceNote.trim() || 'Manual Balance Top-up',
        source: 'manual',
        isDeleted: 0,
        isConfirmed: 1,
        isRecurring: 0,
        tags: ['top-up'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Update Global Budget Limit and History
      const globalBudget = await db.budgets.get({ categoryId: 'global' });
      const newReason = addBalanceNote.trim() ? `Added Available Balance: ${addBalanceNote.trim()}` : 'Added Available Balance';

      if (globalBudget) {
        const newAmount = globalBudget.amount + val;
        await db.budgets.update(globalBudget.id, {
          amount: newAmount
        });
        
        await db.budgetHistory.add({
          id: uuidv4(),
          budgetId: globalBudget.id,
          categoryId: 'global',
          oldAmount: globalBudget.amount,
          newAmount: newAmount,
          reason: newReason,
          changedAt: Date.now()
        });
      } else {
        const newId = uuidv4();
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
        const endOfMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0, 23, 59, 59, 999).getTime();

        await db.budgets.add({
          id: newId,
          categoryId: 'global',
          amount: val,
          period: BudgetPeriod.MONTHLY,
          startDate: startOfMonth,
          endDate: endOfMonth,
          alertThreshold: 0.8,
          isActive: 1
        });
        
        await db.budgetHistory.add({
          id: uuidv4(),
          budgetId: newId,
          categoryId: 'global',
          oldAmount: 0,
          newAmount: val,
          reason: newReason,
          changedAt: Date.now()
        });
      }
      
      setIsAddBalanceOpen(false);
      setAddBalanceInput('');
      setAddBalanceNote('');
      setAddBalanceError(null);
    } catch (e) {
      console.error(e);
      setAddBalanceError("Failed to add balance. Please try again.");
    }
  };

  useEffect(() => {
    const checkBalance = () => {
      const stored = localStorage.getItem('initial_balance');
      setInitialBalanceState(stored ? Number(stored) : null);
    };
    const interval = setInterval(checkBalance, 1000);
    return () => clearInterval(interval);
  }, []);

  const totalBalance = (initialBalanceState || 0) + transactions.reduce((acc, t) => t.type === 'CREDIT' ? acc + t.amount : acc - t.amount, 0);

  // Calculate Health Score for Dashboard
  const { healthScore, healthGrade } = useMemo(() => {
    const currentMonthTx = transactions.filter(t => {
      try {
        return isSameMonth(new Date(t.dateTime), new Date());
      } catch (e) {
        return false;
      }
    });
    let tSpent = 0;
    let inc = 0;
    const catTotals: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};

    currentMonthTx.forEach(t => {
      if (t.type === TransactionType.DEBIT) {
        tSpent += t.amount;
        catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
        const dk = new Date(t.dateTime).getDate().toString();
        dailyMap[dk] = (dailyMap[dk] || 0) + t.amount;
      } else {
        inc += t.amount;
      }
    });
    
    const res = scoreCalculator.calculateScore(tSpent, inc, catTotals, Object.values(dailyMap), 0, 0, []);
    return { healthScore: res.total, healthGrade: res.grade };
  }, [transactions]);

  const [aiBudgetAlert, setAiBudgetAlert] = useState<string | null>(null);

  const { predictiveAlert, projection } = useMemo(() => {
    if (!isBudgetSet || monthlySpent.total === 0) return { predictiveAlert: null, projection: 0 };
    
    const dayOfMonth = new Date().getDate();
    const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
    const avgDaily = monthlySpent.total / dayOfMonth;
    const projectedSpent = avgDaily * daysInMonth;
    
    if (projectedSpent > budgetLimit) {
      const exceedBy = projectedSpent - budgetLimit;
      return { 
        predictiveAlert: `Projected spend: ₹${projectedSpent.toFixed(0)} (₹${exceedBy.toFixed(0)} over)`,
        projection: projectedSpent
      };
    }
    return { predictiveAlert: null, projection: projectedSpent };
  }, [monthlySpent, budgetLimit, isBudgetSet]);

  const lastAlertFetchTime = useRef(0);

  useEffect(() => {
    const fetchAiAlert = async () => {
      const now = Date.now();
      if (now - lastAlertFetchTime.current < 60000) return;

      if (projection >= budgetLimit * 0.9 && monthlySpent.total > 0) {
        lastAlertFetchTime.current = now;
        try {
          const dayOfMonth = new Date().getDate();
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          
          const response = await fetch('/api/gemini/budget-alert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
              monthlySpent: monthlySpent.total, 
              budgetLimit, 
              currentPeriodTx: transactions.filter(t => {
                try { return isSameMonth(new Date(t.dateTime), new Date()); }
                catch (e) { return false; }
              }),
              daysInMonth,
              dayOfMonth,
              userId: user?.uid
            })
          });
          if (response.ok) {
            const data = await response.json();
            setAiBudgetAlert(data.alert);
          }
        } catch (e) {
          console.error("AI alert failed", e);
        }
      } else {
        setAiBudgetAlert(null);
      }
    };
    
    const timeout = setTimeout(fetchAiAlert, 1500);
    return () => clearTimeout(timeout);
  }, [projection, budgetLimit, monthlySpent.total]);

  useEffect(() => {
    if (predictiveAlert || aiBudgetAlert) {
      setIsBudgetAlertOpen(true);
    }
  }, [predictiveAlert, aiBudgetAlert]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    if (user && totalBalance !== undefined) {
      timeoutId = setTimeout(() => {
        insightsService.getSmartGreeting(
          user.displayName || 'Friend',
          totalBalance,
          monthlySpent.total,
          budgetLimit
        ).then(setSmartGreeting).catch(err => {
          console.error("Smart greeting failed", err);
          setSmartGreeting(`Hi ${user.displayName || 'Friend'}, let's track your spends!`);
        });
      }, 1000);
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [user?.uid, totalBalance, monthlySpent.total, budgetLimit]);

  return (
    <div className="p-6 pb-32 bg-[#0A0A0C] min-h-screen text-white">
      {/* 1. Header Navigation Bar */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between mb-8 mt-2 sticky top-0 z-50 py-3 backdrop-blur-xl bg-[#0A0A0C]/80 -mx-6 px-6 border-b border-white/5"
      >
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setIsProfileMenuOpen(true)}
        >
          <div className="w-12 h-12 rounded-2xl bg-surface border border-white/10 flex items-center justify-center overflow-hidden shadow-lg shadow-primary/20 relative group-hover:border-primary/50 transition-all">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={24} className="text-gray-400" aria-label="User Profile" />
            )}
            <div className="absolute inset-0 bg-primary/10 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <div>
            <span className="text-[10px] text-gray-500 font-extrabold uppercase tracking-widest block mb-0.5 select-none">Welcome back</span>
            <h2 className="text-base font-extrabold text-white tracking-wide group-hover:text-primary transition-colors select-none">
              {user?.displayName?.split(' ')[0] || 'User'}
            </h2>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={handleResetData}
            disabled={isResetting}
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-warning/10 hover:border-warning/30 transition-all active:scale-95 group relative overflow-hidden" 
            aria-label="Reset Data"
          >
            <RefreshCw size={16} className={`text-gray-400 group-hover:text-warning transition-transform duration-500 ${isResetting ? 'animate-spin' : 'group-hover:rotate-180'}`} />
          </button>
          
          <button className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center relative hover:bg-primary/10 hover:border-primary/30 transition-all active:scale-95 group overflow-hidden" aria-label="Notifications">
            <Bell size={18} className="text-gray-400 group-hover:text-primary transition-colors animate-pulse" />
            <span className="absolute top-3.5 right-3.5 w-2 h-2 bg-primary rounded-full shadow-[0_0_10px_#6C63FF]"></span>
          </button>

          <button 
            onClick={logout} 
            className="w-11 h-11 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-error/10 hover:border-error/30 transition-all active:scale-95 group" 
            aria-label="Logout"
          >
            <LogOut size={16} className="text-gray-400 group-hover:text-error transition-colors" />
          </button>
        </div>
      </motion.header>

      {/* 2. Intelligent AI Smart Greeting Banner */}
      {smartGreeting && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8 p-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-l-2 border-primary rounded-r-3xl flex items-center gap-3 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-full bg-primary/5 blur-xl rounded-full" />
          <Sparkles size={16} className="text-primary shrink-0 animate-pulse" />
          <p className="text-xs text-gray-300 leading-relaxed font-semibold italic">
            "{smartGreeting}"
          </p>
        </motion.div>
      )}

      {/* 3. Obsidian Balance Hero Slab */}
      <motion.section 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="relative overflow-hidden rounded-[32px] bg-gradient-to-br from-[#181822] via-[#121217] to-[#0A0A0C] border border-white/10 p-8 mb-8 shadow-[0_30px_60px_-15px_rgba(0,0,0,0.8),0_0_50px_rgba(108,99,255,0.05)]"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full pointer-events-none" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-secondary/5 blur-[60px] rounded-full pointer-events-none" />

        {initialBalanceState === null ? (
          <div className="relative z-10 text-center py-6">
            <div className="flex items-center justify-center gap-2 text-primary mb-4">
              <Sparkles size={20} className="animate-spin" />
              <span className="text-xs font-black uppercase tracking-[0.25em]">Unlock SmartSpend AI</span>
            </div>
            <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">Unlock Available Balance</h3>
            <p className="text-white/60 text-xs mb-6 max-w-sm mx-auto leading-relaxed font-medium">
              Please enter your starting available balance to initialize manual tracking, voice input, receipt scanning, and AI recommendations.
            </p>
            <div className="flex gap-3 max-w-sm mx-auto">
              <div className="relative flex-1">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">₹</span>
                <input 
                  type="number"
                  placeholder="Starting Balance"
                  value={initBalInput}
                  onChange={(e) => {
                    setInitBalInput(e.target.value);
                    setInitBalError(null);
                  }}
                  onKeyDown={async (e) => {
                    if (e.key === 'Enter') {
                      const val = Number(initBalInput);
                      if (!initBalInput || isNaN(val) || val <= 0) {
                        setInitBalError("Please enter a valid balance");
                        return;
                      }
                      localStorage.setItem('initial_balance', val.toString());
                      setInitialBalanceState(val);
                      if (user) {
                        const { doc, setDoc } = await import('firebase/firestore');
                        const { db: fDb } = await import('../../firebase');
                        await setDoc(doc(fDb, `users/${user.uid}`), { initialBalance: val, updatedAt: Date.now() }, { merge: true });
                      }
                    }
                  }}
                  className="w-full h-12 bg-black/45 border border-white/10 rounded-2xl pl-10 pr-4 text-white font-bold outline-none focus:border-primary/50 transition-colors"
                />
              </div>
              <button 
                onClick={async () => {
                  const val = Number(initBalInput);
                  if (!initBalInput || isNaN(val) || val <= 0) {
                    setInitBalError("Please enter a valid balance");
                    return;
                  }
                  localStorage.setItem('initial_balance', val.toString());
                  setInitialBalanceState(val);
                  if (user) {
                    const { doc, setDoc } = await import('firebase/firestore');
                    const { db: fDb } = await import('../../firebase');
                    await setDoc(doc(fDb, `users/${user.uid}`), { initialBalance: val, updatedAt: Date.now() }, { merge: true });
                  }
                }}
                className="h-12 px-6 bg-primary text-white font-bold rounded-2xl active:scale-95 transition-all shadow-lg shadow-primary/20 hover:opacity-90"
              >
                Unlock
              </button>
            </div>
            {initBalError && (
              <p className="text-error text-[10px] mt-3 font-extrabold uppercase tracking-wider">{initBalError}</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 relative z-10">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#6C63FF]" />
                <p className="text-white/50 font-extrabold text-[10px] uppercase tracking-[0.2em] select-none">Available Balance</p>
              </div>
              <button 
                onClick={() => setIsAddBalanceOpen(true)}
                className="flex items-center gap-1.5 px-4 py-2 rounded-2xl bg-white/5 hover:bg-white/10 active:scale-95 transition-all text-[10px] font-black uppercase tracking-widest text-white border border-white/10 shadow-lg cursor-pointer"
              >
                <Plus size={12} className="text-primary" />
                <span>Add Money</span>
              </button>
            </div>
            
            <div 
              onClick={() => setIsAddBalanceOpen(true)}
              className="text-[3.5rem] leading-none font-display font-extrabold tracking-tighter relative z-10 text-white mb-8 hover:scale-[1.02] active:scale-[0.98] transition-transform cursor-pointer flex items-baseline gap-1"
            >
              <span className="text-4xl text-gray-500 font-bold">₹</span>
              <AnimatedCounter value={Math.abs(totalBalance)} />
            </div>

            <div className="relative z-10 bg-black/45 border border-white/5 rounded-3xl p-5 backdrop-blur-md">
              {!isBudgetSet ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-error/10 border border-error/20 flex items-center justify-center text-error animate-pulse">
                      <Target size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 font-extrabold uppercase tracking-widest block mb-0.5">Monthly Goal</span>
                      <span className="text-lg font-black text-white/40 tracking-tight leading-none">
                        Not Configured
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/budget')}
                    className="px-4 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-primary/20 flex items-center gap-1.5 border border-white/10"
                  >
                    <Plus size={12} />
                    <span>Set Limit</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <Target size={14} className="text-primary animate-pulse" />
                      <span className="text-[10px] text-white/50 font-extrabold uppercase tracking-wider">Monthly Limit</span>
                    </div>
                    <span className="text-white text-xs font-mono font-black tracking-wider bg-primary/20 border border-primary/30 px-2.5 py-1 rounded-xl">
                      ₹{budgetLimit.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="w-full bg-white/5 border border-white/5 rounded-full h-2 overflow-hidden mb-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${budgetProgress}%` }}
                      transition={{ duration: 1.5, ease: "circOut", delay: 0.5 }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        budgetProgress > 90 ? 'from-error to-pink-500 shadow-[0_0_12px_rgba(244,63,94,0.4)]' : 
                        budgetProgress > 70 ? 'from-warning to-orange-400' : 'from-primary to-emerald-400 shadow-[0_0_12px_rgba(108,99,255,0.4)]'
                      }`}
                    />
                  </div>

                  <div className="flex justify-between items-center text-xs mb-2">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Total Debited</span>
                      <span className="text-xs text-white font-mono font-black">₹{monthlySpent.total.toLocaleString()}</span>
                    </div>
                    <span className={`text-[10px] font-black tracking-widest uppercase ${budgetProgress > 90 ? 'text-error' : 'text-primary'}`}>
                      {budgetProgress.toFixed(0)}% used
                    </span>
                  </div>

                  {burnRateProjection && (
                    <div className="flex justify-between items-center text-xs border-t border-white/5 pt-2 mt-2">
                      <span className="text-[10px] text-white/40 font-bold uppercase tracking-wider">Projected Burn Spend</span>
                      <span className={`text-xs font-mono font-black ${burnRateProjection.isOverBudget ? 'text-error' : 'text-[#2ED573]'}`}>
                        ₹{burnRateProjection.projectedSpend.toLocaleString()} ({burnRateProjection.percentOfBudget.toFixed(0)}%)
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </>
        )}
      </motion.section>

      {/* 4. Elegant Interactive Gauges (Health Score) */}
      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => navigate('/score')}
        className="relative overflow-hidden rounded-[2.5rem] bg-gradient-to-r from-[#121217] via-[#0E0E12] to-[#0A0A0C] border border-white/5 hover:border-success/20 p-6 mb-8 flex items-center justify-between cursor-pointer group active:scale-95 transition-all shadow-lg"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-transparent to-transparent opacity-40 pointer-events-none" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-success/15 border border-success/25 flex items-center justify-center text-success overflow-hidden relative shadow-[0_0_20px_rgba(16,185,129,0.15)]">
            <Shield size={22} className="relative z-10" />
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 10, ease: "linear" }}
               className="absolute inset-0 border border-success/15 rounded-full scale-150 border-dashed"
            />
          </div>
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-success/70 block mb-0.5">Financial Wellness Score</span>
            <div className="flex items-baseline gap-2">
               <h3 className="text-2xl font-black text-white">{healthScore}</h3>
               <span className="text-[9px] font-extrabold text-white/50 bg-success/20 border border-success/30 px-2 py-0.5 rounded-lg uppercase tracking-wider">{healthGrade}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end relative z-10 shrink-0">
           <div className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-primary-light group-hover:translate-x-1 transition-transform">
              <span>Inspect</span>
              <ChevronRight size={14} />
           </div>
        </div>
      </motion.section>

      {/* 4.5 Active Protocol Alerts (Anomalies & Bills) */}
      <AnimatePresence>
        {(upcomingBills.length > 0 || anomalies.length > 0) && (
          <motion.section 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="mb-8 space-y-4 overflow-hidden"
          >
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-extrabold text-white tracking-tight">Active Protocol Alerts</h3>
              <span className="px-2 py-0.5 bg-[#FF4757]/15 rounded-full text-[9px] text-[#FF4757] font-bold uppercase tracking-widest animate-pulse">Action Required</span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Anomalies */}
              {anomalies.map((anom) => (
                <GlassCard 
                  key={anom.id}
                  glowColor="error"
                  className="p-5 flex flex-col justify-between animate-pulse-glow"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-error/15 border border-error/25 flex items-center justify-center text-error shrink-0">
                      <AlertCircle size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] text-error font-extrabold uppercase tracking-widest block mb-1">Spike Anomaly Flagged</span>
                      <h4 className="text-sm font-bold text-white mb-1 leading-tight">{anom.merchantName}</h4>
                      <p className="text-[11px] text-gray-400 leading-normal">
                        Charged ₹{anom.amount.toLocaleString()}, which is 2.5x+ higher than your category average of ₹{anom.averageSpend.toLocaleString()}!
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await AnomalyDetector.acknowledgeAnomaly(anom.id);
                      setAnomalies(prev => prev.filter(a => a.id !== anom.id));
                    }}
                    className="mt-4 px-4 py-2 bg-error/10 hover:bg-error/20 text-error text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors w-fit border border-error/10 cursor-pointer"
                  >
                    Dismiss Alert
                  </button>
                </GlassCard>
              ))}

              {/* Upcoming Bills */}
              {upcomingBills.map((bill) => (
                <GlassCard 
                  key={bill.id}
                  glowColor="indigo"
                  className="p-5 flex flex-col justify-between"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-[#7C5CFC]/15 border border-[#7C5CFC]/25 flex items-center justify-center text-[#7C5CFC] shrink-0">
                      <Target size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] text-[#7C5CFC] font-extrabold uppercase tracking-widest block mb-1">Upcoming EMI/Bill</span>
                      <h4 className="text-sm font-bold text-white mb-1 leading-tight">{bill.name}</h4>
                      <p className="text-[11px] text-gray-400 leading-normal">
                        Due amount of ₹{bill.amount.toLocaleString()} is coming up on day {bill.dueDay} of this month.
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={async () => {
                      await BillsManager.markAsPaid(bill.id);
                      setUpcomingBills(prev => prev.filter(b => b.id !== bill.id));
                    }}
                    className="mt-4 px-4 py-2 bg-[#7C5CFC]/10 hover:bg-[#7C5CFC]/20 text-[#7C5CFC] text-[10px] font-black uppercase tracking-widest rounded-xl transition-colors w-fit border border-[#7C5CFC]/10 cursor-pointer"
                  >
                    Mark Paid
                  </button>
                </GlassCard>
              ))}
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* 5. Category Budgets Envelope Progress */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-5">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-white tracking-tight">Category Budgets</h3>
            <span className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-white/40 font-bold uppercase tracking-widest">Envelopes</span>
          </div>
          <button 
            onClick={() => navigate('/budget')}
            className="text-[10px] text-primary font-black uppercase tracking-widest hover:text-white transition-colors"
          >
            Adjust Limits
          </button>
        </div>
        
        <div className="flex gap-4 overflow-x-auto no-scrollbar pb-2 -mx-6 px-6">
          {budgets.filter(b => b.categoryId !== 'global').map((budget, i) => {
            const catId = budget.categoryId!;
            const Icon = categoryIcons[catId] || Activity;
            const spent = monthlySpent.catTotals[catId] || 0;
            const progress = Math.min((spent / budget.amount) * 100, 100);
            
            return (
              <motion.div 
                key={budget.id}
                initial={{ x: 20, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                transition={{ delay: 0.2 + (i * 0.1) }}
                className="min-w-[170px] bg-gradient-to-b from-[#121217] to-[#0A0A0C] p-5 rounded-3xl border border-white/5 hover:border-white/10 transition-all flex-shrink-0 relative overflow-hidden"
              >
                <div className="absolute top-0 right-0 w-12 h-12 bg-primary/5 blur-xl rounded-full" />
                <div className="flex justify-between items-start mb-4">
                  <div className="w-10 h-10 bg-white/5 border border-white/5 text-gray-400 rounded-2xl flex items-center justify-center shadow-md">
                    <Icon size={18} />
                  </div>
                  <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider ${
                    progress > 90 ? 'bg-error/15 text-error border border-error/25' : 'bg-primary/15 text-primary border border-primary/25'
                  }`}>
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <p className="text-gray-400 text-[10px] font-extrabold uppercase tracking-widest mb-1.5">{categoryNames[catId] || catId}</p>
                <p className="text-white font-mono font-black text-sm mb-2">₹{spent} <span className="text-[10px] text-gray-500 font-bold uppercase">/ ₹{budget.amount}</span></p>
                <div className="w-full bg-white/5 border border-white/5 h-1.5 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full rounded-full ${progress > 90 ? 'bg-error shadow-[0_0_8px_rgba(244,63,94,0.4)]' : 'bg-primary shadow-[0_0_8px_rgba(99,102,241,0.4)]'}`}
                  />
                </div>
              </motion.div>
            );
          })}
          {budgets.filter(b => b.categoryId !== 'global').length === 0 && (
            <div className="w-full py-8 bg-surface/30 rounded-[32px] border border-dashed border-white/10 flex flex-col items-center justify-center text-center">
              <p className="text-gray-500 text-xs font-semibold mb-3">No category budget limits set</p>
              <button 
                onClick={() => navigate('/budget')}
                className="text-[9px] text-primary font-black uppercase tracking-widest px-4 py-2 bg-primary/15 border border-primary/25 rounded-2xl cursor-pointer hover:bg-primary/20 transition-all active:scale-95"
              >
                Set Limits Now
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 6. Glowing Recent Activity list */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-extrabold text-white tracking-tight">Recent Activity</h3>
            <span className="px-2 py-0.5 bg-white/5 rounded-full text-[9px] text-white/40 font-bold uppercase tracking-widest">Real-time</span>
          </div>
          <button 
            onClick={() => navigate('/transactions')} 
            className="text-[10px] text-primary font-black uppercase tracking-widest hover:text-white transition-colors" 
          >
            History Log
          </button>
        </div>
        
        <div className="space-y-4">
          {recentTransactions.map((t, idx) => {
            const Icon = categoryIcons[t.categoryId] || Activity;
            const isCredit = t.type === 'CREDIT';
            return (
               <motion.div
                 key={t.id}
                 initial={{ x: 20, opacity: 0 }}
                 animate={{ x: 0, opacity: 1 }}
                 transition={{ delay: 0.1 + (idx * 0.05), type: "spring", stiffness: 300, damping: 30 }}
                 className="flex items-center justify-between p-5 bg-gradient-to-r from-[#121217] to-[#0A0A0C] border border-white/5 hover:border-white/10 rounded-[2rem] group transition-all"
               >
                 <div className="flex items-center space-x-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-md ${!isCredit ? 'bg-error/15 text-error border border-error/20' : 'bg-success/15 text-success border border-success/20'}`}>
                     {!isCredit ? <ArrowUpRight size={18} /> : <ArrowDownLeft size={18} />}
                   </div>
                   <div>
                     <p className="font-extrabold text-white text-sm tracking-tight mb-1 leading-none group-hover:text-primary transition-colors">
                       {t.merchantName || categoryNames[t.categoryId] || t.categoryId}
                     </p>
                     <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest leading-none">
                       {t.note ? (t.note.length > 25 ? t.note.substring(0, 25) + '...' : t.note) : new Date(t.dateTime).toLocaleDateString([], { month: 'short', day: 'numeric'})}
                     </p>
                   </div>
                 </div>
                 <div className="text-right shrink-0">
                    <p className={`font-mono text-base font-black tracking-tight ${!isCredit ? 'text-white' : 'text-success'}`}>
                      {!isCredit ? '-' : '+'}₹{t.amount.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-white/20 font-bold uppercase tracking-widest">{new Date(t.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                 </div>
               </motion.div>
            );
          })}
          {recentTransactions.length === 0 && (
            <EmptyState 
              title="No spending logged"
              description="Add a transaction to see your spending activity."
            />
          )}
        </div>
      </div>

      {/* 7. Add Balance Overlay Modal */}
      <AnimatePresence>
        {isAddBalanceOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddBalanceOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 50, opacity: 0 }}
              className="relative w-full max-w-md bg-gradient-to-b from-[#121217] to-[#0A0A0C] border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden glass-card text-center"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -z-10" />
              
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
                <Plus size={32} />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Add Money</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Add funds directly to your wallet. This creates a secure Credit transaction in your local history logs.
              </p>

              <div className="space-y-4 mb-6">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-extrabold text-white/40">₹</span>
                  <input 
                    type="number"
                    autoFocus
                    value={addBalanceInput}
                    onChange={(e) => {
                      setAddBalanceInput(e.target.value);
                      if (addBalanceError) setAddBalanceError(null);
                    }}
                    placeholder="0"
                    className="w-full h-16 bg-black/45 border border-white/10 rounded-2xl pl-12 pr-6 text-2xl font-mono font-black text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors text-left"
                  />
                </div>

                <div className="relative">
                  <input 
                    type="text"
                    value={addBalanceNote}
                    onChange={(e) => setAddBalanceNote(e.target.value)}
                    placeholder="Note (e.g. Salary, Refund, Gift)"
                    className="w-full h-12 bg-black/45 border border-white/10 rounded-2xl px-5 text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors text-sm font-semibold"
                  />
                </div>
                
                <AnimatePresence>
                  {addBalanceError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center justify-center gap-2 text-error text-xs font-bold"
                    >
                      <AlertCircle size={14} />
                      {addBalanceError}
                    </motion.div>
                  )}
                </AnimatePresence>

                {transactions.filter(t => t.type === 'CREDIT' && (t.tags?.includes('top-up') || t.source === 'manual')).length > 0 && (
                  <div className="mt-6 mb-2 text-left">
                    <h4 className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em] mb-3">Recent Additions</h4>
                    <div className="space-y-2 max-h-32 overflow-y-auto no-scrollbar pr-2">
                      {transactions.filter(t => t.type === 'CREDIT' && (t.tags?.includes('top-up') || t.source === 'manual')).slice(0, 10).map(t => (
                        <div key={t.id} className="flex justify-between items-center bg-white/5 rounded-xl p-3 border border-white/5">
                          <div>
                            <p className="text-xs text-white font-medium">{t.note || 'Manual Top-up'}</p>
                            <p className="text-[10px] text-white/40">{new Date(t.dateTime).toLocaleDateString()}</p>
                          </div>
                          <span className="text-primary font-mono font-bold text-sm">+₹{t.amount.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsAddBalanceOpen(false)}
                  className="flex-1 h-14 rounded-2xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleAddBalanceSubmit}
                  className="flex-1 h-14 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer border border-white/10"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 8. Profile Settings Modal Overlay */}
      <AnimatePresence>
        {isProfileMenuOpen && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center sm:items-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsProfileMenuOpen(false)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-md bg-gradient-to-b from-[#121217] to-[#0A0A0C] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl glass-card overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full -z-10" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-white/10 flex items-center justify-center overflow-hidden glow-primary relative">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={32} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{user?.displayName || 'User'}</h3>
                  <p className="text-sm text-gray-400">{user?.email || 'No email registered'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                    <Settings size={20} />
                  </div>
                  <span className="font-semibold text-white">Settings</span>
                </button>

                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    logout();
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-error/10 border border-white/5 hover:border-error/20 transition-colors group text-left"
                >
                  <div className="w-10 h-10 rounded-xl bg-error/20 text-error flex items-center justify-center group-hover:bg-error group-hover:text-white transition-colors">
                    <LogOut size={20} />
                  </div>
                  <span className="font-semibold text-error group-hover:text-white transition-colors">Log Out</span>
                </button>
              </div>

              <div className="mt-8 text-center">
                <button 
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="text-gray-500 font-bold uppercase tracking-widest text-[10px] hover:text-white transition-colors"
                >
                  Close Panel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 9. Predictive AI Budget Warning Modal */}
      <AnimatePresence>
        {isBudgetAlertOpen && (aiBudgetAlert || predictiveAlert) && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBudgetAlertOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 50, opacity: 0 }}
              className="relative w-full max-w-md bg-surface border border-error/30 rounded-[32px] p-8 shadow-2xl overflow-hidden glass-card text-center"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-error/10 blur-[80px] rounded-full -z-10" />
              
              <div className="w-16 h-16 bg-error/10 border border-error/20 rounded-2xl flex items-center justify-center text-error mx-auto mb-6 shadow-[0_0_20px_rgba(244,63,94,0.2)] animate-pulse">
                <AlertCircle size={32} />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2 tracking-tight">⚠️ Budget Warning!</h3>
              
              <div className="space-y-4 mb-8 mt-4 text-left bg-black/40 border border-white/5 rounded-2xl p-5">
                <p className="text-sm text-gray-200 leading-relaxed font-semibold">
                  {predictiveAlert}
                </p>
                {aiBudgetAlert && (
                  <div className="border-t border-white/5 pt-3 mt-3">
                    <p className="text-[10px] text-primary-light font-black uppercase tracking-widest mb-1">AI Recommendation</p>
                    <p className="text-xs text-gray-300 leading-relaxed italic">
                      "{aiBudgetAlert}"
                    </p>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsBudgetAlertOpen(false)}
                  className="flex-1 h-14 rounded-2xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 active:scale-95 transition-all cursor-pointer"
                >
                  Acknowledge
                </button>
                <button 
                  onClick={() => {
                    setIsBudgetAlertOpen(false);
                    navigate('/budget');
                  }}
                  className="flex-1 h-14 rounded-2xl bg-error text-white font-semibold hover:bg-error/90 shadow-lg shadow-error/20 active:scale-95 transition-all cursor-pointer border border-white/10"
                >
                  Adjust Budget
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
