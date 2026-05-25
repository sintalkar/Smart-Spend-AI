import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft, Plus, Trash2, Sparkles, CheckCircle2,
  Edit3, AlertCircle, TrendingUp, Calendar, Target,
} from 'lucide-react';
import { db } from '../../db/database';
import { GoalContributionEntity, TransactionType } from '../../db/models';
import { v4 as uuidv4 } from 'uuid';
import { format, addMonths } from 'date-fns';
import clsx from 'clsx';
import CreateGoalModal from './CreateGoalModal';

interface AiTips {
  eta_current: string;
  monthly_needed: number;
  suggestions: { category: string; current_monthly_spend: number; suggested_cut_percent: number; monthly_savings: number; tip: string }[];
  eta_with_cuts: string;
  motivation: string;
}

export default function GoalDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const goal = useLiveQuery(() => db.goals.get(id!), [id]);
  const contributions = useLiveQuery(
    () => db.goalContributions.where('goalId').equals(id!).reverse().sortBy('createdAt'),
    [id]
  ) || [];

  const [addAmt,   setAddAmt]   = useState('');
  const [addNote,  setAddNote]  = useState('');
  const [addErr,   setAddErr]   = useState<string | null>(null);
  const [adding,   setAdding]   = useState(false);
  const [showAdd,  setShowAdd]  = useState(false);
  const [showEdit, setShowEdit] = useState(false);

  // AI tips
  const [aiTips,      setAiTips]      = useState<AiTips | null>(null);
  const [aiLoading,   setAiLoading]   = useState(false);
  const [aiError,     setAiError]     = useState<string | null>(null);
  const [aiRequested, setAiRequested] = useState(false);

  // ETA calculation
  const [eta, setEta] = useState<{ months: number | null; date: string | null; monthlyNeeded: number }>({
    months: null, date: null, monthlyNeeded: 0,
  });

  useEffect(() => {
    if (!goal) return;
    const calcEta = async () => {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentTxs = await db.transactions
        .where('dateTime').above(thirtyDaysAgo)
        .filter(t => t.isDeleted === 0)
        .toArray();
      const income   = recentTxs.filter(t => t.type === TransactionType.CREDIT).reduce((s, t) => s + t.amount, 0);
      const expenses = recentTxs.filter(t => t.type === TransactionType.DEBIT).reduce((s, t) => s + t.amount, 0);
      const surplus  = income - expenses;
      const remaining = goal.targetAmount - goal.currentAmount;

      if (surplus <= 0 || remaining <= 0) {
        setEta({ months: null, date: null, monthlyNeeded: remaining > 0 ? Math.ceil(remaining / 12) : 0 });
        return;
      }
      const months = Math.ceil(remaining / surplus);
      const date   = format(addMonths(new Date(), months), 'MMM yyyy');
      setEta({ months, date, monthlyNeeded: surplus });
    };
    calcEta();
  }, [goal?.id, goal?.currentAmount, goal?.targetAmount]);

  const fetchAiTips = async () => {
    if (!goal) return;
    setAiLoading(true);
    setAiError(null);
    setAiRequested(true);
    try {
      const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
      const recentTxs = await db.transactions
        .where('dateTime').above(thirtyDaysAgo)
        .filter(t => t.isDeleted === 0)
        .toArray();
      const income   = recentTxs.filter(t => t.type === TransactionType.CREDIT).reduce((s, t) => s + t.amount, 0);
      const expenses = recentTxs.filter(t => t.type === TransactionType.DEBIT).reduce((s, t) => s + t.amount, 0);
      const catMap: Record<string, number> = {};
      recentTxs.filter(t => t.type === TransactionType.DEBIT).forEach(t => {
        catMap[t.categoryId] = (catMap[t.categoryId] ?? 0) + t.amount;
      });

      const res = await fetch('/api/ai/goal-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goalName: goal.name,
          targetAmount: goal.targetAmount,
          currentAmount: goal.currentAmount,
          deadline: goal.deadline ?? null,
          monthlyIncome: income,
          monthlyExpenses: expenses,
          categoryBreakdown: catMap,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setAiTips(data.data);
    } catch (e: any) {
      setAiError('Could not load AI suggestions. Check your API key or try again later.');
      console.warn('Goal tips error', e);
    } finally {
      setAiLoading(false);
    }
  };

  const handleAddContribution = async () => {
    const amt = Number(addAmt);
    if (!addAmt || isNaN(amt) || amt <= 0) {
      setAddErr('Enter a valid amount.');
      return;
    }
    if (!goal) return;
    setAdding(true);
    try {
      const now   = Date.now();
      const contId = uuidv4();
      const contrib: GoalContributionEntity = {
        id: contId, goalId: goal.id, amount: amt,
        note: addNote.trim() || undefined, createdAt: now,
      };
      await db.goalContributions.add(contrib);
      const newCurrent = Math.min(goal.currentAmount + amt, goal.targetAmount);
      await db.goals.update(goal.id, {
        currentAmount: newCurrent,
        isCompleted: newCurrent >= goal.targetAmount ? 1 : 0,
        updatedAt: now,
      });
      setAddAmt(''); setAddNote(''); setAddErr(null); setShowAdd(false);
    } catch (e) {
      console.error(e);
      setAddErr('Failed to add contribution.');
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteContribution = async (contrib: GoalContributionEntity) => {
    if (!goal) return;
    if (!window.confirm(`Remove this ₹${contrib.amount} contribution?`)) return;
    await db.goalContributions.delete(contrib.id);
    const newCurrent = Math.max(goal.currentAmount - contrib.amount, 0);
    await db.goals.update(goal.id, { currentAmount: newCurrent, isCompleted: 0, updatedAt: Date.now() });
  };

  const handleDeleteGoal = async () => {
    if (!goal) return;
    if (!window.confirm(`Delete "${goal.name}"? This cannot be undone.`)) return;
    await db.goalContributions.where('goalId').equals(goal.id).delete();
    await db.goals.delete(goal.id);
    navigate('/goals');
  };

  if (!goal) {
    return (
      <div className="min-h-screen bg-[#0A0A0C] flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      </div>
    );
  }

  const pct      = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);

  return (
    <div className="min-h-screen bg-[#0A0A0C] text-white pb-32">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 flex items-center gap-3 px-6 py-4 bg-[#0A0A0C]/80 backdrop-blur-xl border-b border-white/5"
      >
        <button onClick={() => navigate('/goals')}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1 min-w-0">
          <p className="text-white font-extrabold truncate">{goal.emoji} {goal.name}</p>
        </div>
        <button onClick={() => setShowEdit(true)}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
          <Edit3 size={15} />
        </button>
        <button onClick={handleDeleteGoal}
          className="w-10 h-10 rounded-xl bg-white/5 border border-error/20 flex items-center justify-center text-error/60 hover:text-error transition-colors">
          <Trash2 size={15} />
        </button>
      </motion.header>

      <div className="px-6 py-6 space-y-5">

        {/* Hero progress card */}
        <motion.div
          initial={{ scale: 0.96, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          className="relative overflow-hidden rounded-[28px] p-6 border border-white/8"
          style={{ background: `linear-gradient(135deg, ${goal.color}18 0%, #12121700 60%)` }}
        >
          <div className="absolute top-0 right-0 w-48 h-48 blur-[80px] rounded-full -z-10" style={{ background: goal.color + '25' }} />

          {goal.isCompleted === 1 && (
            <div className="flex items-center gap-2 mb-3 text-success">
              <CheckCircle2 size={16} />
              <span className="text-xs font-black uppercase tracking-widest">Goal Completed! 🎉</span>
            </div>
          )}

          <div className="flex items-end justify-between mb-4">
            <div>
              <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-1">Saved</p>
              <p className="text-3xl font-mono font-black tracking-tight" style={{ color: goal.color }}>
                ₹{goal.currentAmount.toLocaleString('en-IN')}
              </p>
            </div>
            <div className="text-right">
              <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-1">Target</p>
              <p className="text-lg font-mono font-bold text-white/60">
                ₹{goal.targetAmount.toLocaleString('en-IN')}
              </p>
            </div>
          </div>

          {/* Progress bar */}
          <div className="w-full bg-white/8 rounded-full h-3 mb-3 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: 'circOut' }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(90deg, ${goal.color}cc, ${goal.color})` }}
            />
          </div>

          <div className="flex justify-between items-center text-xs">
            <span className="text-white/50 font-bold">{pct.toFixed(1)}% complete</span>
            <span className="text-white/50 font-bold">₹{remaining.toLocaleString('en-IN')} remaining</span>
          </div>

          {/* ETA row */}
          {remaining > 0 && (
            <div className="mt-4 pt-4 border-t border-white/8 flex items-center gap-4 flex-wrap text-[10px] font-bold text-white/40 uppercase tracking-widest">
              {eta.months !== null ? (
                <>
                  <span className="flex items-center gap-1"><Calendar size={11} /> ETA: <span className="text-white/70">{eta.date}</span></span>
                  <span className="flex items-center gap-1"><TrendingUp size={11} /> at ₹{Math.round(eta.monthlyNeeded).toLocaleString('en-IN')}/mo surplus</span>
                </>
              ) : (
                <span className="flex items-center gap-1 text-warning/70"><AlertCircle size={11} /> No surplus detected — add income or cut expenses</span>
              )}
              {goal.deadline && (
                <span className="flex items-center gap-1"><Target size={11} /> Deadline: <span className="text-white/70">{format(new Date(goal.deadline), 'dd MMM yyyy')}</span></span>
              )}
            </div>
          )}
        </motion.div>

        {/* Add contribution button */}
        {goal.isCompleted === 0 && (
          <button
            onClick={() => setShowAdd(true)}
            className="w-full h-13 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest text-white flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all border border-white/10"
            style={{ background: goal.color }}
          >
            <Plus size={16} /> Add Contribution
          </button>
        )}

        {/* AI Suggestions */}
        <div className="bg-[#121217] border border-white/8 rounded-[24px] overflow-hidden">
          <div className="flex items-center justify-between p-5">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-primary/15 border border-primary/25 flex items-center justify-center">
                <Sparkles size={16} className="text-primary" />
              </div>
              <div>
                <p className="text-xs font-extrabold text-white">AI Suggestions</p>
                <p className="text-[9px] text-white/35 font-bold uppercase tracking-wider">How to reach your goal faster</p>
              </div>
            </div>
            {!aiRequested && (
              <button
                onClick={fetchAiTips}
                className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/10 border border-primary/25 px-3 py-1.5 rounded-xl hover:bg-primary/20 transition-all active:scale-95"
              >
                Analyse
              </button>
            )}
          </div>

          <AnimatePresence>
            {aiLoading && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="px-5 pb-5 flex items-center gap-3 text-xs text-white/40">
                <div className="w-4 h-4 rounded-full border-2 border-primary border-t-transparent animate-spin shrink-0" />
                Analysing your spending patterns…
              </motion.div>
            )}
            {aiError && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="px-5 pb-5 text-xs text-error/70 font-bold">{aiError}</motion.p>
            )}
            {aiTips && !aiLoading && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="px-5 pb-5 space-y-4">

                {/* Motivation */}
                <p className="text-xs text-gray-300 italic leading-relaxed border-l-2 pl-3" style={{ borderColor: goal.color }}>
                  "{aiTips.motivation}"
                </p>

                {/* ETA comparison */}
                <div className="flex gap-3">
                  <div className="flex-1 bg-black/30 border border-white/5 rounded-2xl p-3 text-center">
                    <p className="text-[8px] text-white/30 font-black uppercase tracking-widest mb-1">Current ETA</p>
                    <p className="text-sm font-black text-white/60">{aiTips.eta_current}</p>
                  </div>
                  <div className="flex-1 bg-success/8 border border-success/20 rounded-2xl p-3 text-center">
                    <p className="text-[8px] text-success/60 font-black uppercase tracking-widest mb-1">With Cuts</p>
                    <p className="text-sm font-black text-success">{aiTips.eta_with_cuts}</p>
                  </div>
                </div>

                {/* Suggestions */}
                {aiTips.suggestions.map((s, i) => (
                  <div key={i} className="bg-black/25 border border-white/5 rounded-2xl p-4 space-y-2">
                    <div className="flex justify-between items-center">
                      <p className="text-xs font-extrabold text-white capitalize">{s.category}</p>
                      <span className="text-[9px] font-black text-success bg-success/10 border border-success/20 px-2 py-0.5 rounded-lg">
                        Save ₹{s.monthly_savings.toLocaleString('en-IN')}/mo
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-[9px] text-white/35 font-bold uppercase tracking-widest">
                      <span>Current: ₹{s.current_monthly_spend.toLocaleString('en-IN')}</span>
                      <span>→</span>
                      <span className="text-warning">Cut {s.suggested_cut_percent}%</span>
                    </div>
                    {/* mini bar */}
                    <div className="w-full bg-white/5 rounded-full h-1">
                      <div className="h-full rounded-full bg-warning/60" style={{ width: `${100 - s.suggested_cut_percent}%` }} />
                    </div>
                    <p className="text-[10px] text-gray-400 leading-relaxed">{s.tip}</p>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Contribution history */}
        {contributions.length > 0 && (
          <div>
            <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-3">Contribution History</p>
            <div className="space-y-2">
              {contributions.map(c => (
                <motion.div key={c.id} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between bg-[#121217] border border-white/8 rounded-2xl px-4 py-3">
                  <div>
                    <p className="text-sm font-bold text-white">+₹{c.amount.toLocaleString('en-IN')}</p>
                    <p className="text-[9px] text-white/35 font-bold uppercase tracking-widest">
                      {c.note || format(new Date(c.createdAt), 'dd MMM yyyy')}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <p className="text-[9px] text-white/25 font-bold">{format(new Date(c.createdAt), 'dd MMM')}</p>
                    <button onClick={() => handleDeleteContribution(c)}
                      className="text-error/40 hover:text-error transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Add contribution modal */}
      <AnimatePresence>
        {showAdd && (
          <div className="fixed inset-0 z-[150] flex items-end sm:items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/75 backdrop-blur-md" onClick={() => setShowAdd(false)} />
            <motion.div
              initial={{ y: '100%', opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 28, stiffness: 320 }}
              className="relative w-full max-w-sm bg-[#121217] border border-white/10 rounded-t-[28px] sm:rounded-[28px] p-6 z-10"
            >
              <h3 className="text-base font-extrabold text-white mb-4">Add to {goal.emoji} {goal.name}</h3>

              <div className="relative mb-3">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">₹</span>
                <input
                  type="number" autoFocus value={addAmt}
                  onChange={e => { setAddAmt(e.target.value); setAddErr(null); }}
                  placeholder="Amount"
                  className="w-full h-13 bg-black/40 border border-white/10 rounded-2xl pl-9 pr-4 text-white font-mono font-bold text-lg placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
                  min={1}
                />
              </div>
              <input type="text" value={addNote} onChange={e => setAddNote(e.target.value)}
                placeholder="Note (optional)"
                className="w-full h-11 bg-black/40 border border-white/10 rounded-2xl px-4 text-white text-sm placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors mb-4"
              />
              <AnimatePresence>
                {addErr && (
                  <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className="text-xs text-error font-bold mb-3 flex items-center gap-1">
                    <AlertCircle size={11} />{addErr}
                  </motion.p>
                )}
              </AnimatePresence>
              <div className="flex gap-3">
                <button onClick={() => setShowAdd(false)}
                  className="flex-1 h-12 rounded-2xl bg-white/5 text-gray-300 font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all">
                  Cancel
                </button>
                <button onClick={handleAddContribution} disabled={adding}
                  className="flex-1 h-12 rounded-2xl text-white font-bold text-sm shadow-lg active:scale-95 transition-all border border-white/10 disabled:opacity-50"
                  style={{ background: goal.color }}>
                  {adding ? 'Saving…' : 'Add'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit goal modal */}
      <AnimatePresence>
        {showEdit && (
          <CreateGoalModal
            goal={goal}
            onClose={() => setShowEdit(false)}
            onSaved={() => setShowEdit(false)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
