import { useEffect, useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion } from 'motion/react';
import {
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Flame,
  Gauge,
  IndianRupee,
  Lightbulb,
  PiggyBank,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  WalletCards,
} from 'lucide-react';
import { Cell, Pie, PieChart as RechartsPieChart, ResponsiveContainer, Tooltip } from 'recharts';
import { db } from '../../db/database';
import { BudgetPeriod, TransactionType } from '../../db/models';
import { v4 as uuidv4 } from 'uuid';
import {
  AiAdvisorAnalysis,
  analyzeSmartAdvisor,
  BudgetProgress,
  parseScannedExpenseText,
  WasteCategory,
} from './aiAdvisorCalculations';

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

const parseAmount = (value: string) => {
  const parsed = Number(value.replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
};

function StepBadge({ step, label, active }: { step: number; label: string; active: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl border px-4 py-3 transition ${
      active ? 'border-primary/30 bg-primary/12 text-white' : 'border-white/6 bg-white/[0.025] text-white/36'
    }`}>
      <div className={`flex h-8 w-8 items-center justify-center rounded-xl text-xs font-black ${
        active ? 'bg-primary text-white' : 'bg-white/6 text-white/42'
      }`}>
        {step}
      </div>
      <span className="text-xs font-black uppercase tracking-[0.18em]">{label}</span>
    </div>
  );
}

function MoneyInput({
  label,
  value,
  onChange,
  placeholder,
  color,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  color: string;
}) {
  return (
    <label className="block">
      <span className="mb-3 block text-xs font-black uppercase tracking-[0.2em] text-white/36">{label}</span>
      <div className="relative">
        <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 text-white/36" size={22} />
        <input
          type="number"
          min="0"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          className="h-16 w-full rounded-[24px] border border-white/8 bg-black/32 pl-14 pr-5 text-2xl font-black text-white outline-none transition placeholder:text-white/18 focus:border-primary/50"
        />
        <div className="pointer-events-none absolute inset-y-3 right-3 w-1 rounded-full" style={{ background: color }} />
      </div>
    </label>
  );
}

function MetricCard({
  label,
  value,
  helper,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  color: string;
  icon: typeof Gauge;
}) {
  return (
    <div className="panel-linear relative overflow-hidden rounded-[28px] border border-white/6 p-5">
      <div className="absolute -right-12 -top-12 h-28 w-28 rounded-full opacity-10 blur-2xl" style={{ background: color }} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">{label}</p>
          <div className="mt-3 text-3xl font-black leading-none tracking-[-0.04em] text-white">{value}</div>
          <p className="mt-2 text-xs leading-5 text-white/42">{helper}</p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl" style={{ background: `${color}18`, color }}>
          <Icon size={22} />
        </div>
      </div>
    </div>
  );
}

function WasteTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: WasteCategory }> }) {
  if (!active || !payload?.length) return null;
  const item = payload[0].payload;
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0b0b12]/95 px-4 py-3 shadow-2xl">
      <p className="text-sm font-black text-white">{item.name}</p>
      <p className="text-xs text-white/50">{formatMoney(item.amount)} waste - {item.share}%</p>
    </div>
  );
}

function BudgetProgressRow({ item }: { item: BudgetProgress }) {
  const barColor = item.percent > 100 ? '#F43F5E' : item.percent > 80 ? '#F59E0B' : '#22C55E';
  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{item.name}</div>
          <div className="text-xs text-white/36">{formatMoney(item.actual)} actual</div>
        </div>
        <div className="rounded-xl px-2.5 py-1 text-xs font-black" style={{ background: `${barColor}18`, color: barColor }}>
          {item.percent}%
        </div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full"
          style={{
            width: `${Math.min(140, item.percent)}%`,
            background: `linear-gradient(90deg, ${item.color}, ${barColor})`,
          }}
        />
      </div>
    </div>
  );
}

export default function AiAdvisorScreen() {
  const transactions = useLiveQuery(() => db.transactions.where('isDeleted').equals(0).toArray()) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];
  const [storedBalance, setStoredBalance] = useState(() => Number(localStorage.getItem('initial_balance') || 0));
  const [incomeInput, setIncomeInput] = useState(() => {
    const cached = localStorage.getItem('advisor_monthly_income');
    if (cached) return cached;
    // Fallback: calculate initial/available balance
    const storedBal = Number(localStorage.getItem('initial_balance') || 0);
    return storedBal > 0 ? String(storedBal) : '';
  });
  const [budgetInput, setBudgetInput] = useState(() => localStorage.getItem('advisor_budget_goal') || '');
  const [scanInput, setScanInput] = useState('');
  const [isThinking, setIsThinking] = useState(false);
  const [generatedAnalysis, setGeneratedAnalysis] = useState<AiAdvisorAnalysis | null>(null);
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    const syncBalance = () => {
      const storedBal = Number(localStorage.getItem('initial_balance') || 0);
      setStoredBalance(storedBal);

      // Auto-populate available balance if user updates it from the Dashboard Available Balance card
      const allCredits = transactions
        .filter((t) => t.type === TransactionType.CREDIT && t.isDeleted === 0)
        .reduce((sum, t) => sum + t.amount, 0);
      const allDebits = transactions
        .filter((t) => t.type === TransactionType.DEBIT && t.isDeleted === 0)
        .reduce((sum, t) => sum + t.amount, 0);
      
      const realAvailableBalance = Math.round(storedBal + allCredits - allDebits);
      if (realAvailableBalance > 0) {
        setIncomeInput(String(realAvailableBalance));
        localStorage.setItem('advisor_monthly_income', String(realAvailableBalance));
      }
    };

    const syncBudget = () => {
      const budgetGoal = localStorage.getItem('advisor_budget_goal');
      if (budgetGoal) {
        setBudgetInput(budgetGoal);
      }
    };

    // Listen to window events fired by Dashboard Available Balance and Budget Limit updates
    window.addEventListener('initial_balance_changed', syncBalance);
    window.addEventListener('advisor_settings_changed', syncBudget);
    window.addEventListener('storage', () => {
      syncBalance();
      syncBudget();
    });

    return () => {
      window.removeEventListener('initial_balance_changed', syncBalance);
      window.removeEventListener('advisor_settings_changed', syncBudget);
    };
  }, [transactions]);

  useEffect(() => {
    if (incomeInput) localStorage.setItem('advisor_monthly_income', incomeInput);
  }, [incomeInput]);

  useEffect(() => {
    if (budgetInput) localStorage.setItem('advisor_budget_goal', budgetInput);
    // Sync back to db budgets global store if changed by user directly in advisor screen
    const syncBudgetToDb = async () => {
      const val = Number(budgetInput);
      if (!val || isNaN(val) || val <= 0) return;
      try {
        const globalBudget = budgets.find((b) => b.categoryId === 'global');
        if (globalBudget) {
          if (globalBudget.amount !== val) {
            await db.budgets.update(globalBudget.id, { amount: val });
          }
        } else {
          const newId = uuidv4();
          const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
          const endOfMonth = new Date(
            new Date().getFullYear(),
            new Date().getMonth() + 1,
            0,
            23,
            59,
            59,
            999
          ).getTime();
          await db.budgets.add({
            id: newId,
            categoryId: 'global',
            amount: val,
            period: BudgetPeriod.MONTHLY,
            startDate: startOfMonth,
            endDate: endOfMonth,
            alertThreshold: 0.8,
            isActive: 1,
          });
        }
      } catch (err) {
        console.warn('Sync advisor budget to DB failed:', err);
      }
    };
    syncBudgetToDb();
  }, [budgetInput, budgets]);

  const monthlyIncome = parseAmount(incomeInput);
  const monthlyBudgetGoal = parseAmount(budgetInput);
  const hasIncome = monthlyIncome > 0;
  const hasBudget = monthlyBudgetGoal > 0;
  const scannedExpenses = useMemo(() => parseScannedExpenseText(scanInput), [scanInput]);

  const analysis = useMemo(
    () =>
      analyzeSmartAdvisor({
        transactions,
        budgets,
        categories,
        initialBalance: storedBalance,
        incomeOverride: monthlyIncome,
        monthlyBudgetGoal,
        scannedExpenses,
      }),
    [budgets, categories, monthlyBudgetGoal, monthlyIncome, scannedExpenses, storedBalance, transactions]
  );

  const canAnalyze = hasIncome && hasBudget;
  const activeStep = !hasIncome ? 1 : !hasBudget ? 2 : isThinking ? 3 : showPlan ? 5 : 4;
  const smartAnalysis = generatedAnalysis || analysis;

  useEffect(() => {
    if (!canAnalyze) {
      setGeneratedAnalysis(null);
      setIsThinking(false);
      return;
    }

    setIsThinking(true);
    setGeneratedAnalysis(null);
    const timer = window.setTimeout(() => {
      setGeneratedAnalysis(analysis);
      setIsThinking(false);
    }, 850);

    return () => window.clearTimeout(timer);
  }, [analysis, canAnalyze]);

  const wasteData =
    smartAnalysis.wasteCategories.length > 0
      ? smartAnalysis.wasteCategories.slice(0, 5)
      : [{ categoryId: 'none', name: 'No waste detected', amount: 1, color: '#22C55E', share: 100 }];
  const optimizedSavings = smartAnalysis.optimizedBudget.reduce((sum, item) => sum + Math.max(0, item.current - item.recommended), 0);

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-[1240px]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-5 overflow-hidden rounded-[36px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_36%),linear-gradient(135deg,rgba(17,24,39,0.96),rgba(8,8,13,0.98))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] md:p-8"
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-36 w-1/2 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />
          <div className="relative z-10">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-orange-300">
              <BrainCircuit size={15} />
              AI Smart Advisor
            </div>
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
              <div>
                <h1 className="font-display text-4xl font-black leading-[0.95] tracking-[-0.06em] text-white md:text-6xl">
                  Plan smarter before you spend.
                </h1>
                <p className="mt-5 max-w-2xl text-sm leading-7 text-white/52 md:text-base">
                  Follow the exact flow: enter monthly income, set a budget goal, compare actual spending, then generate local AI-style advice and investments.
                </p>
              </div>
              <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                <StepBadge step={1} label="Income" active={activeStep >= 1} />
                <StepBadge step={2} label="Budget Goal" active={activeStep >= 2} />
                <StepBadge step={3} label="Analysis" active={activeStep >= 3} />
                <StepBadge step={4} label="Advice" active={canAnalyze} />
              </div>
            </div>
          </div>
        </motion.section>

        <section className="mb-5 grid gap-5 lg:grid-cols-2">
          <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300">
                <IndianRupee size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Step 1</p>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-white">Monthly Income / Balance</h2>
              </div>
            </div>
            <MoneyInput
              label="Enter monthly income or available balance first"
              value={incomeInput}
              onChange={setIncomeInput}
              placeholder={storedBalance > 0 ? String(Math.round(storedBalance)) : '45000'}
              color="#22C55E"
            />
            <p className="mt-4 text-sm leading-6 text-white/42">
              This becomes the base for waste percentage, remaining money, financial health score, and investment suggestions.
            </p>
          </div>

          <div className={`panel-linear rounded-[32px] border p-5 transition md:p-6 ${
            hasIncome ? 'border-white/6' : 'border-white/4 opacity-55'
          }`}>
            <div className="mb-5 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/12 text-primary">
                <Target size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Step 2</p>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-white">Monthly Spending Limit</h2>
              </div>
            </div>
            <MoneyInput
              label="Set desired monthly spending limit / budget goal"
              value={budgetInput}
              onChange={setBudgetInput}
              placeholder={hasIncome ? String(Math.round(monthlyIncome * 0.7)) : '30000'}
              color="#6C63FF"
            />
            <p className="mt-4 text-sm leading-6 text-white/42">
              The advisor compares actual expenses against this goal before generating warnings or praise.
            </p>
          </div>
        </section>

        <section className={`panel-linear mb-5 rounded-[32px] border p-5 transition md:p-6 ${
          canAnalyze ? 'border-orange-400/16' : 'border-white/4 opacity-55'
        }`}>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400/12 text-orange-200">
                <BrainCircuit size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Scanning Section</p>
                <h2 className="text-2xl font-black tracking-[-0.04em] text-white">Paste scanned bill or SMS data</h2>
              </div>
            </div>
            <div className="rounded-2xl border border-white/8 bg-black/24 px-4 py-2 text-xs font-black text-white/42">
              {scannedExpenses.length} parsed categories
            </div>
          </div>
          <textarea
            value={scanInput}
            onChange={(event) => setScanInput(event.target.value)}
            placeholder="Example: Zomato Rs 850, Netflix Rs 649, Amazon shopping Rs 2400, Uber Rs 320"
            className="min-h-28 w-full resize-none rounded-[24px] border border-white/8 bg-black/32 p-4 text-sm leading-6 text-white outline-none transition placeholder:text-white/22 focus:border-orange-300/40"
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            {scannedExpenses.length > 0 ? (
              scannedExpenses.map((expense) => (
                <div key={expense.categoryId} className="rounded-2xl border border-white/6 bg-white/[0.025] p-3">
                  <div className="text-sm font-black text-white">{expense.name}</div>
                  <div className="mt-1 text-xs text-white/42">{formatMoney(expense.amount)} added to live analysis</div>
                </div>
              ))
            ) : (
              <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-3 text-sm text-white/42 md:col-span-3">
                Paste receipt/SMS lines here and the local AI parser will classify amounts into dining, shopping, subscriptions, transport, groceries, bills, or other.
              </div>
            )}
          </div>
        </section>

        {!canAnalyze ? (
          <div className="rounded-[30px] border border-orange-400/20 bg-orange-400/10 p-6 text-center">
            <Sparkles className="mx-auto mb-3 text-orange-200" size={28} />
            <h2 className="text-xl font-black text-white">Complete Step {hasIncome ? '2' : '1'} to unlock the AI report</h2>
            <p className="mt-2 text-sm text-white/46">The sequence is intentionally locked for your demo: income first, budget goal second, analysis after that.</p>
          </div>
        ) : isThinking ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-[34px] border border-primary/25 bg-primary/10 p-8 text-center shadow-[0_24px_80px_rgba(108,99,255,0.12)]"
          >
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/18 text-primary">
              <Sparkles className="animate-pulse" size={30} />
            </div>
            <h2 className="text-2xl font-black text-white">AI is thinking...</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-white/50">
              Reading income, budget goal, actual expenses, scanned text, waste categories, and spending personality before generating advice.
            </p>
          </motion.div>
        ) : (
          <>
            <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Actual Spending"
                value={formatMoney(smartAnalysis.totalSpent)}
                helper={`${Math.round(smartAnalysis.budgetUsagePercent)}% of your budget goal used`}
                color={smartAnalysis.budgetStatusColor}
                icon={WalletCards}
              />
              <MetricCard
                label="Budget Difference"
                value={formatMoney(Math.abs(smartAnalysis.budgetVariance))}
                helper={smartAnalysis.budgetVariance >= 0 ? 'Under your planned limit' : 'Above your planned limit'}
                color={smartAnalysis.budgetVariance >= 0 ? '#22C55E' : '#F43F5E'}
                icon={Gauge}
              />
              <MetricCard
                label="Waste Detector"
                value={`${Math.round(smartAnalysis.wastePercent)}%`}
                helper={`${formatMoney(smartAnalysis.wasteAmount)} in non-essential spending`}
                color={smartAnalysis.wastePercent > 30 ? '#F43F5E' : smartAnalysis.wastePercent > 18 ? '#F59E0B' : '#22C55E'}
                icon={Flame}
              />
              <MetricCard
                label="Health Score"
                value={`${smartAnalysis.healthScore}/100`}
                helper={`${smartAnalysis.healthLabel} financial health`}
                color={smartAnalysis.healthColor}
                icon={ShieldCheck}
              />
            </section>

            <section className="mb-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
              <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Step 3 - Expense Analysis</p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">Budget vs actual spending</h2>
                    <p className="mt-3 text-sm leading-6 text-white/48">
                      You planned {formatMoney(monthlyBudgetGoal)} and actually spent {formatMoney(smartAnalysis.totalSpent)} this month.
                    </p>
                  </div>
                  <div className="rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ background: `${smartAnalysis.budgetStatusColor}18`, color: smartAnalysis.budgetStatusColor }}>
                    {smartAnalysis.budgetStatus}
                  </div>
                </div>

                <div className="mb-5 h-4 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(140, smartAnalysis.budgetUsagePercent)}%`,
                      background: `linear-gradient(90deg, ${smartAnalysis.budgetStatusColor}, #ffffff66)`,
                    }}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {smartAnalysis.budgetProgress.length > 0 ? (
                    smartAnalysis.budgetProgress.slice(0, 6).map((item) => <BudgetProgressRow key={item.categoryId} item={item} />)
                  ) : (
                    <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-5 text-sm text-white/44 md:col-span-2">
                      No expense data found for this month yet. Add transactions to make category analysis richer.
                    </div>
                  )}
                </div>
              </div>

              <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Top Waste Categories</p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">AI Waste Detector</h2>
                  </div>
                  <AlertTriangle className="text-orange-300" size={26} />
                </div>

                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <RechartsPieChart>
                      <Pie data={wasteData} dataKey="amount" nameKey="name" innerRadius={58} outerRadius={92} paddingAngle={4}>
                        {wasteData.map((item) => (
                          <Cell key={item.categoryId} fill={item.color} />
                        ))}
                      </Pie>
                      <Tooltip content={<WasteTooltip />} />
                    </RechartsPieChart>
                  </ResponsiveContainer>
                </div>

                <div className="space-y-3">
                  {smartAnalysis.wasteCategories.length > 0 ? (
                    smartAnalysis.wasteCategories.slice(0, 4).map((item) => (
                      <div key={item.categoryId} className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3">
                        <div className="flex items-center gap-3">
                          <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                          <span className="text-sm font-black text-white">{item.name}</span>
                        </div>
                        <span className="text-sm font-black text-red-200">{formatMoney(item.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm text-emerald-100">
                      No strong waste category detected. Nice start.
                    </div>
                  )}
                </div>
              </div>
            </section>

            <section className="mb-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
              <div className="rounded-[32px] border p-5 md:p-6" style={{ borderColor: `${smartAnalysis.budgetStatusColor}40`, background: `${smartAnalysis.budgetStatusColor}12` }}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${smartAnalysis.budgetStatusColor}18`, color: smartAnalysis.budgetStatusColor }}>
                    <BrainCircuit size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/34">Step 4 - AI Smart Advice</p>
                    <h2 className="text-2xl font-black tracking-[-0.04em] text-white">{smartAnalysis.generatedAdvice.headline}</h2>
                  </div>
                </div>
                <p className="text-sm leading-7 text-white/58">{smartAnalysis.generatedAdvice.narrative}</p>
                <div className="mt-4 rounded-2xl border border-white/8 bg-black/22 p-4 text-sm leading-6 text-white/54">
                  {smartAnalysis.generatedAdvice.wasteAlert}
                </div>
                <div className="mt-5 rounded-2xl border border-white/8 bg-black/22 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">AI Spending Personality</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{smartAnalysis.personality}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">{smartAnalysis.generatedAdvice.personalityInsight}</p>
                </div>
              </div>

              <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Next Month Spending Prediction</p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{formatMoney(smartAnalysis.nextMonthPrediction)}</h2>
                    <p className="mt-2 text-sm text-white/46">{smartAnalysis.generatedAdvice.predictionInsight}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-400/12 text-sky-300">
                    <TrendingUp size={25} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {smartAnalysis.generatedAdvice.smartActions.map((tip) => (
                    <div key={tip} className="flex gap-3 rounded-2xl border border-white/6 bg-white/[0.025] p-4">
                      <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={17} />
                      <p className="text-sm leading-6 text-white/54">{tip}</p>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mb-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
              <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300">
                    <PiggyBank size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Step 5</p>
                    <h2 className="text-2xl font-black tracking-[-0.04em] text-white">Investment Suggestions</h2>
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.055] p-4 text-sm leading-6 text-emerald-50/80">
                    {smartAnalysis.generatedAdvice.investmentNarrative}
                  </div>
                  {smartAnalysis.investmentSuggestions.map((item) => (
                    <div key={item.title} className="rounded-2xl border border-emerald-400/10 bg-emerald-400/[0.055] p-4">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <div className="text-sm font-black text-white">{item.title}</div>
                        <div className="rounded-xl bg-emerald-400/12 px-3 py-1 text-sm font-black text-emerald-200">
                          {formatMoney(item.amount)}
                        </div>
                      </div>
                      <p className="text-xs leading-5 text-white/44">{item.description}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="overflow-hidden rounded-[34px] border border-primary/20 bg-[linear-gradient(135deg,rgba(108,99,255,0.22),rgba(249,115,22,0.13),rgba(8,8,13,0.96))] p-5 md:p-6">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white/62">
                      <Sparkles size={14} />
                      Demo Highlight
                    </div>
                    <h2 className="text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">Optimize My Spend</h2>
                    <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">
                      Generates a complete improved budget plan for next month using income, goal, and actual spending.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPlan(true)}
                    className="group flex shrink-0 items-center justify-center gap-3 rounded-3xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#11101c] shadow-[0_22px_60px_rgba(255,255,255,0.16)] transition hover:-translate-y-1"
                  >
                    Optimize My Spend
                    <ArrowRight className="transition group-hover:translate-x-1" size={18} />
                  </button>
                </div>

                {showPlan ? (
                  <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="mt-6 grid gap-3 md:grid-cols-2">
                    {smartAnalysis.optimizedBudget.map((item) => (
                      <div key={item.categoryId} className="rounded-[24px] border border-white/10 bg-black/24 p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{item.name}</div>
                            <div className="text-xs text-white/34">Next-month limit</div>
                          </div>
                          <div className="text-xl font-black text-white">{formatMoney(item.recommended)}</div>
                        </div>
                        <p className="text-xs leading-5 text-white/44">{item.reason}</p>
                      </div>
                    ))}
                    <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                      <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/70">Possible Savings</div>
                      <div className="mt-3 text-3xl font-black text-emerald-100">{formatMoney(optimizedSavings)}</div>
                      <p className="mt-2 text-xs leading-5 text-white/46">Move this into SIP, FD, or emergency fund if you follow the plan.</p>
                    </div>
                  </motion.div>
                ) : null}
              </div>
            </section>

            <section className="rounded-[32px] border border-orange-400/15 bg-orange-400/[0.06] p-5 md:p-6">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400/12 text-orange-200">
                  <Lightbulb size={22} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-200/60">How it works</p>
                  <h2 className="text-xl font-black text-white">JavaScript-only advisor logic</h2>
                </div>
              </div>
              <p className="text-sm leading-7 text-white/50">
                Data comes from IndexedDB transactions, budgets, and categories. The entered income and budget goal drive every calculation:
                waste percentage, budget warnings, personality, health score, investments, next-month prediction, and optimized budget plan.
              </p>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
