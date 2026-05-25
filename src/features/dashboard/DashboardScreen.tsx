import { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Bell, User as UserIcon, Sparkles, ChevronRight, ShoppingBag, Coffee, Car, Trash2, ArrowDownLeft, ArrowUpRight, Activity, LogOut, Target, AlertCircle, Mic, Shield, Zap, RefreshCw, Plus, Settings } from 'lucide-react';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthProvider';
import { TransactionType, BudgetPeriod } from '../../db/models';
import { isSameMonth } from 'date-fns';
import { insightsService } from '../insights/GeminiInsightsService';
import { scoreCalculator } from '../money_score/MoneyScoreCalculator';
import { EmptyState } from '../../core/ui/EmptyState';

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
      {displayValue.toLocaleString('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0, maximumFractionDigits: 0 })}
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
        const now = Date.now();
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
    
    // We don't have historical scores here for simplicity, just current month
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
      // Only fetch if 60 seconds have passed since the last fetch to prevent quota exhaustion
      if (now - lastAlertFetchTime.current < 60000) return;

      if (projection >= budgetLimit * 0.9 && monthlySpent.total > 0) {
        lastAlertFetchTime.current = now;
        try {
          const dayOfMonth = new Date().getDate();
          const daysInMonth = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate();
          
          const response = await fetch('/api/ai/budget-alert', {
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
              dayOfMonth
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
    
    // Slight debounce to let initial data settle
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
      // Debounce the AI fetch to prevent rapid calls during initial data loading
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

  const handleSwipeDelete = async (id: string) => {
    try {
      await db.transactions.update(id, { isDeleted: 1 });
    } catch (error) {
      console.error("Failed to delete transaction:", error);
    }
  };

  return (
    <div className="p-6 pb-32">
      {/* Top Bar */}
      <motion.header 
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="flex items-center justify-between mb-8 mt-2 sticky top-0 z-50 py-2 backdrop-blur-md -mx-6 px-6"
      >
        <div 
          className="flex items-center gap-3 cursor-pointer group"
          onClick={() => setIsProfileMenuOpen(true)}
        >
          <div className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center overflow-hidden glow-primary">
            {user?.photoURL ? (
              <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <UserIcon size={20} className="text-gray-400" aria-label="User Profile" />
            )}
          </div>
          <div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.2em] select-none">Welcome back</p>
            <h2 className="text-sm font-bold text-white tracking-wide select-none">{user?.displayName?.split(' ')[0] || 'User'}</h2>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleResetData}
            disabled={isResetting}
            className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center transition-all hover:bg-warning/10 active:scale-95 group" 
            aria-label="Reset Data"
          >
            <RefreshCw size={16} className={`text-gray-400 group-hover:text-warning transition-colors ${isResetting ? 'animate-spin' : ''}`} />
          </button>
          <button className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center relative transition-all hover:bg-white/5 active:scale-95 group" aria-label="Check Notifications">
            <Bell size={18} className="text-gray-400 group-hover:text-primary transition-colors" aria-hidden="true" />
            <span className="absolute top-2.5 right-2.5 w-1.5 h-1.5 bg-primary rounded-full animate-pulse"></span>
          </button>
          <button 
            onClick={logout} 
            className="w-10 h-10 rounded-xl bg-surface border border-white/10 flex items-center justify-center transition-all hover:bg-error/10 active:scale-95 group" 
            aria-label="Logout"
          >
            <LogOut size={16} className="text-gray-400 group-hover:text-error transition-colors" />
          </button>
        </div>
      </motion.header>

      {/* Balance Hero Card */}
      <motion.section 
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 25, delay: 0.1 }}
        className="glass-card rounded-[32px] p-8 mb-6 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-full h-full bg-gradient-to-br from-primary/10 via-transparent to-transparent pointer-events-none"></div>
        
        {initialBalanceState === null ? (
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-primary mb-3">
              <Sparkles size={18} className="animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-[0.25em]">Unlock SmartSpend AI</span>
            </div>
            <h3 className="text-xl font-extrabold text-white mb-2 leading-tight">Welcome to SmartSpend!</h3>
            <p className="text-white/60 text-xs mb-6 max-w-sm">
              Please enter your starting available balance to unlock manual entry, voice parsing, receipt scanning, and AI analytics.
            </p>
            <div className="flex gap-3">
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
                  className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 text-white font-bold outline-none focus:border-primary/50 transition-colors"
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
              <p className="text-error text-[10px] mt-2 font-bold uppercase tracking-wider">{initBalError}</p>
            )}
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-4 relative z-10">
              <p className="text-white/60 font-bold text-[10px] uppercase tracking-[0.2em]">Available Balance</p>
              <button 
                onClick={() => setIsAddBalanceOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/10 hover:bg-white/15 active:scale-95 transition-all text-[10px] font-black uppercase tracking-wider text-white border border-white/5 shadow-md cursor-pointer"
              >
                <Plus size={12} className="text-primary animate-pulse" />
                <span>Add Balance</span>
              </button>
            </div>
            
            <div 
              onClick={() => setIsAddBalanceOpen(true)}
              className="text-[3.5rem] leading-none font-display font-bold tracking-tighter relative z-10 text-white mb-10 drop-shadow-lg cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-transform"
            >
              {totalBalance < 0 ? "-" : ""}
              <AnimatedCounter value={Math.abs(totalBalance)} />
            </div>

            <div className="relative z-10 bg-black/40 backdrop-blur-md rounded-2xl p-5 border border-white/5">
              {!isBudgetSet ? (
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-error/10 border border-error/20 flex items-center justify-center text-error animate-pulse">
                      <Target size={20} />
                    </div>
                    <div>
                      <span className="text-[9px] text-white/40 font-bold uppercase tracking-widest block mb-0.5">Monthly Goal</span>
                      <span className="text-lg font-black text-white/50 tracking-tight leading-none">
                        Not Set
                      </span>
                    </div>
                  </div>
                  <button
                    onClick={() => navigate('/budget')}
                    className="px-4 py-2.5 bg-primary hover:bg-primary-light active:scale-95 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-primary/20 flex items-center gap-1.5"
                  >
                    <Plus size={12} />
                    <span>Set Budget</span>
                  </button>
                </div>
              ) : (
                <>
                  <div className="flex justify-between items-center mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse"></div>
                      <span className="text-[10px] text-white/60 font-bold uppercase tracking-widest">Monthly Goal</span>
                    </div>
                    <span className="text-white text-sm font-mono font-black tracking-wider bg-primary/20 border border-primary/30 px-2 py-0.5 rounded-md">
                      ₹{budgetLimit.toLocaleString()}
                    </span>
                  </div>
                  
                  <div className="w-full bg-white/10 rounded-full h-1.5 overflow-hidden mb-3">
                    <motion.div 
                      initial={{ width: 0 }}
                      animate={{ width: `${budgetProgress}%` }}
                      transition={{ duration: 1.5, ease: "circOut", delay: 0.5 }}
                      className={`h-full rounded-full bg-gradient-to-r ${
                        budgetProgress > 90 ? 'from-error to-error/50 shadow-[0_0_10px_rgba(244,63,94,0.5)]' : 
                        budgetProgress > 70 ? 'from-warning to-warning/50' : 'from-primary to-primary/50 shadow-[0_0_10px_rgba(99,102,241,0.5)]'
                      }`}
                    />
                  </div>

                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-1.5">
                      <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Spent</p>
                      <p className="text-[11px] text-white font-mono font-bold tracking-wider">₹{monthlySpent.total.toLocaleString()}</p>
                    </div>
                    <span className={`text-[10px] font-black tracking-tighter ${budgetProgress > 90 ? 'text-error' : 'text-white/40'}`}>
                      {budgetProgress.toFixed(0)}%
                    </span>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </motion.section>

      {/* Health Score Mini-Card */}
      <motion.section
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.2 }}
        onClick={() => navigate('/score')}
        className="glass-card rounded-[2.5rem] p-6 mb-8 flex items-center justify-between cursor-pointer group active:scale-95 transition-all relative overflow-hidden"
      >
        <div className="absolute inset-0 bg-gradient-to-r from-success/5 via-transparent to-transparent opacity-40" />
        <div className="flex items-center gap-4 relative z-10">
          <div className="w-14 h-14 rounded-2xl bg-success/10 border border-success/20 flex items-center justify-center text-success overflow-hidden relative">
            <Shield size={24} className="relative z-10" />
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
               className="absolute inset-0 border border-success/20 rounded-full scale-150 border-dashed"
            />
          </div>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-success/60 mb-0.5">Health Score</p>
            <div className="flex items-baseline gap-2">
               <h3 className="text-2xl font-black text-white">{healthScore}</h3>
               <span className="text-[10px] font-bold text-white/40 uppercase">{healthGrade}</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col items-end relative z-10">
           <Zap size={16} className="text-primary-light mb-2 animate-pulse" />
           <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-primary-light">
              <span>View Data</span>
              <ChevronRight size={14} />
           </div>
        </div>
      </motion.section>

      {/* Quick Stats Row: Category Budgets */}
      <div className="mb-8">
        <div className="flex justify-between items-end mb-4">
          <h3 className="text-lg title-bold">Budget Progress</h3>
          <button 
            onClick={() => navigate('/budget')}
            className="text-xs text-primary font-bold uppercase tracking-widest"
          >
            Manage
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
                className="min-w-[160px] bg-surface p-4 rounded-3xl border border-white/5 flex-shrink-0"
              >
                <div className="flex justify-between items-start mb-4">
                  <div className={`w-10 h-10 bg-white/5 text-gray-400 rounded-2xl flex items-center justify-center`}>
                    <Icon size={20} aria-hidden="true" />
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${
                    progress > 90 ? 'bg-error/20 text-error' : 'bg-primary/20 text-primary'
                  }`}>
                    {progress.toFixed(0)}%
                  </span>
                </div>
                <p className="text-gray-400 text-[10px] font-bold uppercase tracking-widest mb-1">{categoryNames[catId] || catId}</p>
                <p className="text-white font-mono font-semibold text-sm mb-2">₹{spent} / ₹{budget.amount}</p>
                <div className="w-full bg-black/40 h-1 rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    className={`h-full rounded-full ${progress > 90 ? 'bg-error' : 'bg-primary'}`}
                  />
                </div>
              </motion.div>
            );
          })}
          {budgets.filter(b => b.categoryId !== 'global').length === 0 && (
            <div className="w-full py-8 bg-surface/50 rounded-3xl border border-dashed border-white/10 flex flex-col items-center justify-center">
              <p className="text-gray-500 text-xs font-medium mb-3">No category budgets set</p>
              <button 
                onClick={() => setIsAddBalanceOpen(true)}
                className="text-xs text-primary font-bold uppercase tracking-widest px-4 py-2 bg-primary/10 rounded-xl"
              >
                Set One Now
              </button>
            </div>
          )}
        </div>
      </div>


      {/* Add Balance Modal */}
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
              className="relative w-full max-w-md bg-surface border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden glass-card text-center"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -z-10" />
              
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
                <Plus size={32} />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Add Balance</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Add money to your available balance. This will create a dynamic Credit transaction in your database history.
              </p>

              <div className="space-y-4 mb-6">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-white/50">₹</span>
                  <input 
                    type="number"
                    autoFocus
                    value={addBalanceInput}
                    onChange={(e) => {
                      setAddBalanceInput(e.target.value);
                      if (addBalanceError) setAddBalanceError(null);
                    }}
                    placeholder="0"
                    className="w-full h-16 bg-black/40 border border-white/10 rounded-2xl pl-12 pr-6 text-2xl font-bold text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors text-left"
                  />
                </div>

                <div className="relative">
                  <input 
                    type="text"
                    value={addBalanceNote}
                    onChange={(e) => setAddBalanceNote(e.target.value)}
                    placeholder="Note (e.g. Gift, Refund, Cash)"
                    className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl px-5 text-white placeholder:text-white/30 outline-none focus:border-primary/50 transition-colors text-sm"
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
                  className="flex-1 h-14 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/95 shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer"
                >
                  Confirm
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Recent Transactions List */}
      <div className="mb-10">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center gap-2">
            <h3 className="text-xl title-bold !mb-0">Activity</h3>
            <span className="px-2 py-0.5 bg-white/5 rounded-full text-[10px] text-white/40 font-bold uppercase tracking-widest">Recent</span>
          </div>
          <button 
            onClick={() => navigate('/transactions')} 
            className="text-[10px] text-primary font-black uppercase tracking-[0.2em] hover:text-white transition-colors" 
            aria-label="View all transactions"
          >
            View All
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
                 className="flex items-center justify-between p-5 glass-card rounded-[2rem] group"
               >
                 <div className="flex items-center space-x-4">
                   <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform group-hover:scale-105 ${!isCredit ? 'bg-error/10 text-error' : 'bg-success/10 text-success'}`}>
                     {!isCredit ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                   </div>
                   <div>
                     <p className="font-bold text-white text-sm tracking-tight mb-0.5 leading-none">
                       {t.merchantName || categoryNames[t.categoryId] || t.categoryId}
                     </p>
                     <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">
                       {t.note ? (t.note.length > 20 ? t.note.substring(0, 20) + '...' : t.note) : new Date(t.dateTime).toLocaleDateString([], { month: 'short', day: 'numeric'})}
                     </p>
                   </div>
                 </div>
                 <div className="text-right">
                    <p className={`font-display text-base font-bold ${!isCredit ? 'text-white' : 'text-success'}`}>
                      {!isCredit ? '-' : '+'}₹{t.amount.toLocaleString()}
                    </p>
                    <p className="text-[9px] text-white/20 font-mono font-bold">{new Date(t.dateTime).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}</p>
                 </div>
               </motion.div>
            );
          })}
          {recentTransactions.length === 0 && (
            <EmptyState 
              title="It's quiet here"
              description="Add a transaction to see your spending activity."
            />
          )}
        </div>
      </div>

      {/* Profile Menu Overlay */}
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
              className="relative w-full max-w-md bg-surface border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl glass-card overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[80px] rounded-full -z-10" />
              
              <div className="flex items-center gap-4 mb-8">
                <div className="w-16 h-16 rounded-2xl bg-surface border border-white/10 flex items-center justify-center overflow-hidden glow-primary">
                  {user?.photoURL ? (
                    <img src={user.photoURL} alt="User Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <UserIcon size={32} className="text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="text-xl font-bold text-white tracking-wide">{user?.displayName || 'User'}</h3>
                  <p className="text-sm text-gray-400">{user?.email || 'No email provided'}</p>
                </div>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setIsProfileMenuOpen(false);
                    // Open settings or navigate
                  }}
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/5 transition-colors"
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
                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-white/5 hover:bg-error/10 border border-white/5 hover:border-error/20 transition-colors group"
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
                  className="text-gray-500 font-bold uppercase tracking-widest text-xs hover:text-white transition-colors"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Floating Budget Alert Popup Modal */}
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
                  className="flex-1 h-14 rounded-2xl bg-error text-white font-semibold hover:bg-error/90 shadow-lg shadow-error/20 active:scale-95 transition-all cursor-pointer"
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
