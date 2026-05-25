import React from 'react';
import useExpenseStore from '../store/useExpenseStore';

export default function CategoryBreakdown() {
  const { summary } = useExpenseStore();

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-800">
      <h3 className="text-lg font-bold text-white mb-6 uppercase tracking-wider">Category Audit</h3>

      {summary.length === 0 ? (
        <p className="text-sm text-slate-500 text-center py-6">No data to breakdown</p>
      ) : (
        <div className="space-y-4">
          {summary.map((item, idx) => (
            <div key={idx} className="space-y-2">
              <div className="flex justify-between text-xs font-semibold">
                <div className="flex items-center gap-2">
                  <span className="text-white">{item.category}</span>
                  <span className="text-[10px] text-slate-500 font-normal">({item.transactionCount} tx)</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-300 font-mono font-bold">₹{item.totalSpent.toLocaleString()}</span>
                  <span className="text-[10px] text-slate-500 block font-normal">{item.percentageOfBudget}% of budget</span>
                </div>
              </div>
              <div className="h-1.5 bg-slate-900 rounded-full overflow-hidden">
                <div
                  className="h-full bg-indigo-500 rounded-full"
                  style={{ width: `${Math.min(item.percentageOfBudget, 100)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
