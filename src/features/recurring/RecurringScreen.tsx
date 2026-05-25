import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, RefreshCw, Check, X, Calendar, TrendingUp, Clock } from 'lucide-react';
import {
  detectRecurringTransactions,
  markGroupAsRecurring,
  dismissGroup,
  RecurringGroup,
} from './RecurringDetectionService';
import { TransactionType } from '../../db/models';
import { EmptyState } from '../../core/ui/EmptyState';

const CADENCE_LABEL: Record<string, string> = {
  weekly: 'Every Week',
  biweekly: 'Every 2 Weeks',
  monthly: 'Every Month',
};

const CADENCE_COLOR: Record<string, string> = {
  weekly: 'bg-blue-500/15 text-blue-400 border-blue-500/25',
  biweekly: 'bg-secondary/15 text-secondary border-secondary/25',
  monthly: 'bg-primary/15 text-primary border-primary/25',
};

export default function RecurringScreen() {
  const navigate = useNavigate();
  const [groups, setGroups] = useState<RecurringGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const detected = await detectRecurringTransactions();
    // Only show groups where isRecurring hasn't already been set on all transactions
    const pending = detected.filter(g =>
      g.transactions.some(t => t.isRecurring === 0)
    );
    setGroups(pending);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleConfirm = async (group: RecurringGroup) => {
    setConfirming(group.key);
    await markGroupAsRecurring(group);
    setGroups(prev => prev.filter(g => g.key !== group.key));
    setConfirming(null);
  };

  const handleDismiss = async (group: RecurringGroup) => {
    setConfirming(group.key);
    await dismissGroup(group);
    setGroups(prev => prev.filter(g => g.key !== group.key));
    setConfirming(null);
  };

  const daysUntilNext = (nextDate: number) => {
    const diff = Math.round((nextDate - Date.now()) / (24 * 60 * 60 * 1000));
    if (diff < 0) return 'Overdue';
    if (diff === 0) return 'Due today';
    return `In ${diff} day${diff === 1 ? '' : 's'}`;
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#0A0A0C] text-white pb-32">
      {/* Header */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-50 flex items-center gap-4 px-6 py-4 bg-[#0A0A0C]/80 backdrop-blur-xl border-b border-white/5"
      >
        <button
          onClick={() => navigate('/transactions')}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
        >
          <ChevronLeft size={18} />
        </button>
        <div className="flex-1">
          <h1 className="text-base font-extrabold text-white tracking-tight">Recurring Payments</h1>
          <p className="text-[10px] text-white/40 font-bold uppercase tracking-widest">Auto-detected patterns</p>
        </div>
        <button
          onClick={load}
          className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
          aria-label="Refresh"
        >
          <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
        </button>
      </motion.header>

      <div className="px-6 py-6 space-y-4">
        {/* Info banner */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-primary/10 border border-primary/20 rounded-2xl flex items-start gap-3"
        >
          <TrendingUp size={16} className="text-primary shrink-0 mt-0.5" />
          <p className="text-xs text-gray-300 leading-relaxed">
            Smart Spend detected these payment patterns from your transaction history. Confirm to track them, or dismiss to ignore.
          </p>
        </motion.div>

        {loading ? (
          <div className="space-y-4 mt-4">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-32 rounded-3xl bg-white/5 animate-pulse" />
            ))}
          </div>
        ) : groups.length === 0 ? (
          <EmptyState
            title="No Patterns Found"
            description="Add more transactions over time and Smart Spend will detect your recurring payments automatically."
          />
        ) : (
          <AnimatePresence>
            {groups.map((group, idx) => {
              const isCredit = group.type === TransactionType.CREDIT;
              const isBusy = confirming === group.key;
              return (
                <motion.div
                  key={group.key}
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -80, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                  className="bg-gradient-to-b from-[#121217] to-[#0A0A0C] border border-white/8 rounded-3xl p-5 space-y-4"
                >
                  {/* Top row */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-white font-extrabold text-sm truncate leading-tight">
                        {group.merchantName}
                      </p>
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider border ${CADENCE_COLOR[group.cadence]}`}>
                          {CADENCE_LABEL[group.cadence]}
                        </span>
                        <span className={`text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-wider border ${isCredit ? 'bg-success/15 text-success border-success/25' : 'bg-error/10 text-error/80 border-error/20'}`}>
                          {isCredit ? 'Income' : 'Expense'}
                        </span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className={`text-lg font-mono font-black tracking-tight ${isCredit ? 'text-success' : 'text-white'}`}>
                        {isCredit ? '+' : '-'}₹{group.avgAmount.toLocaleString()}
                      </p>
                      <p className="text-[9px] text-white/30 font-bold uppercase tracking-widest">avg / cycle</p>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="flex items-center gap-4 text-[10px] font-bold text-white/40 bg-black/30 rounded-2xl px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <Clock size={11} className="text-white/30" />
                      <span>{group.transactions.length} occurrences</span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <Calendar size={11} className="text-white/30" />
                      <span className={
                        daysUntilNext(group.nextExpectedDate) === 'Overdue'
                          ? 'text-error font-black'
                          : daysUntilNext(group.nextExpectedDate) === 'Due today'
                          ? 'text-warning font-black'
                          : ''
                      }>
                        Next: {daysUntilNext(group.nextExpectedDate)}
                      </span>
                    </div>
                    <div className="w-px h-3 bg-white/10" />
                    <div className="flex items-center gap-1.5">
                      <span>Confidence: {Math.round(group.confidence * 100)}%</span>
                    </div>
                  </div>

                  {/* Confidence bar */}
                  <div className="w-full bg-white/5 rounded-full h-1">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${group.confidence * 100}%` }}
                      transition={{ duration: 0.8, ease: 'circOut', delay: idx * 0.05 + 0.2 }}
                      className={`h-full rounded-full ${group.confidence >= 0.75 ? 'bg-success' : group.confidence >= 0.5 ? 'bg-warning' : 'bg-primary'}`}
                    />
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3">
                    <button
                      onClick={() => handleDismiss(group)}
                      disabled={isBusy}
                      className="flex-1 h-11 rounded-2xl bg-white/5 border border-white/8 text-gray-400 text-xs font-black uppercase tracking-widest hover:bg-error/10 hover:text-error hover:border-error/20 transition-all active:scale-95 flex items-center justify-center gap-2 disabled:opacity-40"
                    >
                      <X size={13} />
                      Dismiss
                    </button>
                    <button
                      onClick={() => handleConfirm(group)}
                      disabled={isBusy}
                      className="flex-1 h-11 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-widest hover:bg-primary/90 shadow-lg shadow-primary/20 active:scale-95 transition-all flex items-center justify-center gap-2 disabled:opacity-40 border border-white/10"
                    >
                      <Check size={13} />
                      {isBusy ? 'Saving…' : 'Confirm'}
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
