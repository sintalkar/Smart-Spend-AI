import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { motion, AnimatePresence } from 'motion/react';
import { Plus, ChevronRight, CheckCircle2, Trophy } from 'lucide-react';
import { db } from '../../db/database';
import { GoalEntity } from '../../db/models';
import { format } from 'date-fns';
import { EmptyState } from '../../core/ui/EmptyState';
import CreateGoalModal from './CreateGoalModal';
import clsx from 'clsx';

function GoalCard({ goal, onClick }: { goal: GoalEntity; onClick: () => void }) {
  const pct       = goal.targetAmount > 0 ? Math.min((goal.currentAmount / goal.targetAmount) * 100, 100) : 0;
  const remaining = Math.max(goal.targetAmount - goal.currentAmount, 0);
  const done      = goal.isCompleted === 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={onClick}
      className={clsx(
        'relative overflow-hidden rounded-[24px] p-5 border cursor-pointer active:scale-[0.98] transition-all group',
        done ? 'border-success/30 bg-success/5' : 'border-white/8 bg-[#121217]',
      )}
      style={!done ? { background: `linear-gradient(135deg, ${goal.color}10 0%, #12121700 60%)` } : undefined}
    >
      <div className="absolute top-0 right-0 w-24 h-24 blur-[50px] rounded-full -z-10 opacity-40"
        style={{ background: goal.color }} />

      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center text-xl border border-white/10 bg-white/5 shrink-0">
            {goal.emoji}
          </div>
          <div>
            <p className="text-sm font-extrabold text-white leading-tight">{goal.name}</p>
            {done ? (
              <span className="text-[9px] font-black text-success uppercase tracking-widest flex items-center gap-1 mt-0.5">
                <CheckCircle2 size={9} /> Completed
              </span>
            ) : goal.deadline ? (
              <p className="text-[9px] text-white/35 font-bold uppercase tracking-widest mt-0.5">
                Due {format(new Date(goal.deadline), 'dd MMM yyyy')}
              </p>
            ) : null}
          </div>
        </div>
        <ChevronRight size={16} className="text-white/20 group-hover:text-white/50 transition-colors shrink-0 mt-1" />
      </div>

      {/* Progress bar */}
      <div className="w-full bg-white/5 rounded-full h-2 mb-3 overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: 'circOut' }}
          className="h-full rounded-full"
          style={{ background: done ? '#10B981' : goal.color }}
        />
      </div>

      <div className="flex justify-between items-center text-[10px] font-bold">
        <span style={{ color: goal.color }}>₹{goal.currentAmount.toLocaleString('en-IN')}</span>
        <span className="text-white/30">
          {done ? '🎉 Done!' : `₹${remaining.toLocaleString('en-IN')} left  ·  ${pct.toFixed(0)}%`}
        </span>
        <span className="text-white/40">of ₹{goal.targetAmount.toLocaleString('en-IN')}</span>
      </div>
    </motion.div>
  );
}

export default function GoalsScreen() {
  const navigate  = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [showDone,   setShowDone]   = useState(false);

  const goals = useLiveQuery(() =>
    db.goals.orderBy('createdAt').reverse().toArray()
  ) || [];

  const active    = goals.filter(g => g.isCompleted === 0);
  const completed = goals.filter(g => g.isCompleted === 1);

  // Summary stats
  const totalTarget  = active.reduce((s, g) => s + g.targetAmount, 0);
  const totalSaved   = active.reduce((s, g) => s + g.currentAmount, 0);
  const overallPct   = totalTarget > 0 ? Math.round((totalSaved / totalTarget) * 100) : 0;

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0C] text-white pb-32">

      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 px-6 py-4 bg-[#0A0A0C]/80 backdrop-blur-xl border-b border-white/5"
      >
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-base font-extrabold text-white tracking-tight">Savings Goals</h1>
            <p className="text-[10px] text-white/35 font-bold uppercase tracking-widest">
              {active.length} active · {completed.length} completed
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="h-10 px-4 bg-primary text-white text-xs font-black uppercase tracking-widest rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all border border-white/10 flex items-center gap-1.5"
          >
            <Plus size={14} /> New Goal
          </button>
        </div>
      </motion.header>

      <div className="px-6 py-5 space-y-5">

        {/* Summary banner — only when there are active goals */}
        {active.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-[#121217] border border-white/8 rounded-[24px] p-5"
          >
            <div className="flex justify-between items-end mb-3">
              <div>
                <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-1">Total Saved (Active Goals)</p>
                <p className="text-2xl font-mono font-black text-primary">
                  ₹{totalSaved.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[9px] text-white/35 font-black uppercase tracking-widest mb-1">Combined Target</p>
                <p className="text-base font-mono font-bold text-white/50">
                  ₹{totalTarget.toLocaleString('en-IN')}
                </p>
              </div>
            </div>
            <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden">
              <motion.div
                initial={{ width: 0 }} animate={{ width: `${overallPct}%` }}
                transition={{ duration: 1.2, ease: 'circOut' }}
                className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
              />
            </div>
            <p className="text-[10px] text-white/30 font-bold mt-2">{overallPct}% across all active goals</p>
          </motion.div>
        )}

        {/* Active goals */}
        {active.length === 0 && completed.length === 0 ? (
          <EmptyState
            title="No Goals Yet"
            description="Create a savings goal — Emergency Fund, Dream Trip, New Phone — and track your progress."
          />
        ) : (
          <>
            {active.length === 0 && (
              <div className="text-center py-10">
                <Trophy size={36} className="text-success mx-auto mb-3" />
                <p className="text-white font-extrabold text-base mb-1">All goals completed!</p>
                <p className="text-white/40 text-xs">Set a new goal to keep saving.</p>
              </div>
            )}

            <div className="space-y-3">
              {active.map((g, i) => (
                <motion.div key={g.id} transition={{ delay: i * 0.06 }}>
                  <GoalCard goal={g} onClick={() => navigate(`/goals/${g.id}`)} />
                </motion.div>
              ))}
            </div>

            {/* Completed section */}
            {completed.length > 0 && (
              <div>
                <button
                  onClick={() => setShowDone(v => !v)}
                  className="flex items-center gap-2 text-[10px] text-white/35 font-black uppercase tracking-widest mb-3 hover:text-white/60 transition-colors"
                >
                  <Trophy size={12} className="text-success/60" />
                  {completed.length} Completed Goal{completed.length !== 1 ? 's' : ''}
                  <span>{showDone ? '▲' : '▼'}</span>
                </button>
                <AnimatePresence>
                  {showDone && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }} className="overflow-hidden space-y-3"
                    >
                      {completed.map(g => (
                        <GoalCard key={g.id} goal={g} onClick={() => navigate(`/goals/${g.id}`)} />
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </>
        )}
      </div>

      {/* Create modal */}
      <AnimatePresence>
        {showCreate && (
          <CreateGoalModal
            onClose={() => setShowCreate(false)}
            onSaved={(id) => { setShowCreate(false); navigate(`/goals/${id}`); }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
