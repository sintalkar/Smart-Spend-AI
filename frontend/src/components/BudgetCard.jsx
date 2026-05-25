import React, { useState } from 'react';
import useExpenseStore from '../store/useExpenseStore';
import { Target, Edit2, Check, X } from 'lucide-react';

export default function BudgetCard() {
  const { currentBudget, totalSpent, setMonthlyBudget } = useExpenseStore();
  const [isEditing, setIsEditing] = useState(false);
  const [amount, setAmount] = useState('');

  const handleSave = () => {
    const parsed = parseFloat(amount);
    if (!isNaN(parsed) && parsed > 0) {
      setMonthlyBudget(parsed);
      setIsEditing(false);
      setAmount('');
    }
  };

  const budget = currentBudget ? currentBudget.totalBudget : 10000;
  const percent = budget > 0 ? Math.round((totalSpent / budget) * 100) : 0;

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-xl relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 blur-3xl rounded-full"></div>
      
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
            <Target size={22} />
          </div>
          <div>
            <p className="text-[10px] text-indigo-400 font-black uppercase tracking-[0.2em] mb-1">Monthly Budget Cap</p>
            {isEditing ? (
              <div className="flex items-center gap-1.5 mt-1">
                <span className="text-white font-bold">₹</span>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder={budget.toString()}
                  className="bg-slate-900 border border-slate-800 rounded-xl px-2 py-1 text-sm font-mono font-bold text-white outline-none w-28 focus:border-indigo-500"
                />
                <button onClick={handleSave} className="p-1.5 bg-indigo-600 rounded-lg text-white cursor-pointer"><Check size={12} /></button>
                <button onClick={() => setIsEditing(false)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 cursor-pointer"><X size={12} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-2xl font-mono font-black text-white">₹{budget.toLocaleString()}</span>
                <button onClick={() => { setAmount(budget.toString()); setIsEditing(true); }} className="text-slate-500 hover:text-white transition-colors cursor-pointer"><Edit2 size={12} /></button>
              </div>
            )}
          </div>
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">Total Spent</span>
          <span className="text-lg font-mono font-bold text-slate-200">₹{totalSpent.toLocaleString()}</span>
        </div>
      </div>

      <div className="space-y-2 mt-6">
        <div className="flex justify-between text-xs font-semibold">
          <span className="text-slate-400">Usage Meter</span>
          <span className={percent >= 80 ? "text-red-400" : percent >= 60 ? "text-amber-400" : "text-emerald-400"}>
            {percent}% Used
          </span>
        </div>
        <div className="h-2.5 bg-slate-950/40 rounded-full overflow-hidden border border-white/5">
          <div
            className={`h-full rounded-full transition-all duration-500 ${
              percent >= 80 ? 'bg-gradient-to-r from-red-500 to-pink-500' :
              percent >= 60 ? 'bg-gradient-to-r from-amber-500 to-orange-400' :
              'bg-gradient-to-r from-emerald-500 to-teal-400'
            }`}
            style={{ width: `${Math.min(percent, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}
