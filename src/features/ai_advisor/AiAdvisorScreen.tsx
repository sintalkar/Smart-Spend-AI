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
  TrendingDown,
  WalletCards,
} from 'lucide-react';
import {
  Cell,
  Legend,
  Pie,
  PieChart as RechartsPieChart,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import { db } from '../../db/database';
import { analyzeSmartAdvisor, BudgetProgress, WasteCategory } from './aiAdvisorCalculations';

const formatMoney = (amount: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);

function MetricCard({
  label,
  value,
  sub,
  color,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  icon: typeof Gauge;
}) {
  return (
    <div className="panel-linear relative overflow-hidden rounded-[28px] border border-white/6 p-5">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full opacity-10 blur-2xl" style={{ background: color }} />
      <div className="relative z-10 flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/32">{label}</p>
          <div className="mt-3 text-3xl font-black leading-none tracking-[-0.04em] text-white">{value}</div>
          <p className="mt-2 text-xs leading-relaxed text-white/42">{sub}</p>
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
      <p className="text-xs text-white/50">
        {formatMoney(item.amount)} wasted - {item.share}%
      </p>
    </div>
  );
}

function BudgetRow({ item }: { item: BudgetProgress }) {
  const safePercent = Math.min(item.percent, 140);
  const statusColor = item.percent > 100 ? '#F43F5E' : item.percent > 80 ? '#F59E0B' : '#22C55E';

  return (
    <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{item.name}</div>
          <div className="text-xs text-white/36">
            {formatMoney(item.actual)} of {formatMoney(item.budget)}
          </div>
        </div>
        <span className="rounded-xl px-2.5 py-1 text-xs font-black" style={{ background: `${statusColor}18`, color: statusColor }}>
          {item.percent}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-white/8">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${safePercent}%`,
            background: `linear-gradient(90deg, ${item.color}, ${statusColor})`,
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
  const [initialBalance, setInitialBalance] = useState(() => Number(localStorage.getItem('initial_balance') || 0));
  const [showOptimizedPlan, setShowOptimizedPlan] = useState(false);

  useEffect(() => {
    const syncBalance = () => setInitialBalance(Number(localStorage.getItem('initial_balance') || 0));
    window.addEventListener('initial_balance_changed', syncBalance);
    window.addEventListener('storage', syncBalance);
    return () => {
      window.removeEventListener('initial_balance_changed', syncBalance);
      window.removeEventListener('storage', syncBalance);
    };
  }, []);

  const analysis = useMemo(
    () => analyzeSmartAdvisor({ transactions, budgets, categories, initialBalance }),
    [budgets, categories, initialBalance, transactions]
  );

  const topWasteData =
    analysis.wasteCategories.length > 0
      ? analysis.wasteCategories.slice(0, 5)
      : [{ categoryId: 'no-waste', name: 'No waste detected', amount: 1, color: '#22C55E', share: 100 }];

  const optimizedSavings = analysis.optimizedBudget.reduce(
    (sum, item) => sum + Math.max(0, item.current - item.recommended),
    0
  );

  return (
    <div className="pb-24">
      <div className="mx-auto max-w-[1240px]">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative mb-5 overflow-hidden rounded-[36px] border border-white/8 bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.24),transparent_36%),linear-gradient(135deg,rgba(17,24,39,0.96),rgba(8,8,13,0.96))] p-6 shadow-[0_30px_90px_rgba(0,0,0,0.45)] md:p-8"
        >
          <div className="absolute -right-20 -top-24 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="absolute bottom-0 left-1/2 h-36 w-1/2 -translate-x-1/2 rounded-full bg-orange-500/10 blur-3xl" />

          <div className="relative z-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
            <div>
              <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-orange-400/20 bg-orange-400/10 px-4 py-2 text-xs font-black uppercase tracking-[0.22em] text-orange-300">
                <BrainCircuit size={15} />
                AI Smart Advisor
              </div>
              <h1 className="font-display text-4xl font-black leading-[0.95] tracking-[-0.06em] text-white md:text-6xl">
                Your money coach for next month.
              </h1>
              <p className="mt-5 max-w-2xl text-sm leading-7 text-white/52 md:text-base">
                Honest local analysis of your income, waste spend, budgets, personality, and realistic investment options.
                No external AI API, just explainable JavaScript calculations for your final demo.
              </p>
            </div>

            <div className="rounded-[30px] border border-red-400/20 bg-red-500/10 p-5 shadow-[0_20px_70px_rgba(244,63,94,0.14)]">
              <div className="mb-4 flex items-center gap-3">
                <div className="flex h-13 w-13 items-center justify-center rounded-2xl bg-red-500/18 text-red-300">
                  <AlertTriangle size={26} />
                </div>
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-red-200/70">Waste Spending Detector</p>
                  <p className="text-sm text-white/44">Non-essential / Income x 100</p>
                </div>
              </div>
              <div className="flex flex-wrap items-end gap-4">
                <div className="text-5xl font-black leading-none text-red-200 md:text-6xl">
                  {Math.round(analysis.wastePercent)}%
                </div>
                <div className="pb-1">
                  <div className="text-xl font-black text-white">{formatMoney(analysis.wasteAmount)}</div>
                  <div className="text-xs text-white/40">shopping, dining, entertainment, subscriptions and similar wants</div>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        <section className="mb-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            label="Income"
            value={formatMoney(analysis.income)}
            sub="This month's income basis"
            color="#22C55E"
            icon={IndianRupee}
          />
          <MetricCard
            label="Remaining"
            value={formatMoney(analysis.remaining)}
            sub={analysis.remaining >= 0 ? 'Available after expenses' : 'Overspent this month'}
            color={analysis.remaining >= 0 ? '#38BDF8' : '#F43F5E'}
            icon={WalletCards}
          />
          <MetricCard
            label="Health Score"
            value={`${analysis.healthScore}/100`}
            sub={`${analysis.healthLabel} financial control`}
            color={analysis.healthColor}
            icon={Gauge}
          />
          <MetricCard
            label="Savings Rate"
            value={`${Math.round(analysis.savingsRate)}%`}
            sub="Income left after monthly expenses"
            color={analysis.savingsRate >= 25 ? '#22C55E' : '#F59E0B'}
            icon={PiggyBank}
          />
        </section>

        <section className="mb-5 grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Spending Personality</p>
                <h2 className="mt-2 text-3xl font-black tracking-[-0.04em] text-white">{analysis.personality}</h2>
                <p className="mt-3 text-sm leading-6 text-white/48">{analysis.personalityDescription}</p>
              </div>
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-3xl bg-primary/12 text-primary">
                <Sparkles size={25} />
              </div>
            </div>

            <div className="rounded-[26px] border border-white/6 bg-black/24 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-black text-white">Financial Health Score</p>
                <span className="text-sm font-black" style={{ color: analysis.healthColor }}>
                  {analysis.healthLabel}
                </span>
              </div>
              <div className="h-4 overflow-hidden rounded-full bg-white/8">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${analysis.healthScore}%`,
                    background: `linear-gradient(90deg, ${analysis.healthColor}, #ffffff66)`,
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-[11px] font-bold text-white/30">
                <span>Risk</span>
                <span>Stable</span>
                <span>Excellent</span>
              </div>
            </div>
          </div>

          <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Top Waste Categories</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Where the money leaks</h2>
              </div>
              <Flame className="text-orange-300" size={26} />
            </div>

            <div className="grid gap-4 md:grid-cols-[0.9fr_1.1fr] md:items-center">
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={topWasteData}
                      dataKey="amount"
                      nameKey="name"
                      innerRadius={56}
                      outerRadius={92}
                      paddingAngle={4}
                    >
                      {topWasteData.map((entry) => (
                        <Cell key={entry.categoryId} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip content={<WasteTooltip />} />
                    <Legend iconType="circle" wrapperStyle={{ color: 'rgba(255,255,255,0.48)', fontSize: 12 }} />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-3">
                {analysis.wasteCategories.length > 0 ? (
                  analysis.wasteCategories.slice(0, 4).map((item) => (
                    <div key={item.categoryId} className="flex items-center justify-between rounded-2xl border border-white/6 bg-white/[0.025] px-4 py-3">
                      <div className="flex items-center gap-3">
                        <span className="h-3 w-3 rounded-full" style={{ background: item.color }} />
                        <div>
                          <div className="text-sm font-black text-white">{item.name}</div>
                          <div className="text-xs text-white/34">{item.share}% of waste</div>
                        </div>
                      </div>
                      <div className="text-sm font-black text-red-200">{formatMoney(item.amount)}</div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/10 p-4 text-sm leading-6 text-emerald-100">
                    No clear waste category detected yet. Add more transactions for sharper advice.
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-5 grid gap-5 xl:grid-cols-[1fr_0.9fr]">
          <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Budget vs Actual</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Progress bars by category</h2>
              </div>
              <TrendingDown className="text-sky-300" size={26} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {analysis.budgetProgress.length > 0 ? (
                analysis.budgetProgress.slice(0, 8).map((item) => <BudgetRow key={item.categoryId} item={item} />)
              ) : (
                <div className="rounded-2xl border border-white/6 bg-white/[0.025] p-5 text-sm text-white/44 md:col-span-2">
                  Set budgets and add expenses to compare planned vs actual spending.
                </div>
              )}
            </div>
          </div>

          <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Smart Investment Advisor</p>
                <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">Use remaining money wisely</h2>
              </div>
              <ShieldCheck className="text-emerald-300" size={26} />
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
        </section>

        <section className="mb-5 overflow-hidden rounded-[34px] border border-primary/20 bg-[linear-gradient(135deg,rgba(108,99,255,0.22),rgba(249,115,22,0.13),rgba(8,8,13,0.96))] p-5 md:p-6">
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/8 px-3 py-1.5 text-xs font-black uppercase tracking-[0.2em] text-white/62">
                <Target size={14} />
                Demo Highlight
              </div>
              <h2 className="text-3xl font-black tracking-[-0.05em] text-white md:text-4xl">Optimize my spend for next month</h2>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-white/52">
                Generates a category-wise improved budget plan using your current spending pattern. This is the wow moment
                button for your project demo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowOptimizedPlan(true)}
              className="group flex shrink-0 items-center justify-center gap-3 rounded-3xl bg-white px-6 py-4 text-sm font-black uppercase tracking-[0.18em] text-[#11101c] shadow-[0_22px_60px_rgba(255,255,255,0.16)] transition hover:-translate-y-1 hover:shadow-[0_28px_70px_rgba(255,255,255,0.24)]"
            >
              <Sparkles size={18} />
              Optimize My Spend
              <ArrowRight className="transition group-hover:translate-x-1" size={18} />
            </button>
          </div>

          {showOptimizedPlan ? (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3"
            >
              {analysis.optimizedBudget.map((item) => (
                <div key={item.categoryId} className="rounded-[24px] border border-white/10 bg-black/24 p-4">
                  <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black text-white">{item.name}</div>
                      <div className="text-xs text-white/34">Recommended limit</div>
                    </div>
                    <div className="flex h-11 w-11 items-center justify-center rounded-2xl" style={{ background: `${item.color}18`, color: item.color }}>
                      <CheckCircle2 size={20} />
                    </div>
                  </div>
                  <div className="mb-3 flex items-end justify-between gap-3">
                    <div>
                      <div className="text-xs text-white/30">Current</div>
                      <div className="text-sm font-black text-white/60">{formatMoney(item.current)}</div>
                    </div>
                    <ArrowRight className="text-white/24" size={18} />
                    <div className="text-right">
                      <div className="text-xs text-white/30">Next month</div>
                      <div className="text-xl font-black text-white">{formatMoney(item.recommended)}</div>
                    </div>
                  </div>
                  <p className="text-xs leading-5 text-white/44">{item.reason}</p>
                </div>
              ))}

              <div className="rounded-[24px] border border-emerald-400/20 bg-emerald-400/10 p-4">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-200/70">Possible Savings</div>
                <div className="mt-3 text-3xl font-black text-emerald-100">{formatMoney(optimizedSavings)}</div>
                <p className="mt-2 text-xs leading-5 text-white/46">If you follow this plan, this amount can move toward SIP, FD, or emergency fund.</p>
              </div>
            </motion.div>
          ) : null}
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.75fr_1.25fr]">
          <div className="panel-linear rounded-[32px] border border-white/6 p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-yellow-400/12 text-yellow-200">
                <Lightbulb size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/30">Actionable Tips</p>
                <h2 className="text-xl font-black text-white">What to do next</h2>
              </div>
            </div>
            <div className="space-y-3">
              {analysis.actionableTips.map((tip) => (
                <div key={tip} className="flex gap-3 rounded-2xl border border-white/6 bg-white/[0.025] p-4">
                  <CheckCircle2 className="mt-0.5 shrink-0 text-emerald-300" size={17} />
                  <p className="text-sm leading-6 text-white/54">{tip}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-[32px] border border-orange-400/15 bg-orange-400/[0.06] p-5 md:p-6">
            <div className="mb-4 flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-orange-400/12 text-orange-200">
                <BrainCircuit size={22} />
              </div>
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.24em] text-orange-200/60">How data is fetched</p>
                <h2 className="text-xl font-black text-white">Local-first advisor pipeline</h2>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {[
                'Transactions: db.transactions.where("isDeleted").equals(0)',
                'Budgets: db.budgets.toArray()',
                'Categories: db.categories.toArray()',
              ].map((item) => (
                <div key={item} className="rounded-2xl border border-white/6 bg-black/20 p-4 text-xs font-semibold leading-5 text-white/48">
                  {item}
                </div>
              ))}
            </div>
            <p className="mt-4 text-sm leading-6 text-white/46">
              The formulas live separately in <span className="font-black text-white/70">aiAdvisorCalculations.ts</span>, so you can explain
              the waste percentage, personality classification, score, and optimized budget clearly during the viva.
            </p>
          </div>
        </section>
      </div>
    </div>
  );
}
