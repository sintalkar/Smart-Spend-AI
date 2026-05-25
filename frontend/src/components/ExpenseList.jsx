import React, { useState } from 'react';
import useExpenseStore from '../store/useExpenseStore';
import { Trash2, Edit2, Check, X, Calendar, AlertCircle } from 'lucide-react';

export default function ExpenseList() {
  const { expenses, deleteExpense, editExpense, loadingExpenses } = useExpenseStore();
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editNote, setEditNote] = useState('');

  const handleStartEdit = (exp) => {
    setEditingId(exp._id);
    setEditName(exp.name);
    setEditAmount(exp.amount.toString());
    setEditNote(exp.note || '');
  };

  const handleSave = async (id) => {
    const parsed = parseFloat(editAmount);
    if (!editName || isNaN(parsed) || parsed <= 0) return;
    await editExpense(id, {
      name: editName,
      amount: parsed,
      note: editNote
    });
    setEditingId(null);
  };

  if (loadingExpenses) {
    return (
      <div className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-800 text-center py-12">
        <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-slate-500">Retrieving expenses...</p>
      </div>
    );
  }

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-800 flex flex-col h-[520px]">
      <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Transaction Log</h3>

      {expenses.length === 0 ? (
        <div className="text-center py-20 flex-1 flex flex-col justify-center">
          <AlertCircle size={32} className="text-slate-700 mx-auto mb-3" />
          <p className="text-sm text-slate-500 font-medium">No expenses logged for this month yet.</p>
        </div>
      ) : (
        <div className="overflow-y-auto pr-1 space-y-3 flex-1 no-scrollbar">
          {expenses.map((exp) => (
            <div key={exp._id} className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between gap-4">
              {editingId === exp._id ? (
                <div className="flex-1 space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none w-full"
                      placeholder="Name"
                    />
                    <input
                      type="number"
                      value={editAmount}
                      onChange={(e) => setEditAmount(e.target.value)}
                      className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white font-mono outline-none w-full"
                      placeholder="Amount"
                    />
                  </div>
                  <input
                    type="text"
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    className="bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs text-white outline-none w-full"
                    placeholder="Note"
                  />
                  <div className="flex justify-end gap-1.5">
                    <button onClick={() => handleSave(exp._id)} className="p-1.5 bg-emerald-600 rounded-lg text-white cursor-pointer"><Check size={12} /></button>
                    <button onClick={() => setEditingId(null)} className="p-1.5 bg-slate-800 rounded-lg text-slate-400 cursor-pointer"><X size={12} /></button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-white text-sm truncate">{exp.name}</span>
                      <span className="text-sm font-mono font-bold text-slate-200">₹{exp.amount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                      <span className="bg-slate-800 px-2 py-0.5 rounded-md font-bold uppercase tracking-wider text-[9px] text-slate-400 border border-white/5">{exp.category}</span>
                      <span className="flex items-center gap-1"><Calendar size={10} />{new Date(exp.date).toLocaleDateString()}</span>
                    </div>
                    {exp.note && (
                      <p className="text-xs text-slate-400 italic mt-2 border-t border-slate-800/40 pt-1.5">{exp.note}</p>
                    )}
                  </div>
                  <div className="flex gap-1 shrink-0">
                    <button onClick={() => handleStartEdit(exp)} className="p-2 hover:bg-slate-800 rounded-lg text-slate-500 hover:text-white transition-colors cursor-pointer"><Edit2 size={12} /></button>
                    <button onClick={() => deleteExpense(exp._id)} className="p-2 hover:bg-red-500/10 rounded-lg text-slate-500 hover:text-red-400 transition-colors cursor-pointer"><Trash2 size={12} /></button>
                  </div>
                </>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
