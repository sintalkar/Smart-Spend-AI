import React, { useMemo } from 'react';
import useExpenseStore from '../store/useExpenseStore';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from 'recharts';

export default function SpendingChart() {
  const { expenses } = useExpenseStore();

  const chartData = useMemo(() => {
    const dailyTotals = {};
    const sorted = [...expenses].sort((a, b) => new Date(a.date) - new Date(b.date));
    
    sorted.forEach(exp => {
      const d = new Date(exp.date);
      const dayKey = `${d.getDate()} ${d.toLocaleString('default', { month: 'short' })}`;
      dailyTotals[dayKey] = (dailyTotals[dayKey] || 0) + exp.amount;
    });

    return Object.keys(dailyTotals).map(k => ({
      date: k,
      amount: dailyTotals[k]
    }));
  }, [expenses]);

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-800 h-[300px] flex flex-col">
      <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Spending Trend</h3>
      
      <div className="flex-1 w-full min-h-0">
        {chartData.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-20">No spending logged yet</p>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <XAxis dataKey="date" tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} />
              <YAxis tick={{fill: '#64748b', fontSize: 10}} axisLine={false} tickLine={false} />
              <Tooltip
                formatter={(val) => [`₹${val.toLocaleString()}`, 'Spent']}
                contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '12px', fontSize: '11px', color: '#fff' }}
              />
              <Area type="monotone" dataKey="amount" stroke="#6366f1" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}
