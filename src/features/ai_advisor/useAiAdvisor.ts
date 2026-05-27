import { useEffect, useMemo, useState, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { analyzeSmartAdvisor, AiAdvisorAnalysis } from './aiAdvisorCalculations';

export function useAiAdvisor() {
  const transactions = useLiveQuery(() => db.transactions.where('isDeleted').equals(0).toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  // Read overrides from localStorage or use defaults
  const [incomeOverride, setIncomeOverride] = useState<number>(() => {
    const val = localStorage.getItem('advisor_monthly_income');
    return val ? Number(val) : 0;
  });

  const [budgetOverride, setBudgetOverride] = useState<number>(() => {
    const val = localStorage.getItem('advisor_budget_goal');
    return val ? Number(val) : 0;
  });

  const [initialBalance, setInitialBalance] = useState<number>(() => {
    const val = localStorage.getItem('initial_balance');
    return val ? Number(val) : 0;
  });

  // Keep state synchronized with storage changes
  useEffect(() => {
    const syncSettings = () => {
      const inc = localStorage.getItem('advisor_monthly_income');
      const bud = localStorage.getItem('advisor_budget_goal');
      const bal = localStorage.getItem('initial_balance');
      if (inc) setIncomeOverride(Number(inc));
      if (bud) setBudgetOverride(Number(bud));
      if (bal) setInitialBalance(Number(bal));
    };

    window.addEventListener('storage', syncSettings);
    window.addEventListener('initial_balance_changed', syncSettings);
    window.addEventListener('advisor_settings_changed', syncSettings);

    return () => {
      window.removeEventListener('storage', syncSettings);
      window.removeEventListener('initial_balance_changed', syncSettings);
      window.removeEventListener('advisor_settings_changed', syncSettings);
    };
  }, []);

  // Detect when data changes to trigger a premium AI analysis loader
  const [isThinking, setIsThinking] = useState(false);
  const dataFingerprint = useMemo(() => {
    const txHash = transactions.reduce((sum, tx) => sum + tx.amount + tx.dateTime, 0);
    const budHash = budgets.reduce((sum, b) => sum + b.amount, 0);
    return `${txHash}-${budHash}-${incomeOverride}-${budgetOverride}-${initialBalance}`;
  }, [transactions, budgets, incomeOverride, budgetOverride, initialBalance]);

  const prevFingerprintRef = useRef(dataFingerprint);
  const [cachedAnalysis, setCachedAnalysis] = useState<AiAdvisorAnalysis | null>(null);

  // Compute live analysis
  const liveAnalysis = useMemo(() => {
    // Determine target budget limit: manual override first, else search global budget from DB, default to 30000
    const globalBudget = budgets.find((b) => b.categoryId === 'global');
    const targetBudget = budgetOverride > 0 ? budgetOverride : globalBudget?.amount || 30000;
    
    // Determine target income: manual override first, else use initial balance, default to 50000
    const targetIncome = incomeOverride > 0 ? incomeOverride : initialBalance > 0 ? initialBalance : 50000;

    return analyzeSmartAdvisor({
      transactions,
      budgets,
      categories,
      initialBalance: targetIncome,
      incomeOverride: targetIncome,
      monthlyBudgetGoal: targetBudget,
    });
  }, [transactions, budgets, categories, incomeOverride, budgetOverride, initialBalance]);

  // Handle high-fidelity simulation loading when transactions/balance mutate
  useEffect(() => {
    if (prevFingerprintRef.current !== dataFingerprint) {
      prevFingerprintRef.current = dataFingerprint;
      setIsThinking(true);
      
      const timer = setTimeout(() => {
        setIsThinking(false);
      }, 950); // 950ms high-fidelity analysis animation

      return () => clearTimeout(timer);
    } else if (!cachedAnalysis) {
      setCachedAnalysis(liveAnalysis);
    }
  }, [dataFingerprint, liveAnalysis, cachedAnalysis]);

  // Expose triggers to manually refresh
  const triggerAnalysis = () => {
    setIsThinking(true);
    setTimeout(() => {
      setIsThinking(false);
    }, 800);
  };

  return {
    analysis: liveAnalysis,
    isThinking,
    triggerAnalysis,
    incomeOverride,
    budgetOverride,
    updateAdvisorSettings: (income: number, budget: number) => {
      localStorage.setItem('advisor_monthly_income', income.toString());
      localStorage.setItem('advisor_budget_goal', budget.toString());
      setIncomeOverride(income);
      setBudgetOverride(budget);
      window.dispatchEvent(new CustomEvent('advisor_settings_changed'));
    }
  };
}
