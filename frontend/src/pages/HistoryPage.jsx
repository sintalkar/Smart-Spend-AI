import React, { useState, useEffect } from 'react';
import axiosInstance from '../api/axiosInstance';
import { Calendar, FileText, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function HistoryPage() {
  const [selectedMonth, setSelectedMonth] = useState('');
  const [historyExpenses, setHistoryExpenses] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const d = new Date();
    const current = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(current);
  }, []);

  const fetchHistory = async (month) => {
    if (!month) return;
    setLoading(true);
    try {
      const res = await axiosInstance.get(`/expenses/history?month=${month}`);
      if (res.data.success) {
        setHistoryExpenses(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to retrieve history');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedMonth) {
      fetchHistory(selectedMonth);
    }
  }, [selectedMonth]);

  const totalAmount = historyExpenses.reduce((acc, curr) => acc + curr.amount, 0);

  return (
    <div className="min-h-screen bg-[#0b0f19] text-slate-100 pb-20">
      <header className="glass-panel border-b border-slate-800/80 sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/dashboard" className="p-2 hover:bg-slate-800 rounded-xl text-slate-400 hover:text-white transition-colors cursor-pointer">
            <ArrowLeft size={16} />
          </Link>
          <h1 className="text-base font-bold uppercase tracking-wider text-white">Monthly Archive</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-6 py-8 space-y-8">
        <div className="glass-panel rounded-3xl p-6 border border-slate-850 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 flex items-center justify-center text-indigo-400">
              <Calendar size={18} />
            </div>
            <div>
              <h3 className="font-bold text-white text-sm">Select Archive Month</h3>
              <p className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">Retrieve historical logs</p>
            </div>
          </div>

          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="bg-slate-900 border border-slate-800 rounded-2xl px-4 py-2.5 text-sm font-semibold text-white outline-none focus:border-indigo-500 transition-colors cursor-pointer"
          />
        </div>

        <div className="glass-panel rounded-3xl p-6 border border-slate-850">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-white text-base">Transactions ({historyExpenses.length})</h3>
            <span className="text-sm font-mono font-bold text-slate-200 bg-slate-900 px-3 py-1 rounded-xl border border-slate-800">
              Total Spent: ₹{totalAmount.toLocaleString()}
            </span>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-sm text-slate-500">Querying archive database...</p>
            </div>
          ) : historyExpenses.length === 0 ? (
            <div className="text-center py-20 text-slate-500">
              <FileText size={32} className="mx-auto mb-3 text-slate-700" />
              <p className="text-sm">No transactions logged during this month.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {historyExpenses.map((exp) => (
                <div key={exp._id} className="bg-slate-900/30 border border-slate-800/80 p-4 rounded-2xl flex items-center justify-between gap-4">
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
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
