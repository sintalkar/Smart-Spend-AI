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
import { analyzeSmartAdvisor, BudgetProgress, WasteCategory } from './aiAdvisorCalculations';

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
  const [incomeInput, setIncomeInput] = useState(() => localStorage.getItem('advisor_monthly_income') || '');
  const [budgetInput, setBudgetInput] = useState(() => localStorage.getItem('advisor_budget_goal') || '');
  const [showPlan, setShowPlan] = useState(false);

  useEffect(() => {
    const syncBalance = () => setStoredBalance(Number(localStorage.getItem('initial_balance') || 0));
    window.addEventListener('initial_balance_changed', syncBalance);
    window.addEventListener('storage', syncBalance);
    return () => {
      window.removeEventListener('initial_balance_changed', syncBalance);
      window.removeEventListener('storage', syncBalance);
    };
  }, []);

  useEffect(() => {
    if (incomeInput) localStorage.setItem('advisor_monthly_income', incomeInput);
  }, [incomeInput]);

  useEffect(() => {
    if (budgetInput) localStorage.setItem('advisor_budget_goal', budgetInput);
  }, [budgetInput]);

  const monthlyIncome = parseAmount(incomeInput);
  const monthlyBudgetGoal = parseAmount(budgetInput);
  const hasIncome = monthlyIncome > 0;
  const hasBudget = monthlyBudgetGoal > 0;

  const analysis = useMemo(
    () =>
      analyzeSmartAdvisor({
        transactions,
        budgets,
        categories,
        initialBalance: storedBalance,
        incomeOverride: monthlyIncome,
        monthlyBudgetGoal,
      }),
    [budgets, categories, monthlyBudgetGoal, monthlyIncome, storedBalance, transactions]
  );

  const canAnalyze = hasIncome && hasBudget;
  const activeStep = !hasIncome ? 1 : !hasBudget ? 2 : showPlan ? 5 : 3;
  const wasteData =
    analysis.wasteCategories.length > 0
      ? analysis.wasteCategories.slice(0, 5)
      : [{ categoryId: 'none', name: 'No waste detected', amount: 1, color: '#22C55E', share: 100 }];
  const optimizedSavings = analysis.optimizedBudget.reduce((sum, item) => sum + Math.max(0, item.current - item.recommended), 0);

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

        {!canAnalyze ? (
          <div className="rounded-[30px] border border-orange-400/20 bg-orange-400/10 p-6 text-center">
            <Sparkles className="mx-auto mb-3 text-orange-200" size={28} />
            <h2 className="text-xl font-black text-white">Complete Step {hasIncome ? '2' : '1'} to unlock the AI report</h2>
            <p className="mt-2 text-sm text-white/46">The sequence is intentionally locked for your demo: income first, budget goal second, analysis after that.</p>
          </div>
        ) : (
          <>
            <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <MetricCard
                label="Actual Spending"
                value={formatMoney(analysis.totalSpent)}
                helper={`${Math.round(analysis.budgetUsagePercent)}% of your budget goal used`}
                color={analysis.budgetStatusColor}
                icon={WalletCards}
              />
              <MetricCard
                label="Budget Difference"
                value={formatMoney(Math.abs(analysis.budgetVariance))}
                helper={analysis.budgetVariance >= 0 ? 'Under your planned limit' : 'Above your planned limit'}
                color={analysis.budgetVariance >= 0 ? '#22C55E' : '#F43F5E'}
                icon={Gauge}
              />
              <MetricCard
                label="Waste Detector"
                value={`${Math.round(analysis.wastePercent)}%`}
                helper={`${formatMoney(analysis.wasteAmount)} in non-essential spending`}
                color={analysis.wastePercent > 30 ? '#F43F5E' : analysis.wastePercent > 18 ? '#F59E0B' : '#22C55E'}
                icon={Flame}
              />
              <MetricCard
                label="Health Score"
                value={`${analysis.healthScore}/100`}
                helper={`${analysis.healthLabel} financial health`}
                color={analysis.healthColor}
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
                      You planned {formatMoney(monthlyBudgetGoal)} and actually spent {formatMoney(analysis.totalSpent)} this month.
                    </p>
                  </div>
                  <div className="rounded-2xl px-3 py-2 text-xs font-black uppercase tracking-[0.18em]" style={{ background: `${analysis.budgetStatusColor}18`, color: analysis.budgetStatusColor }}>
                    {analysis.budgetStatus}
                  </div>
                </div>

                <div className="mb-5 h-4 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${Math.min(140, analysis.budgetUsagePercent)}%`,
                      background: `linear-gradient(90deg, ${analysis.budgetStatusColor}, #ffffff66)`,
                    }}
                  />
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {analysis.budgetProgress.length > 0 ? (
                    analysis.budgetProgress.slice(0, 6).map((item) => <BudgetProgressRow key={item.categoryId} item={item} />)
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
                  {analysis.wasteCategories.length > 0 ? (
                    analysis.wasteCategories.slice(0, 4).map((item) => (
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
              <div className="rounded-[32px] border p-5 md:p-6" style={{ borderColor: `${analysis.budgetStatusColor}40`, background: `${analysis.budgetStatusColor}12` }}>
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl" style={{ background: `${analysis.budgetStatusColor}18`, color: analysis.budgetStatusColor }}>
                    <BrainCircuit size={22} />
                  </div>
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/34">Step 4 - AI Smart Advice</p>
                    <h2 className="text-2xl font-black tracking-[-0.04em] text-white">{analysis.aiAdviceTitle}</h2>
                  </div>
                </div>
                <p className="text-sm leading-7 text-white/58">{analysis.aiAdviceMessage}</p>
                <div className="mt-5 rounded-2xl border border-white/8 bg-black/22 p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] text-white/30">AI Spending Personality</p>
                  <h3 className="mt-2 text-2xl font-black text-white">{analysis.personality}</h3>
                  <p className="mt-2 text-sm leading-6 text-white/48">{analysis.personalityDescription}</p>
                </div>
              </div>

              <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
                <div className="mb-5 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Next Month Spending Prediction</p>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{formatMoney(analysis.nextMonthPrediction)}</h2>
                    <p className="mt-2 text-sm text-white/46">{analysis.nextMonthPredictionLabel}</p>
                  </div>
                  <div className="flex h-14 w-14 items-center justify-center rounded-3xl bg-sky-400/12 text-sky-300">
                    <TrendingUp size={25} />
                  </div>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  {analysis.actionableTips.map((tip) => (
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
                  {analysis.investmentSuggestions.map((item) => (
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
                    {analysis.optimizedBudget.map((item) => (
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
