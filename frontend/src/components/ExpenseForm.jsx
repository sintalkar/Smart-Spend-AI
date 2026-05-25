import React, { useState } from 'react';
import useExpenseStore from '../store/useExpenseStore';
import { PlusCircle } from 'lucide-react';

const CATEGORIES = ["Food & Dining", "Transport", "Entertainment",
                     "Shopping", "Bills & Utilities", "Health", "Others"];

export default function ExpenseForm({ onAlertTriggered }) {
  const { addExpense } = useExpenseStore();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!name || isNaN(parsedAmount) || parsedAmount <= 0) return;

    setLoading(true);
    const result = await addExpense({
      name,
      category,
      amount: parsedAmount,
      note
    });
    setLoading(false);

    if (result && result.alertRequired) {
      if (onAlertTriggered) {
        onAlertTriggered(result.spendingPercentage);
      }
    }

    setName('');
    setAmount('');
    setNote('');
  };

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-800">
      <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider flex items-center gap-2">
        <PlusCircle size={18} className="text-indigo-400" />
        Add Expense
      </h3>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Expense Name</label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Swiggy, Petrol, Netflix, etc."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Category</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors"
            >
              {CATEGORIES.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Amount (₹)</label>
            <input
              type="number"
              required
              min="1"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-mono font-bold text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block mb-1">Note (Optional)</label>
          <input
            type="text"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add brief details..."
            className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors placeholder:text-slate-600"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3.5 bg-indigo-600 hover:bg-indigo-500 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-indigo-600/10 transition-all uppercase tracking-wider text-xs cursor-pointer disabled:opacity-50"
        >
          {loading ? 'Adding...' : 'Log Expense'}
        </button>
      </form>
    </div>
  );
}
