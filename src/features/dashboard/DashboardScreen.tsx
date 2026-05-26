import { useMemo, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Bell,
  LogOut,
  ShoppingBag,
  Coffee,
  Car,
  Activity,
  Mic,
  Camera,
  PenSquare,
  MessageSquare,
  AlertCircle,
} from 'lucide-react';
import { db } from '../../db';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../core/auth/AuthProvider';
import { BudgetPeriod, TransactionType } from '../../db/models';
import { isSameMonth } from 'date-fns';
import { scoreCalculator } from '../money_score/MoneyScoreCalculator';
import { EmptyState } from '../../core/ui/EmptyState';
import { appRoutes, getAddEntryPath } from '../../core/routes';
import { db as firestoreDb } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';

const categoryIcons: Record<string, any> = {
  shopping: ShoppingBag,
  food_dining: Coffee,
  transportation: Car,
  entertainment: Activity,
  bills_utilities: Activity,
  health: Activity,
  groceries: ShoppingBag,
  other: Activity,
};

const categoryNames: Record<string, string> = {
  food_dining: 'Food & Dining',
  transportation: 'Transport',
  shopping: 'Shopping',
  entertainment: 'Entertainment',
  bills_utilities: 'Bills & Utilities',
  groceries: 'Groceries',
  health: 'Healthcare',
  salary: 'Income',
  other: 'Other',
};

const categoryColors: Record<string, string> = {
  food_dining: '#6c63ff',
  transportation: '#10b981',
  shopping: '#f43f5e',
  entertainment: '#f59e0b',
  bills_utilities: '#8b5cf6',
  groceries: '#06b6d4',
  health: '#14b8a6',
  other: '#6b7280',
};

function formatMoney(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function Label({ children, color = 'rgba(255,255,255,0.28)' }: { children: React.ReactNode; color?: string }) {
  return (
    <div
      style={{
        fontSize: 10,
        fontWeight: 800,
        textTransform: 'uppercase',
        letterSpacing: '0.18em',
        color,
      }}
    >
      {children}
    </div>
  );
}

function Mono({ children, size = 14, color = '#f8fafc' }: { children: React.ReactNode; size?: number; color?: string }) {
  return (
    <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: size, fontWeight: 800, color }}>
      {children}
    </span>
  );
}

function Panel({
  children,
  className = '',
  style,
}: {
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}) {
  return (
    <div
      className={`panel-linear rounded-[24px] ${className}`}
      style={{
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function ProgressBar({ value, max, color, height = 8 }: { value: number; max: number; color: string; height?: number }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  return (
    <div
      style={{
        height,
        borderRadius: 999,
        background: 'rgba(255,255,255,0.05)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          borderRadius: 999,
          background: color,
          boxShadow: `0 0 12px ${color}55`,
        }}
      />
    </div>
  );
}

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string;
  value: string;
  sub?: string;
  color: string;
}) {
  return (
    <Panel className="flex-1 p-4">
      <Label color={color}>{label}</Label>
      <div className="mt-2 text-[30px] font-black leading-none" style={{ color }}>
        {value}
      </div>
      {sub ? <div className="mt-2 text-xs text-white/28">{sub}</div> : null}
    </Panel>
  );
}

export default function DashboardScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const transactions =
    useLiveQuery(() => db.transactions.where('isDeleted').equals(0).reverse().sortBy('dateTime')) || [];
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  const [isAddBalanceOpen, setIsAddBalanceOpen] = useState(false);
  const [addBalanceInput, setAddBalanceInput] = useState('');
  const [addBalanceNote, setAddBalanceNote] = useState('');
  const [addBalanceError, setAddBalanceError] = useState<string | null>(null);
  const [startingBalance, setStartingBalance] = useState<number | null>(() => {
    const stored = localStorage.getItem('initial_balance');
    return stored ? Number(stored) : null;
  });
  const initialBalance = startingBalance ?? 0;
  const hasStartingBalance = startingBalance !== null;

  useEffect(() => {
    const handleBalanceChange = () => {
      const stored = localStorage.getItem('initial_balance');
      setStartingBalance(stored ? Number(stored) : null);
    };
    window.addEventListener('initial_balance_changed', handleBalanceChange);
    window.addEventListener('storage', handleBalanceChange);
    return () => {
      window.removeEventListener('initial_balance_changed', handleBalanceChange);
      window.removeEventListener('storage', handleBalanceChange);
    };
  }, []);

  const {
    availableBalance,
    monthlySpent,
    monthlyIncome,
    savingsAmount,
    budgetLimit,
    recentTransactions,
    categoryCards,
    score,
    greeting,
  } = useMemo(() => {
    const allCredits = transactions
      .filter((t) => t.type === TransactionType.CREDIT && t.isDeleted === 0)
      .reduce((sum, t) => sum + t.amount, 0);
    const allDebits = transactions
      .filter((t) => t.type === TransactionType.DEBIT && t.isDeleted === 0)
      .reduce((sum, t) => sum + t.amount, 0);

    const thisMonth = transactions.filter((t) => {
      try {
        return t.isDeleted === 0 && isSameMonth(new Date(t.dateTime), new Date());
      } catch {
        return false;
      }
    });

    const monthlyDebits = thisMonth.filter((t) => t.type === TransactionType.DEBIT);
    const monthlyCredits = thisMonth.filter((t) => t.type === TransactionType.CREDIT);
    const globalBudget = budgets.find((b) => b.categoryId === 'global');
    const budget = globalBudget?.amount || 0;

    const catTotals: Record<string, number> = {};
    monthlyDebits.forEach((tx) => {
      catTotals[tx.categoryId] = (catTotals[tx.categoryId] || 0) + tx.amount;
    });

    const categoryBudgetMap = Object.fromEntries(
      budgets.filter((b) => b.categoryId && b.categoryId !== 'global').map((b) => [b.categoryId!, b.amount])
    );

    const allCats = Array.from(
      new Set([
        ...Object.keys(catTotals),
        ...Object.keys(categoryBudgetMap),
      ])
    );

    const cards = allCats
      .filter((catId) => catId !== 'salary')
      .map((catId) => {
        const spent = catTotals[catId] || 0;
        const catBudget = categoryBudgetMap[catId] || Math.max(spent, 1);
        const progress = catBudget > 0 ? Math.min(100, Math.round((spent / catBudget) * 100)) : 0;
        return {
          id: catId,
          name: categoryNames[catId] || catId,
          spent,
          budget: catBudget,
          progress,
          color: categoryColors[catId] || '#6b7280',
          Icon: categoryIcons[catId] || Activity,
        };
      })
      .sort((a, b) => b.spent - a.spent);

    const scoreResult = scoreCalculator.calculateScore(
      monthlyDebits.reduce((sum, t) => sum + t.amount, 0),
      monthlyCredits.reduce((sum, t) => sum + t.amount, 0),
      catTotals,
      monthlyDebits.map((t) => t.amount),
      0,
      0,
      []
    );

    const topOverspend = cards.find((card) => card.spent > card.budget);
    const greetingText = topOverspend
      ? `${topOverspend.name} hit ${topOverspend.progress}% of budget, ${user?.displayName?.split(' ')[0] || 'there'}. Pause non-essential spending to recover ${formatMoney(topOverspend.spent - topOverspend.budget)} this month.`
      : `You are on track this month. Keep spending steady and protect your savings rate.`;

    return {
      availableBalance: initialBalance + allCredits - allDebits,
      monthlySpent: monthlyDebits.reduce((sum, t) => sum + t.amount, 0),
      monthlyIncome: monthlyCredits.reduce((sum, t) => sum + t.amount, 0),
      savingsAmount:
        monthlyCredits.reduce((sum, t) => sum + t.amount, 0) -
        monthlyDebits.reduce((sum, t) => sum + t.amount, 0),
      budgetLimit: budget,
      recentTransactions: transactions.slice(0, 5),
      categoryCards: cards,
      score: scoreResult,
      greeting: greetingText,
    };
  }, [budgets, initialBalance, transactions, user?.displayName]);

  const budgetProgress = budgetLimit > 0 ? Math.min(100, Math.round((monthlySpent / budgetLimit) * 100)) : 0;
  const savingsRate = monthlyIncome > 0 ? Math.max(0, Math.round((savingsAmount / monthlyIncome) * 100)) : 0;

  const handleSetStartingBalance = async () => {
    const val = Number(addBalanceInput);
    if (!addBalanceInput || Number.isNaN(val) || val <= 0) {
      setAddBalanceError('Please enter a valid positive amount');
      return;
    }

    try {
      if (user) {
        const userDocRef = doc(firestoreDb, `users/${user.uid}`);
        await setDoc(userDocRef, { initialBalance: val, updatedAt: Date.now() }, { merge: true });
      }

      localStorage.setItem('initial_balance', val.toString());
      setStartingBalance(val);
      window.dispatchEvent(new CustomEvent('initial_balance_changed'));
      
      setIsAddBalanceOpen(false);
      setAddBalanceInput('');
      setAddBalanceNote('');
      setAddBalanceError(null);
    } catch (error) {
      console.error(error);
      setAddBalanceError('Failed to set starting balance. Please try again.');
    }
  };

  const handleAddBalanceSubmit = async () => {
    const val = Number(addBalanceInput);
    if (!addBalanceInput || Number.isNaN(val) || val <= 0) {
      setAddBalanceError('Please enter a valid positive amount');
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

      const globalBudget = budgets.find((b) => b.categoryId === 'global');
      if (globalBudget) {
        await db.budgets.update(globalBudget.id, {
          amount: globalBudget.amount + val,
        });
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

      setIsAddBalanceOpen(false);
      setAddBalanceInput('');
      setAddBalanceNote('');
      setAddBalanceError(null);
    } catch (error) {
      console.error(error);
      setAddBalanceError('Failed to add balance. Please try again.');
    }
  };

  return (
    <div className="pb-28">
      <div className="mx-auto max-w-[1180px]">
        <div className="mb-4 rounded-r-2xl border-l-[3px] border-primary bg-primary/10 px-4 py-3 text-sm italic text-white/62">
          ✦ {greeting}
        </div>

        <Panel className="relative mb-4 overflow-hidden p-6">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-primary opacity-[0.06]" />
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_12px_var(--color-primary)]" />
              <Label>Available Balance</Label>
            </div>
            <button
              onClick={() => setIsAddBalanceOpen(true)}
              className="rounded-xl border border-primary/20 bg-primary/10 px-3 py-1.5 text-xs font-black text-primary"
            >
              {hasStartingBalance ? '+ Add' : 'Set'}
            </button>
          </div>

          <div className="mb-6 text-[54px] font-black leading-none tracking-[-0.04em] text-white">
            {formatMoney(availableBalance)}
          </div>

          <div className="rounded-2xl bg-black/24 p-4">
            <div className="mb-2 flex items-center justify-between">
              <Label>Monthly Budget</Label>
              <Mono
                size={12}
                color={budgetProgress > 90 ? '#f43f5e' : budgetProgress > 70 ? '#f59e0b' : '#10b981'}
              >
                {budgetProgress}% used
              </Mono>
            </div>
            <ProgressBar
              value={monthlySpent}
              max={budgetLimit || Math.max(monthlySpent, 1)}
              color={budgetProgress > 90 ? '#f43f5e' : budgetProgress > 70 ? '#f59e0b' : '#6c63ff'}
            />
            <div className="mt-2 flex items-center justify-between text-xs text-white/30">
              <span>{formatMoney(monthlySpent)} spent</span>
              <span>Limit {formatMoney(budgetLimit || 0)}</span>
            </div>
          </div>
        </Panel>

        <div className="mb-4 flex gap-3">
          <StatCard label="Income" value={formatMoney(monthlyIncome)} sub="This month" color="#10b981" />
          <StatCard label="Saved" value={formatMoney(savingsAmount)} sub={`${savingsRate}% rate`} color="#6c63ff" />
        </div>

        <Panel
          className="mb-4 cursor-pointer p-4"
          style={{ borderColor: 'rgba(16,185,129,0.2)' }}
        >
          <button
            onClick={() => navigate(appRoutes.score)}
            className="flex w-full items-center justify-between text-left"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400">
                <Activity size={22} />
              </div>
              <div>
                <Label color="#10b981">Financial Wellness Score</Label>
                <div className="mt-1 flex items-end gap-2">
                  <Mono size={30}>{score.total}</Mono>
                  <span className="rounded-md border border-emerald-500/20 bg-emerald-500/12 px-2 py-0.5 text-xs font-black text-emerald-400">
                    {score.grade}
                  </span>
                </div>
              </div>
            </div>
            <span className="text-xl text-white/28">›</span>
          </button>
        </Panel>

        <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {[
            { icon: PenSquare, label: 'Manual', path: getAddEntryPath('manual') },
            { icon: Mic, label: 'Voice', path: getAddEntryPath('voice') },
            { icon: Camera, label: 'Receipt', path: getAddEntryPath('receipt') },
            { icon: MessageSquare, label: 'SMS', path: appRoutes.sms },
          ].map((item) => (
            <button
              key={item.label}
              onClick={() => navigate(item.path)}
              className="panel-linear flex flex-col items-center gap-2 rounded-[18px] px-4 py-4 text-white/70 transition hover:border-white/12"
            >
              <item.icon size={22} />
              <span className="text-[11px] font-bold">{item.label}</span>
            </button>
          ))}
        </div>

        <div className="mb-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-display text-[28px] font-black leading-none text-white md:text-[32px]">
              Category
              <br />
              Budgets
            </h2>
            <button
              onClick={() => navigate(appRoutes.budget)}
              className="text-xs font-black text-primary"
            >
              Adjust →
            </button>
          </div>

          <div className="flex gap-3 overflow-x-auto pb-2 no-scrollbar">
            {categoryCards.length > 0 ? (
              categoryCards.map((card) => (
                <Panel key={card.id} className="min-w-[165px] shrink-0 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div
                      className="flex h-10 w-10 items-center justify-center rounded-2xl"
                      style={{ background: `${card.color}18`, color: card.color }}
                    >
                      <card.Icon size={18} />
                    </div>
                    <span
                      className="rounded-md px-2 py-1 text-[10px] font-black"
                      style={{
                        background: `${card.color}18`,
                        color: card.color,
                      }}
                    >
                      {card.progress}%
                    </span>
                  </div>
                  <Label>{card.name}</Label>
                  <div className="my-2">
                    <Mono size={14}>{formatMoney(card.spent)}</Mono>
                  </div>
                  <ProgressBar value={card.spent} max={card.budget} color={card.color} height={4} />
                  <div className="mt-2 text-[11px] text-white/28">of {formatMoney(card.budget)}</div>
                </Panel>
              ))
            ) : (
              <Panel className="w-full p-6 text-center text-sm text-white/38">
                No category budgets configured yet.
              </Panel>
            )}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center justify-between">
            <div className="font-display text-[18px] font-black text-white">Recent Activity</div>
            <button
              onClick={() => navigate(appRoutes.transactions)}
              className="text-xs font-black text-primary"
            >
              See all →
            </button>
          </div>

          <Panel className="px-4">
            {recentTransactions.length > 0 ? (
              recentTransactions.map((tx, index) => {
                const isCredit = tx.type === TransactionType.CREDIT;
                const Icon = categoryIcons[tx.categoryId] || Activity;
                const color = categoryColors[tx.categoryId] || '#6b7280';
                return (
                  <div
                    key={tx.id}
                    className={`flex items-center gap-3 py-4 ${index < recentTransactions.length - 1 ? 'border-b border-white/6' : ''}`}
                  >
                    <div
                      className="flex h-11 w-11 items-center justify-center rounded-2xl"
                      style={{ background: `${color}18`, color }}
                    >
                      <Icon size={18} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-sm font-bold text-white">
                        {tx.merchantName || tx.note || 'Transaction'}
                      </div>
                      <div className="truncate text-xs text-white/28">
                        {tx.note || categoryNames[tx.categoryId] || tx.categoryId}
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <Mono size={13} color={isCredit ? '#10b981' : '#f8fafc'}>
                        {isCredit ? '+' : '−'}
                        {formatMoney(tx.amount)}
                      </Mono>
                      <div className="mt-1 text-[10px] text-white/24">
                        {new Date(tx.dateTime).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                        })}
                      </div>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="py-6">
                <EmptyState title="No spending logged" description="Add a transaction to see activity here." />
              </div>
            )}
          </Panel>
        </div>
      </div>

      <AnimatePresence>
        {isAddBalanceOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAddBalanceOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              className="panel-linear relative z-10 w-full max-w-md rounded-[32px] p-8"
            >
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <div className="text-2xl font-black text-white">
                    {hasStartingBalance ? 'Add Balance' : 'Set Available Balance'}
                  </div>
                  <div className="mt-1 text-sm text-white/36">
                    {hasStartingBalance
                      ? 'Top up your available balance manually.'
                      : 'Set your starting balance to unlock expense entry and balance tracking.'}
                  </div>
                </div>
                <button onClick={() => setIsAddBalanceOpen(false)} className="text-white/36 hover:text-white">
                  <LogOut size={16} className="rotate-45" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-white/44">₹</span>
                  <input
                    type="number"
                    autoFocus
                    value={addBalanceInput}
                    onChange={(e) => {
                      setAddBalanceInput(e.target.value);
                      if (addBalanceError) setAddBalanceError(null);
                    }}
                    placeholder="0"
                    className="h-16 w-full rounded-2xl border border-white/8 bg-black/36 pl-12 pr-6 text-2xl font-black text-white outline-none transition focus:border-primary/50"
                  />
                </div>

                {hasStartingBalance && (
                  <input
                    type="text"
                    value={addBalanceNote}
                    onChange={(e) => setAddBalanceNote(e.target.value)}
                    placeholder="Note (Salary, refund, gift)"
                    className="h-12 w-full rounded-2xl border border-white/8 bg-black/36 px-4 text-white outline-none transition focus:border-primary/50"
                  />
                )}

                {addBalanceError ? (
                  <div className="flex items-center gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-sm text-error">
                    <AlertCircle size={14} />
                    {addBalanceError}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 flex gap-3">
                <button
                  onClick={() => setIsAddBalanceOpen(false)}
                  className="flex-1 rounded-2xl bg-white/5 py-4 font-semibold text-white/70"
                >
                  Cancel
                </button>
                <button
                  onClick={hasStartingBalance ? handleAddBalanceSubmit : handleSetStartingBalance}
                  className="flex-1 rounded-2xl bg-primary py-4 font-semibold text-white shadow-[0_16px_32px_rgba(108,99,255,0.24)]"
                >
                  {hasStartingBalance ? 'Confirm' : 'Set Balance'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
