import React from 'react';
import { X, ShieldAlert } from 'lucide-react';

export default function AlertPopup({ isOpen, onClose, spendingPercentage }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm transition-all duration-300">
      <div className="relative w-full max-w-md bg-slate-900 border border-red-500/30 rounded-3xl p-6 shadow-[0_10px_50px_rgba(239,68,68,0.25)] transition-all duration-300">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors"
        >
          <X size={20} />
        </button>

        <div className="flex flex-col items-center text-center mt-2">
          <div className="w-16 h-16 rounded-full bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500 mb-4">
            <ShieldAlert size={36} className="animate-pulse" />
          </div>

          <h3 className="text-xl font-bold text-white mb-2 uppercase tracking-wide">
            Budget Warning Triggered!
          </h3>

          <p className="text-sm text-red-400 font-semibold px-4 py-1.5 bg-red-500/5 border border-red-500/10 rounded-full mb-4">
            You have utilized <span className="font-mono font-bold">{spendingPercentage}%</span> of your monthly budget.
          </p>

          <p className="text-sm text-slate-300 leading-relaxed mb-6">
            ⚠️ Warning! You have crossed the <strong>60%</strong> spending threshold. Slow down on non-essential categories (Wants, Entertainment, Shopping) to prevent overspending this month!
          </p>

          <button
            onClick={onClose}
            className="w-full py-3.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-bold rounded-2xl shadow-lg shadow-red-600/20 transition-all uppercase tracking-wider text-xs"
          >
            I will cut back!
          </button>
        </div>
      </div>
    </div>
  );
}
