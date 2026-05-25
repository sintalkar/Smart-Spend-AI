import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, AlertCircle } from 'lucide-react';
import { db } from '../../db/database';
import { GoalEntity } from '../../db/models';
import { v4 as uuidv4 } from 'uuid';
import clsx from 'clsx';

const EMOJIS = ['🎯','✈️','🏠','🚗','💍','📱','🎓','🏖️','🎸','💊','💎','🛡️','🌍','🏋️','🎁','🍕'];
const COLORS  = ['#6C63FF','#10B981','#F43F5E','#F59E0B','#3B82F6','#8B5CF6','#EC4899','#14B8A6'];

interface Props {
  goal?: GoalEntity;          // present = edit mode
  onClose: () => void;
  onSaved: (id: string) => void;
}

export default function CreateGoalModal({ goal, onClose, onSaved }: Props) {
  const isEdit = !!goal;

  const [name,        setName]        = useState(goal?.name ?? '');
  const [emoji,       setEmoji]       = useState(goal?.emoji ?? '🎯');
  const [color,       setColor]       = useState(goal?.color ?? COLORS[0]);
  const [target,      setTarget]      = useState(goal ? String(goal.targetAmount) : '');
  const [deadlineStr, setDeadlineStr] = useState(
    goal?.deadline ? new Date(goal.deadline).toISOString().split('T')[0] : ''
  );
  const [error,   setError]   = useState<string | null>(null);
  const [saving,  setSaving]  = useState(false);

  const handleSubmit = async () => {
    const amt = Number(target);
    if (!name.trim())          { setError('Please enter a goal name.');        return; }
    if (!target || isNaN(amt) || amt <= 0) { setError('Enter a valid target amount.'); return; }

    setSaving(true);
    try {
      const now = Date.now();
      if (isEdit && goal) {
        await db.goals.update(goal.id, {
          name: name.trim(), emoji, color,
          targetAmount: amt,
          deadline: deadlineStr ? new Date(deadlineStr).getTime() : undefined,
          updatedAt: now,
        });
        onSaved(goal.id);
      } else {
        const id = uuidv4();
        await db.goals.add({
          id, name: name.trim(), emoji, color,
          targetAmount: amt,
          currentAmount: 0,
          deadline: deadlineStr ? new Date(deadlineStr).getTime() : undefined,
          isCompleted: 0,
          createdAt: now,
          updatedAt: now,
        });
        onSaved(id);
      }
    } catch (e) {
      console.error(e);
      setError('Failed to save goal. Please try again.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="absolute inset-0 bg-black/75 backdrop-blur-md"
        onClick={onClose}
      />
      <motion.div
        initial={{ y: '100%', opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: '100%', opacity: 0 }}
        transition={{ type: 'spring', damping: 28, stiffness: 320 }}
        className="relative w-full max-w-md bg-[#121217] border border-white/10 rounded-t-[32px] sm:rounded-[32px] p-6 shadow-2xl z-10"
      >
        <div className="absolute top-0 right-0 w-48 h-48 blur-[70px] rounded-full -z-10" style={{ background: color + '30' }} />

        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-extrabold text-white">{isEdit ? 'Edit Goal' : 'New Savings Goal'}</h2>
          <button onClick={onClose} className="w-9 h-9 rounded-xl bg-white/5 border border-white/8 flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <X size={15} />
          </button>
        </div>

        {/* Emoji row */}
        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">Choose Icon</p>
        <div className="flex flex-wrap gap-2 mb-5">
          {EMOJIS.map(e => (
            <button
              key={e}
              onClick={() => setEmoji(e)}
              className={clsx(
                'w-10 h-10 rounded-xl text-lg transition-all border',
                emoji === e
                  ? 'border-white/40 bg-white/15 scale-110'
                  : 'border-white/8 bg-white/5 hover:bg-white/10',
              )}
            >{e}</button>
          ))}
        </div>

        {/* Name */}
        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">Goal Name</p>
        <input
          type="text"
          value={name}
          onChange={e => { setName(e.target.value); setError(null); }}
          placeholder="e.g. Goa Trip, Emergency Fund…"
          className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl px-4 text-white text-sm font-semibold placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors mb-4"
          maxLength={40}
        />

        {/* Target amount */}
        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">Target Amount (₹)</p>
        <div className="relative mb-4">
          <span className="absolute left-4 top-1/2 -translate-y-1/2 text-white/40 font-bold text-lg">₹</span>
          <input
            type="number"
            value={target}
            onChange={e => { setTarget(e.target.value); setError(null); }}
            placeholder="50000"
            className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl pl-9 pr-4 text-white font-mono font-bold text-sm placeholder:text-white/25 outline-none focus:border-primary/50 transition-colors"
            min={1}
          />
        </div>

        {/* Deadline */}
        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">Deadline (optional)</p>
        <input
          type="date"
          value={deadlineStr}
          onChange={e => setDeadlineStr(e.target.value)}
          min={new Date().toISOString().split('T')[0]}
          className="w-full h-12 bg-black/40 border border-white/10 rounded-2xl px-4 text-white text-sm font-semibold outline-none focus:border-primary/50 transition-colors mb-4 [color-scheme:dark]"
        />

        {/* Color */}
        <p className="text-[9px] text-white/40 font-black uppercase tracking-widest mb-2">Accent Color</p>
        <div className="flex gap-2 mb-5">
          {COLORS.map(c => (
            <button
              key={c}
              onClick={() => setColor(c)}
              style={{ background: c }}
              className={clsx(
                'w-8 h-8 rounded-xl transition-all border-2',
                color === c ? 'border-white scale-110 shadow-lg' : 'border-transparent',
              )}
            />
          ))}
        </div>

        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 p-3 bg-error/10 border border-error/20 rounded-xl text-error text-xs font-bold mb-4"
            >
              <AlertCircle size={13} /> {error}
            </motion.div>
          )}
        </AnimatePresence>

        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 h-13 py-3 rounded-2xl bg-white/5 text-gray-300 font-semibold text-sm hover:bg-white/10 active:scale-95 transition-all">
            Cancel
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            style={{ background: color }}
            className="flex-1 h-13 py-3 rounded-2xl text-white font-bold text-sm shadow-lg active:scale-95 transition-all border border-white/10 disabled:opacity-50"
          >
            {saving ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Goal'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
