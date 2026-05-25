import React, { useEffect } from 'react';
import useExpenseStore from '../store/useExpenseStore';
import { Sparkles, Target, Coins, ShieldAlert, RefreshCw, AlertTriangle, Lightbulb } from 'lucide-react';
import clsx from 'clsx';

export default function AIInsightsPanel() {
  const { aiInsight, loadingAI, triggerAIAnalysis, fetchLastInsight } = useExpenseStore();

  useEffect(() => {
    fetchLastInsight();
  }, []);

  return (
    <div className="glass-panel rounded-3xl p-6 shadow-xl border border-slate-850">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Sparkles size={20} className="text-violet-500 relative z-10" />
            <div className="absolute inset-0 bg-violet-500 rounded-full blur-md opacity-30 animate-pulse"></div>
          </div>
          <h3 className="text-lg font-bold text-white uppercase tracking-wider">AI Financial Advisor</h3>
        </div>

        <button
          onClick={triggerAIAnalysis}
          disabled={loadingAI}
          className="flex items-center gap-2 px-4 py-2 bg-violet-600/10 hover:bg-violet-600/20 text-violet-400 border border-violet-500/20 text-xs font-bold rounded-xl transition-all disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw size={14} className={clsx(loadingAI && "animate-spin")} />
          {loadingAI ? 'Analyzing...' : 'Re-Analyze'}
        </button>
      </div>

      {loadingAI ? (
        <div className="space-y-3 py-6">
          <div className="h-4 bg-slate-800 rounded w-full animate-pulse"></div>
          <div className="h-4 bg-slate-800 rounded w-5/6 animate-pulse"></div>
          <div className="h-4 bg-slate-800 rounded w-4/6 animate-pulse"></div>
          <p className="text-xs text-slate-500 text-center pt-2">Claude is auditing your budget...</p>
        </div>
      ) : aiInsight ? (
        <div className="space-y-6">
          {aiInsight.alert && (
            <div className="border border-red-500/20 bg-red-500/10 rounded-2xl p-4 flex gap-3">
              <ShieldAlert size={18} className="text-red-500 shrink-0 mt-0.5 animate-pulse" />
              <p className="text-xs text-red-400 font-medium leading-relaxed">
                {aiInsight.alert_message}
              </p>
            </div>
          )}

          <div className="bg-slate-900/50 border border-slate-800/80 rounded-2xl p-4">
            <p className="text-sm text-slate-300 leading-relaxed font-medium">
              {aiInsight.summary}
            </p>
          </div>

          {aiInsight.top_overspending_categories && aiInsight.top_overspending_categories.length > 0 && (
            <div>
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Overspending Hotspots</h4>
              <div className="space-y-3">
                {aiInsight.top_overspending_categories.map((cat, idx) => (
                  <div key={idx} className="bg-slate-900/30 border border-slate-800/50 p-4 rounded-2xl">
                    <div className="flex justify-between items-start mb-1">
                      <span className="font-bold text-white text-sm">{cat.category}</span>
                      <span className="text-xs font-mono font-bold text-red-400">₹{cat.amount_spent.toLocaleString()} spent</span>
                    </div>
                    <div className="flex justify-between text-[10px] text-slate-500 mb-3">
                      <span>Limit: ₹{cat.recommended_max.toLocaleString()}</span>
                      <span className="font-bold text-red-500/70">Excess: ₹{cat.excess.toLocaleString()}</span>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed mb-2 bg-slate-900/50 p-2.5 rounded-xl border border-slate-800/20">
                      {cat.insight}
                    </p>
                    <div className="flex items-center gap-1.5 text-[11px] text-emerald-400 bg-emerald-500/5 px-2.5 py-1 rounded-xl border border-emerald-500/10 w-max">
                      <Lightbulb size={12} />
                      <span className="font-medium">{cat.tip}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiInsight.savings_suggestions && aiInsight.savings_suggestions.length > 0 && (
            <div>
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Smart Cuts</h4>
              <div className="flex overflow-x-auto gap-4 pb-2 no-scrollbar">
                {aiInsight.savings_suggestions.map((sug, i) => (
                  <div key={i} className="min-w-[240px] max-w-[240px] bg-slate-900/20 border border-slate-800 p-4 rounded-2xl flex-shrink-0 flex flex-col justify-between">
                    <div>
                      <h5 className="font-bold text-white text-xs mb-1.5">{sug.title}</h5>
                      <p className="text-[11px] text-slate-400 leading-relaxed font-medium mb-3">
                        {sug.detail}
                      </p>
                    </div>
                    <div className="bg-slate-950/40 rounded-xl p-2.5 flex justify-between items-center border border-slate-800/50">
                      <span className="text-[9px] text-slate-500 font-bold uppercase">Savings</span>
                      <span className="text-emerald-400 font-mono font-bold text-xs">+₹{sug.estimated_monthly_savings}/mo</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiInsight.investment_suggestions && aiInsight.investment_suggestions.length > 0 && (
            <div>
              <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest mb-3">Tailored Investments</h4>
              <div className="space-y-3">
                {aiInsight.investment_suggestions.map((inv, idx) => (
                  <div key={idx} className="bg-slate-900/20 border border-violet-500/10 p-4 rounded-2xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-16 h-16 bg-violet-500/5 blur-xl rounded-full"></div>
                    <div className="flex justify-between items-start gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-500/10 flex items-center justify-center text-violet-400 shrink-0">
                          <Coins size={14} />
                        </div>
                        <div>
                          <h5 className="font-bold text-white text-xs leading-none">{inv.title}</h5>
                          <span className="text-[9px] text-slate-500 uppercase tracking-widest mt-1 block">Platform: {inv.platform}</span>
                        </div>
                      </div>
                      <div className="text-right">
                        <span className="text-xs font-mono font-bold text-white">₹{inv.amount.toLocaleString()}/mo</span>
                        <p className="text-[9px] text-violet-400 font-bold mt-0.5">{inv.expected_return} ({inv.time_horizon})</p>
                      </div>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed font-medium bg-black/15 p-2.5 rounded-xl border border-slate-800/40 mt-3">
                      {inv.detail}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {aiInsight.motivational_message && (
            <div className="text-center py-2 border-t border-slate-800/50">
              <p className="text-xs text-slate-400 italic">
                "{aiInsight.motivational_message}"
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-8">
          <AlertTriangle size={32} className="text-slate-600 mx-auto mb-3" />
          <p className="text-sm text-slate-400 font-medium mb-4">No analysis available for this period.</p>
          <button
            onClick={triggerAIAnalysis}
            className="px-6 py-2.5 bg-violet-600 hover:bg-violet-500 active:scale-95 text-white text-xs font-bold rounded-xl transition-all shadow-lg shadow-violet-600/10 cursor-pointer"
          >
            Audit Budget with Claude
          </button>
        </div>
      )}
    </div>
  );
}
