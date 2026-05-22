import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db';
import { TransactionType } from '../../db/models';
import { scoreCalculator } from './MoneyScoreCalculator';
import { scoreService, ScoreImprovementTip } from './GeminiScoreService';
import { 
  Shield, 
  TrendingUp, 
  ChevronLeft, 
  Target, 
  Wallet, 
  BarChart2, 
  Activity, 
  Award, 
  CheckCircle, 
  Info, 
  AlertCircle,
  Cpu,
  Zap,
  Layers,
  Sparkles
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, Tooltip as RechartsTooltip, YAxis } from 'recharts';
import clsx from 'clsx';
import { format, subMonths, isSameMonth } from 'date-fns';

function AnimatedCounter({ value, duration = 800 }: { value: number, duration?: number }) {
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    let startTime: number;
    const startValue = displayValue;

    const animate = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4); // Quartic ease out
      setDisplayValue(Math.floor(startValue + (value - startValue) * easeProgress));

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    };
    requestAnimationFrame(animate);
  }, [value, duration]);

  return <span>{displayValue}</span>;
}

export default function MoneyScoreScreen() {
  const [tips, setTips] = useState<ScoreImprovementTip[]>([]);
  const [loadingTips, setLoadingTips] = useState(false);
  const [errorTips, setErrorTips] = useState<string | null>(null);
  const [isAnatomyVisible, setIsAnatomyVisible] = useState(false);
  const [isScanning, setIsScanning] = useState(true);

  const currentDate = useMemo(() => new Date(), []);
  
  // Speed up query by filtering in memory once
  const allTxs = useLiveQuery(() => 
    db.transactions.toArray()
      .then(arr => arr.filter(t => t.isDeleted === 0))
      .catch(err => {
        console.warn("Failed to load transactions:", err);
        return [];
      }),
    []
  ) || [];
  
  const { scoreResult, historyData, badges } = useMemo(() => {
    if (allTxs.length === 0) {
      return { 
        scoreResult: scoreCalculator.calculateScore(0, 0, {}, [], 0, 0, []),
        historyData: [],
        badges: []
      };
    }

    const months = Array.from({length: 6}).map((_, i) => subMonths(currentDate, 5 - i));
    const scores: number[] = [];
    const hData: { month: string, score: number }[] = [];

    // Group transactions by month first for efficiency
    const txsByMonth: Record<string, typeof allTxs> = {};
    allTxs.forEach(t => {
      const mKey = format(new Date(t.dateTime), 'yyyy-MM');
      if (!txsByMonth[mKey]) txsByMonth[mKey] = [];
      txsByMonth[mKey].push(t);
    });

    let currentScore = scoreCalculator.calculateScore(0, 0, {}, [], 0, 0, []);

    for (const m of months) {
      const mKey = format(m, 'yyyy-MM');
      const monthTx = txsByMonth[mKey] || [];
      
      let tSpent = 0;
      let inc = 0;
      const catTotals: Record<string, number> = {};
      const dailyMap: Record<string, number> = {};

      monthTx.forEach(t => {
        if (t.type === TransactionType.DEBIT) {
          tSpent += t.amount;
          catTotals[t.categoryId] = (catTotals[t.categoryId] || 0) + t.amount;
          const dk = format(new Date(t.dateTime), 'dd');
          dailyMap[dk] = (dailyMap[dk] || 0) + t.amount;
        } else {
          inc += t.amount;
        }
      });
      
      const res = scoreCalculator.calculateScore(tSpent, inc, catTotals, Object.values(dailyMap), 0, 0, scores);
      scores.push(res.total);
      hData.push({ month: format(m, 'MMM'), score: res.total });
      
      if (isSameMonth(m, currentDate)) {
        currentScore = res;
      }
    }

    const bgs = [
      { id: 'saver', title: 'Savings Champion', locked: currentScore.breakdown.savingsRate < 30 },
      { id: 'budget', title: 'Budget Master', locked: true },
      { id: 'streak', title: 'Streak Legend', locked: currentScore.breakdown.monthlyStreak < 5 },
      { id: 'debtfree', title: 'Debt Free', locked: false },
      { id: '10k', title: '₹10k Saver', locked: true },
      { id: 'smart', title: 'Smart Spender', locked: currentScore.total < 80 }
    ];

    return { scoreResult: currentScore, historyData: hData, badges: bgs };
  }, [allTxs, currentDate]);

  // Initial scanning delay for "premium factor"
  useEffect(() => {
    const timer = setTimeout(() => setIsScanning(false), 1200); // Shorter for better response
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    let isMounted = true;
    if (scoreResult.total > 0 && tips.length === 0 && !loadingTips && !errorTips && !isScanning) {
      setLoadingTips(true);
      const fetchTips = async () => {
        try {
          const res = await scoreService.getImprovementTips(scoreResult.total, scoreResult.breakdown);
          if (!isMounted) return;
          setTips(res);
          setErrorTips(null);
        } catch (err: any) {
          if (!isMounted) return;
          const message = err && typeof err === 'object' && 'message' in err ? err.message : String(err);
          if (message.includes("Gemini API key")) {
            setErrorTips("API_KEY_MISSING");
          } else {
            console.warn("Failed to load tips:", err);
            setErrorTips(message || "Failed to load tips");
          }
        } finally {
          if (isMounted) setLoadingTips(false);
        }
      };
      fetchTips().catch(console.warn);
    }
    return () => { isMounted = false; };
  }, [scoreResult, isScanning, tips.length]);

  const isApiKeyError = errorTips === "API_KEY_MISSING" || errorTips?.includes("API key missing") || errorTips?.includes("API key");

  const getScoreColor = (score: number) => {
     if (score >= 80) return '#2ED573'; // Neon Green
     if (score >= 50) return '#F5A623'; // Amber
     return '#FF4757'; // Electric Red
  };
  const scoreColor = getScoreColor(scoreResult.total);

  if (isScanning) {
    return (
      <div className="flex flex-col items-center justify-center h-full bg-black fixed inset-0 z-[100]">
        <div className="relative w-56 h-56">
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 3, ease: "linear" }}
            className="absolute inset-0 border-r-2 border-primary rounded-full blur-[1px]"
          />
          <motion.div 
            animate={{ rotate: -360 }}
            transition={{ repeat: Infinity, duration: 6, ease: "linear" }}
            className="absolute inset-4 border-l border-white/20 rounded-full"
          />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <Cpu className="text-primary mb-3 animate-pulse" size={48} />
            <motion.div
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ repeat: Infinity, duration: 1.5 }}
              className="flex flex-col items-center"
            >
              <p className="text-[10px] font-mono tracking-[0.4em] uppercase text-primary-light font-black">Decrypting Health</p>
              <div className="mt-2 flex gap-1">
                 <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                 <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '200ms' }} />
                 <div className="w-1 h-1 bg-primary rounded-full animate-bounce" style={{ animationDelay: '400ms' }} />
              </div>
            </motion.div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background pt-safe overflow-y-auto no-scrollbar relative min-h-screen">
      {/* Dynamic Atmospheric Grids */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute inset-0 opacity-[0.05]" 
          style={{ 
            backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)', 
            backgroundSize: '30px 30px' 
          }} 
        />
        {/* Neon Scanline */}
        <motion.div 
          animate={{ y: ['-100%', '200%'] }}
          transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
          className="absolute left-0 right-0 h-px bg-primary/20 shadow-[0_0_15px_rgba(108,99,255,0.5)] z-10"
        />
        <div className="absolute top-0 left-0 right-0 h-[600px] bg-gradient-radial from-primary/10 via-transparent to-transparent blur-3xl opacity-60"></div>
        <div className="absolute bottom-0 right-0 w-[400px] h-[400px] bg-primary/5 blur-[120px]" />
      </div>

      {/* Header */}
      <header className="px-6 py-6 flex items-center justify-between sticky top-0 bg-background/60 backdrop-blur-3xl z-40 border-b border-white/5">
        <div className="flex items-center gap-4">
           <button onClick={() => window.history.back()} className="w-10 h-10 rounded-2xl glass flex items-center justify-center active:scale-90 transition-transform">
             <ChevronLeft size={20} />
           </button>
           <div className="flex flex-col">
              <h2 className="text-[10px] uppercase tracking-[0.4em] font-black text-primary-light/60 leading-none mb-1">Status Protocol</h2>
              <h1 className="text-lg font-black text-white leading-none">Financial Core</h1>
           </div>
        </div>
        <button 
          onClick={() => setIsAnatomyVisible(!isAnatomyVisible)}
          className={clsx("w-10 h-10 rounded-2xl flex items-center justify-center transition-all", isAnatomyVisible ? "bg-primary text-white shadow-[0_0_20px_rgba(108,99,255,0.4)]" : "glass text-gray-400")}
        >
           <Activity size={18} />
        </button>
      </header>


      {/* Hero Visual: Orbital Plasma Core */}
      <div className="flex flex-col items-center justify-center flex-grow relative z-10 overflow-hidden">
         <div className="relative w-56 h-56 md:w-64 md:h-64 flex items-center justify-center">
            {/* Outer Decorative Rings */}
            <motion.div 
               animate={{ rotate: 360 }}
               transition={{ repeat: Infinity, duration: 30, ease: "linear" }}
               className="absolute inset-0 border-2 border-primary/10 rounded-full"
               style={{ borderStyle: 'double' }}
            />
            <motion.div 
               animate={{ rotate: -360 }}
               transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
               className="absolute inset-4 border border-white/[0.05] rounded-full"
            />
            
            {/* Pulsing Energy Aura */}
            <motion.div 
               animate={{ scale: [1, 1.1, 1] }}
               transition={{ repeat: Infinity, duration: 4, ease: "easeInOut" }}
               className="absolute inset-6 rounded-full"
               style={{ background: `radial-gradient(circle, ${scoreColor} 0%, transparent 70%)` }}
            />

            {/* Main Score Orbital */}
            <svg width="256" height="256" className="absolute rotate-[-90deg] drop-shadow-[0_0_15px_rgba(var(--primary-rgb),0.3)]">
               <defs>
                 <linearGradient id="orbitGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor={scoreColor} stopOpacity="0.2" />
                    <stop offset="50%" stopColor={scoreColor} stopOpacity="0.8" />
                    <stop offset="100%" stopColor={scoreColor} />
                 </linearGradient>
                 <filter id="scoreGlow" x="-20%" y="-20%" width="140%" height="140%">
                   <feGaussianBlur stdDeviation="6" result="blur" />
                   <feComposite in="SourceGraphic" in2="blur" operator="over" />
                 </filter>
               </defs>
               <circle cx="128" cy="128" r="112" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
               <motion.circle 
                  cx="128" cy="128" r="110" 
                  fill="none" 
                  stroke="url(#orbitGrad)" 
                  strokeWidth="8" 
                  strokeDasharray="691"
                  strokeLinecap="round"
                  initial={{ strokeDashoffset: 691 }}
                  animate={{ strokeDashoffset: 691 - (691 * (scoreResult.total / 100)) }}
                  transition={{ duration: 1, ease: [0.4, 0, 0.2, 1] }}
                  filter="url(#scoreGlow)"
               />
               {/* Marker at end of progress */}
               <motion.circle
                  cx={128 + 110 * Math.cos((scoreResult.total / 100) * 2 * Math.PI - Math.PI/2)}
                  cy={128 + 110 * Math.sin((scoreResult.total / 100) * 2 * Math.PI - Math.PI/2)}
                  r="5"
                  fill="white"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 2.5 }}
                  className="shadow-lg shadow-white"
               />
            </svg>

            {/* Inner Core Display */}
            <div className="relative z-10 flex flex-col items-center justify-center bg-black/60 backdrop-blur-3xl w-48 h-48 rounded-full border border-white/10 shadow-[inset_0_0_40px_rgba(255,255,255,0.05)]">
               <motion.div 
                 initial={{ scale: 0.8, opacity: 0 }}
                 animate={{ scale: 1, opacity: 1 }}
                 transition={{ delay: 0.5, type: "spring", stiffness: 100 }}
                 className="flex flex-col items-center gap-1"
               >
                 <span className="text-6xl font-display font-black tracking-tighter leading-none" style={{ color: '#2DD4BF', textShadow: `0 0 20px rgba(45, 212, 191, 0.5)` }}>
                    <AnimatedCounter value={scoreResult.total} />
                 </span>
                 <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/50">Financial Health Score</p>
                 <div className="h-[1px] w-12 bg-white/10" />
                 <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1 }}
                    className={clsx("px-4 py-1 rounded-full border text-[10px] font-black uppercase tracking-[0.2em] backdrop-blur-md",
                    scoreResult.grade === 'Excellent' ? "text-success border-success/40 bg-success/10" : 
                    scoreResult.grade === 'Good' ? "text-[#2DD4BF] border-[#2DD4BF]/40 bg-[#2DD4BF]/10" : 
                    scoreResult.grade === 'Fair' ? "text-warning border-warning/40 bg-warning/10" : "text-error border-error/40 bg-error/10"
                  )}>
                    {scoreResult.grade}
                 </motion.div>
               </motion.div>
            </div>

            {/* Floating Data Nodes */}
            {[0, 1, 2, 3].map(i => (
              <motion.div 
                key={i}
                animate={{ rotate: 360 }}
                transition={{ repeat: Infinity, duration: 15 + i * 8, ease: "linear" }}
                className="absolute inset-0 pointer-events-none"
              >
                <div 
                  className="w-1 h-1 rounded-full bg-primary absolute" 
                  style={{ 
                    top: '50%', 
                    left: '0', 
                    transform: `translateY(-50%) translateX(${10 + i * 50}px)`,
                    boxShadow: `0 0 10px ${scoreColor}`
                  }} 
                />
              </motion.div>
            ))}
         </div>

         {/* Meta Readouts */}
         <div className="mt-8 flex gap-4 sm:gap-8">
            <div className="text-center">
               <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mb-1">Velocity</p>
               <p className={clsx("text-xs font-black font-mono", scoreResult.trend >= 0 ? "text-success" : "text-error")}>
                 {scoreResult.trend >= 0 ? '+' : ''}{scoreResult.trend}%
               </p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="text-center">
               <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mb-1">Stability</p>
               <p className="text-xs font-black font-mono text-primary">{scoreResult.breakdown.spendingConsistency}/15</p>
            </div>
            <div className="w-px h-8 bg-white/5" />
            <div className="text-center">
               <p className="text-[9px] font-mono text-white/30 uppercase tracking-[0.2em] mb-1">Integrity</p>
               <p className="text-xs font-black font-mono text-white">HI_VAL</p>
            </div>
         </div>
      </div>

      <div className="px-6 space-y-10 mt-6 relative z-10 pb-20">
         
         {/* Trend Vis - Minimalist Dashboard Style */}
         {historyData.length > 0 && (
           <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
              <div className="flex justify-between items-center mb-5 px-1">
                <div className="flex items-center gap-3">
                  <BarChart2 size={16} className="text-primary-light" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Trend Analysis</h3>
                </div>
                <div className="flex gap-1">
                   {[1, 2, 3].map(i => <div key={i} className="w-3 h-1 bg-primary/20 rounded-full" />)}
                </div>
              </div>
              <div className="glass-card rounded-[2.5rem] p-6 h-48 relative border border-white/5 group overflow-hidden">
                 <div className="absolute top-0 right-0 p-4 opacity-[0.03] group-hover:opacity-10 transition-opacity">
                    <TrendingUp size={80} />
                 </div>
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={historyData}>
                       <defs>
                         <linearGradient id="trendGrad" x1="0" y1="0" x2="0" y2="1">
                           <stop offset="0%" stopColor={scoreColor} stopOpacity={0.3}/>
                           <stop offset="100%" stopColor={scoreColor} stopOpacity={0}/>
                         </linearGradient>
                       </defs>
                       <RechartsTooltip 
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              return (
                                <div className="glass-dark border border-white/10 rounded-2xl p-4 shadow-2xl backdrop-blur-3xl">
                                  <p className="text-[9px] font-black uppercase tracking-[0.3em] text-white/30 mb-1">{payload[0].payload.month}</p>
                                  <p className="text-xl font-display font-black" style={{ color: scoreColor }}>{payload[0].value}</p>
                                </div>
                              );
                            }
                            return null;
                          }}
                       />
                       <YAxis domain={[0, 100]} hide />
                       <Area 
                        type="monotone" 
                        dataKey="score" 
                        stroke={scoreColor} 
                        strokeWidth={4} 
                        fillOpacity={1} 
                        fill="url(#trendGrad)" 
                        animationDuration={1000}
                        dot={{ r: 4, fill: '#fff', strokeWidth: 0, opacity: 0.3 }}
                        activeDot={{ r: 6, fill: '#fff', strokeWidth: 4, stroke: scoreColor }}
                       />
                    </AreaChart>
                 </ResponsiveContainer>
              </div>
           </motion.div>
         )}

         {/* Dynamic Anatomy Breakdown */}
         <AnimatePresence>
          {isAnatomyVisible && (
            <motion.div 
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
               <div className="flex items-center gap-3 mb-6 px-1">
                  <Layers size={16} className="text-primary-light" />
                  <h3 className="text-xs font-black uppercase tracking-[0.2em] text-white/60">Anatomy Readout</h3>
               </div>
               <div className="grid grid-cols-1 gap-4">
                  {[
                    { label: 'Savings Matrix', val: scoreResult.breakdown.savingsRate, max: 30, icon: Target },
                    { label: 'Budget Adherence', val: scoreResult.breakdown.budgetAdherence, max: 25, icon: Wallet },
                    { label: 'Flow Consistency', val: scoreResult.breakdown.spendingConsistency, max: 15, icon: Activity },
                    { label: 'Income Ratio', val: scoreResult.breakdown.incomeExpenseRatio, max: 15, icon: TrendingUp },
                    { label: 'Category Spread', val: scoreResult.breakdown.categoryDiversity, max: 10, icon: BarChart2 },
                  ].map((item, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: idx * 0.08 }}
                      whileTap={{ scale: 0.98 }}
                      className="glass-card rounded-[1.8rem] p-5 flex items-center gap-5 border border-white/5 active:border-primary/40 transition-colors"
                    >
                      <div className="w-12 h-12 rounded-2xl glass flex items-center justify-center shrink-0 border border-white/10 shadow-lg">
                        <item.icon size={18} className="text-primary-light" />
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-center mb-3">
                          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 leading-none">{item.label}</span>
                          <span className="font-mono text-[9px] text-primary/60 font-black">{item.val} / {item.max}</span>
                        </div>
                        <div className="h-1.5 bg-white/5 rounded-full overflow-hidden">
                          <motion.div 
                            initial={{ width: 0 }}
                            animate={{ width: `${(item.val / item.max) * 100}%` }}
                            transition={{ duration: 1.5, ease: "circOut", delay: 0.4 }}
                            className="h-full bg-primary shadow-[0_0_10px_rgba(108,99,255,0.6)]"
                          />
                        </div>
                      </div>
                    </motion.div>
                  ))}
               </div>
            </motion.div>
          )}
         </AnimatePresence>

          {/* Dynamic Anatomy Breakdown finished */}

      </div>
    </div>
  );
}
