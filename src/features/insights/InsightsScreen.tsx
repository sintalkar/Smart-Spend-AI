import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { PieChart, Pie, Cell, ResponsiveContainer, AreaChart, Area, XAxis, Tooltip as RechartsTooltip, ReferenceLine } from 'recharts';
import { Sparkles, TrendingUp, TrendingDown, ChevronLeft, ChevronRight, Activity, Smile, AlertTriangle, Lightbulb, Coffee, Car, ShoppingBag, ArrowUpRight, ArrowDownRight, RefreshCw, Download, Target, Coins, ShieldAlert, Award } from 'lucide-react';
import clsx from 'clsx';
import { db } from '../../db';
import { TransactionType } from '../../db/models';
import { insightsService, InsightsData } from './GeminiInsightsService';
import { format, subMonths, isSameMonth, parseISO, startOfMonth, endOfMonth, eachDayOfInterval, isWeekend, isSameYear, subYears } from 'date-fns';

const COLORS = ['#6C63FF', '#00D4AA', '#FF4757', '#F5A623', '#9B51E0', '#2ED573'];
const categoryIcons: Record<string, any> = {
  'food_dining': Coffee,
  'transportation': Car,
  'shopping': ShoppingBag,
  'other': Activity
};
const categoryNames: Record<string, string> = {
  'food_dining': 'Dining & Food',
  'transportation': 'Transport',
  'shopping': 'Shopping',
  'other': 'Other'
};

const emojiMap: Record<string, any> = {
  'smile': Smile,
  'alert': AlertTriangle,
  'idea': Lightbulb,
  'coffee': Coffee,
};

function TypewriterText({ text }: { text: string }) {
  const [displayed, setDisplayed] = useState('');
  useEffect(() => {
    setDisplayed('');
    let i = 0;
    const interval = setInterval(() => {
      setDisplayed(text.slice(0, i));
      i++;
      if (i > text.length) clearInterval(interval);
    }, 20); // ms per char
    return () => clearInterval(interval);
  }, [text]);
  return <span>{displayed}</span>;
}

export default function InsightsScreen() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [periodStr, setPeriodStr] = useState<'Monthly' | 'Yearly'>('Monthly');
  
  const [insights, setInsights] = useState<InsightsData | null>(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [errorInsights, setErrorInsights] = useState(false);

  const isYearly = periodStr === 'Yearly';
  const prevDate = isYearly ? subYears(currentDate, 1) : subMonths(currentDate, 1);
  
  const currentPeriodTx = useLiveQuery(
    () => db.transactions.toArray().then(arr => arr.filter(t => {
      if (t.isDeleted !== 0) return false;
      try {
        return isYearly 
          ? isSameYear(new Date(t.dateTime), currentDate)
          : isSameMonth(new Date(t.dateTime), currentDate);
      } catch (e) {
        return false;
      }
    })).catch(err => {
      console.error("Failed to load current period transactions:", err);
      return [];
    })
  , [currentDate, isYearly]) || [];
  
  const prevPeriodTx = useLiveQuery(
    () => db.transactions.toArray().then(arr => arr.filter(t => {
      if (t.isDeleted !== 0) return false;
      try {
        return isYearly
          ? isSameYear(new Date(t.dateTime), prevDate)
          : isSameMonth(new Date(t.dateTime), prevDate);
      } catch (e) {
        return false;
      }
    })).catch(err => {
      console.error("Failed to load prev period transactions:", err);
      return [];
    })
  , [currentDate, isYearly, prevDate]) || [];

  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];

  // Data Aggregation
  const { totalSpent, income, categoryBreakdown, chartData, categoryTrends } = useMemo(() => {
    let tSpent = 0;
    let inc = 0;
    const catBreakdown: Record<string, number> = {};
    const dailyMap: Record<string, number> = {};
    const monthlyMap: Record<string, number> = {};
    
    currentPeriodTx.forEach(t => {
       if (t.type === TransactionType.DEBIT) {
         tSpent += t.amount;
         catBreakdown[t.categoryId] = (catBreakdown[t.categoryId] || 0) + t.amount;
         
         const date = new Date(t.dateTime);
         const dayKey = format(date, 'yyyy-MM-dd');
         dailyMap[dayKey] = (dailyMap[dayKey] || 0) + t.amount;
         
         const monthKey = format(date, 'MMM');
         monthlyMap[monthKey] = (monthlyMap[monthKey] || 0) + t.amount;
       } else {
         inc += t.amount;
       }
    });

    const prevCatBreakdown: Record<string, number> = {};
    prevPeriodTx.forEach(t => {
       if (t.type === TransactionType.DEBIT) {
         prevCatBreakdown[t.categoryId] = (prevCatBreakdown[t.categoryId] || 0) + t.amount;
       }
    });

    // Chart data mapping
    let cData: any[] = [];
    if (isYearly) {
       const months = Array.from({length: 12}).map((_, i) => format(new Date(currentDate.getFullYear(), i, 1), 'MMM'));
       cData = months.map(m => ({
          date: m,
          amount: monthlyMap[m] || 0
       }));
    } else {
      const days = eachDayOfInterval({ 
        start: startOfMonth(currentDate), 
        end: isSameMonth(currentDate, new Date()) ? new Date() : endOfMonth(currentDate) 
      });
      cData = days.map(d => {
        const k = format(d, 'yyyy-MM-dd');
        return {
          date: format(d, 'dd MMM'),
          amount: dailyMap[k] || 0,
          isWeekend: isWeekend(d)
        };
      });
    }

    // Trends
    const trends = Object.keys(catBreakdown).map(catId => {
      const curr = catBreakdown[catId];
      const prev = prevCatBreakdown[catId] || 0;
      const change = prev === 0 ? 100 : ((curr - prev) / prev) * 100;
      return {
        categoryId: catId,
        amount: curr,
        change
      };
    }).sort((a, b) => b.amount - a.amount);

    return { totalSpent: tSpent, income: inc, categoryBreakdown: catBreakdown, chartData: cData, categoryTrends: trends };
  }, [currentPeriodTx, prevPeriodTx, currentDate, isYearly]);

  const handleExportCSV = () => {
    const headers = ['Date', 'Amount', 'Type', 'Category', 'Note', 'Merchant'];
    let csv = headers.join(',') + '\n';
    
    currentPeriodTx.sort((a, b) => b.dateTime - a.dateTime).forEach(t => {
      const row = [
        format(new Date(t.dateTime), 'yyyy-MM-dd HH:mm'),
        t.amount,
        t.type,
        categoryNames[t.categoryId] || t.categoryId,
        `"${(t.note || '').replace(/"/g, '""')}"`,
        `"${(t.merchantName || '').replace(/"/g, '""')}"`
      ];
      csv += row.join(',') + '\n';
    });

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `SmartSpend_Report_${isYearly ? currentDate.getFullYear() : format(currentDate, 'MMM_yyyy')}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const fetchInsights = async () => {
    if (totalSpent === 0 && income === 0) return; // No data
    setLoadingInsights(true);
    setErrorInsights(false);
    try {
      const globalBudget = budgets.find(b => b.categoryId === 'global')?.amount || 10000;
      const categoryBudgets: Record<string, number> = {};
      budgets.forEach(b => {
        if (b.categoryId && b.categoryId !== 'global') {
          categoryBudgets[b.categoryId] = b.amount;
        }
      });

      const data = await insightsService.generateInsights(
        isYearly ? currentDate.getFullYear().toString() : format(currentDate, 'MMMM yyyy'),
        totalSpent,
        income,
        categoryBreakdown,
        {}, // previousPeriodBreakdown
        globalBudget,
        categoryBudgets
      );
      if (data) setInsights(data);
      else setErrorInsights(true);
    } catch (e) {
      setErrorInsights(true);
    } finally {
      setLoadingInsights(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [currentDate, totalSpent, income, budgets]); // Refetch if major data or budgets change

  // Format data for Donut
  const pieData = Object.keys(categoryBreakdown).map((k, i) => ({
    name: categoryNames[k] || k,
    value: categoryBreakdown[k],
    color: COLORS[i % COLORS.length],
    categoryId: k
  }));

  const avgDaily = totalSpent / (chartData.length || 1);

  return (
    <div className="flex flex-col h-full bg-background pt-safe overflow-y-auto no-scrollbar pb-32">
       {/* Header Tabs */}
       <header className="px-6 py-4 flex flex-col items-center sticky top-0 bg-background/90 backdrop-blur-md z-30">
          <div className="flex bg-surface p-1 rounded-full mb-4">
             {['Monthly', 'Yearly'].map(tab => (
               <button 
                 key={tab}
                 onClick={() => setPeriodStr(tab as any)}
                 className={clsx(
                   "px-6 py-2 rounded-full text-sm font-medium transition-colors relative z-10",
                   periodStr === tab ? "text-white" : "text-gray-500"
                 )}
               >
                 {periodStr === tab && (
                   <motion.div 
                     layoutId="insight-tab"
                     className="absolute inset-0 bg-white/10 rounded-full -z-10"
                   />
                 )}
                 {tab}
               </button>
             ))}
          </div>

          <div className="flex items-center justify-between w-full px-4">
             <button 
                onClick={() => setCurrentDate(isYearly ? subYears(currentDate, 1) : subMonths(currentDate, 1))} 
                className="text-gray-400 p-2 hover:bg-white/5 rounded-full"
             >
                <ChevronLeft size={20}/>
             </button>
             <h2 className="title-bold text-lg">
                {isYearly ? currentDate.getFullYear() : format(currentDate, 'MMMM yyyy')}
             </h2>
             <button 
                onClick={() => {
                  const d = new Date(currentDate);
                  if (isYearly) d.setFullYear(d.getFullYear() + 1);
                  else d.setMonth(d.getMonth() + 1);
                  setCurrentDate(d);
                }} 
                className="text-gray-400 p-2 hover:bg-white/5 rounded-full"
             >
                <ChevronRight size={20}/>
             </button>
          </div>
       </header>

       <div className="px-6 space-y-8 mt-4">
          {/* Download Report Button */}
          <div className="flex justify-end">
             <button 
               onClick={handleExportCSV}
               className="flex items-center gap-2 px-4 py-2 bg-surface/50 border border-white/5 rounded-2xl text-xs font-bold text-primary group active:scale-95 transition-all"
             >
               <Download size={14} className="group-hover:translate-y-0.5 transition-transform" />
               Download {isYearly ? 'Yearly' : 'Monthly'} Report
             </button>
          </div>
          
           {/* Budget Alert Banner */}
           {insights && insights.alert && (
             <motion.div 
               initial={{ opacity: 0, scale: 0.95 }} 
               animate={{ opacity: 1, scale: 1 }}
               className="relative overflow-hidden border border-error/20 bg-error/10 rounded-3xl p-5 shadow-lg flex gap-4"
             >
               <div className="absolute top-0 right-0 w-24 h-24 bg-error/10 blur-2xl rounded-full" />
               <div className="w-12 h-12 rounded-2xl bg-error/20 flex items-center justify-center text-error shrink-0 self-center">
                 <ShieldAlert size={24} className="animate-pulse" />
               </div>
               <div>
                 <h4 className="text-sm font-bold text-white mb-1 uppercase tracking-wider">Urgent Alert</h4>
                 <p className="text-xs text-error-light font-medium leading-relaxed">
                   {insights.alert_message}
                 </p>
               </div>
             </motion.div>
           )}

           {/* Spending Progress Card */}
           {insights && (
             <motion.div 
               initial={{ opacity: 0, y: 15 }} 
               animate={{ opacity: 1, y: 0 }}
               className="glass-card rounded-[2rem] p-6 relative overflow-hidden"
             >
               <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
               
               <div className="flex justify-between items-center mb-4">
                 <div className="flex items-center gap-2">
                   <Target size={16} className="text-primary" />
                   <span className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">Budget Usage</span>
                 </div>
                 <span className={clsx(
                   "text-sm font-mono font-black",
                   insights.spending_percentage >= 80 ? "text-error" :
                   insights.spending_percentage >= 60 ? "text-yellow-500" :
                   "text-success"
                 )}>
                   {insights.spending_percentage}% Used
                 </span>
               </div>

               {/* Modern custom HSL bar */}
               <div className="h-4 bg-white/5 border border-white/5 rounded-full overflow-hidden relative">
                 <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${Math.min(insights.spending_percentage, 100)}%` }}
                   transition={{ duration: 1, ease: "easeOut" }}
                   className={clsx(
                     "h-full rounded-full relative",
                     insights.spending_percentage >= 80 ? "bg-gradient-to-r from-error to-pink-500 shadow-[0_0_12px_rgba(255,71,87,0.4)]" :
                     insights.spending_percentage >= 60 ? "bg-gradient-to-r from-yellow-500 to-orange-400 shadow-[0_0_12px_rgba(245,166,35,0.4)]" :
                     "bg-gradient-to-r from-success to-emerald-400 shadow-[0_0_12px_rgba(46,213,115,0.4)]"
                   )}
                 />
               </div>

               {insights.motivational_message && (
                 <div className="mt-4 flex gap-2 items-center bg-white/5 border border-white/5 rounded-2xl p-3">
                   <Award size={16} className="text-primary shrink-0" />
                   <p className="text-[11px] text-white/70 leading-relaxed font-medium">
                     {insights.motivational_message}
                   </p>
                 </div>
               )}
             </motion.div>
           )}

           {/* Donut Chart Component */}
           {pieData.length > 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
               <h3 className="title-bold text-lg mb-4">Expense Distribution</h3>
               <div className="bg-surface rounded-3xl p-6 flex flex-col items-center relative aspect-square max-h-[300px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={pieData}
                        cx="50%" cy="50%"
                        innerRadius="70%" outerRadius="90%"
                        paddingAngle={5}
                        dataKey="value"
                        stroke="none"
                        isAnimationActive={true}
                      >
                        {pieData.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <RechartsTooltip 
                        formatter={(value: number) => [`₹${value.toFixed(2)}`, 'Spent']}
                        contentStyle={{ backgroundColor: '#1C2333', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                     <p className="text-gray-500 text-xs font-semibold uppercase tracking-widest mb-1">Total</p>
                     <p className="text-2xl font-mono font-bold text-white">₹{totalSpent.toFixed(0)}</p>
                  </div>
               </div>
             </motion.div>
           )}

           {/* AI Top Overspending Analysis */}
           {insights && insights.top_overspending_categories && insights.top_overspending_categories.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, y: 15 }} 
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.15 }}
             >
               <h3 className="title-bold text-lg mb-4">Overspending Hotspots</h3>
               <div className="space-y-3">
                 {insights.top_overspending_categories.map((cat, idx) => (
                   <div key={idx} className="bg-surface border border-white/5 p-4 rounded-3xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-16 h-16 bg-error/5 blur-xl rounded-full" />
                     
                     <div className="flex justify-between items-start mb-2">
                       <div>
                         <h4 className="font-bold text-white text-sm">{cat.category}</h4>
                         <span className="text-[9px] uppercase tracking-wider text-error font-black">
                           ₹{cat.excess.toLocaleString()} excess
                         </span>
                       </div>
                       <div className="text-right">
                         <span className="text-xs font-mono font-bold text-white">₹{cat.amount_spent.toLocaleString()} spent</span>
                         <p className="text-[9px] text-white/30 uppercase font-medium mt-0.5">Limit: ₹{cat.recommended_max.toLocaleString()}</p>
                       </div>
                     </div>

                     <p className="text-[11px] text-white/70 bg-black/20 rounded-xl p-2.5 leading-relaxed font-medium mt-3 border border-white/5">
                       {cat.insight}
                     </p>
                   </div>
                 ))}
               </div>
             </motion.div>
           )}

           {/* Main Chart */}
           {chartData.length > 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }}>
               <h3 className="title-bold text-lg mb-4">{isYearly ? 'Monthly Breakdown' : 'Daily Trend'}</h3>
               <div className="bg-surface rounded-3xl p-4 h-64 border border-white/5">
                 <ResponsiveContainer width="100%" height="100%">
                   <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
                     <defs>
                       <linearGradient id="colorSpent" x1="0" y1="0" x2="0" y2="1">
                         <stop offset="5%" stopColor="#6C63FF" stopOpacity={0.4}/>
                         <stop offset="95%" stopColor="#6C63FF" stopOpacity={0}/>
                       </linearGradient>
                     </defs>
                     <XAxis dataKey="date" tick={{fill: '#666', fontSize: 10}} axisLine={false} tickLine={false} />
                     <RechartsTooltip 
                       formatter={(val: number) => [`₹${val.toFixed(2)}`, 'Spent']}
                       contentStyle={{ backgroundColor: '#1C2333', border: 'none', borderRadius: '12px', fontSize: '12px' }}
                       itemStyle={{ color: '#fff' }}
                       labelStyle={{ color: '#aaa', marginBottom: '4px' }}
                     />
                     {!isYearly && <ReferenceLine y={avgDaily} stroke="#ffffff" strokeOpacity={0.2} strokeDasharray="3 3" />}
                     <Area type="monotone" dataKey="amount" stroke="#6C63FF" strokeWidth={3} fillOpacity={1} fill="url(#colorSpent)" />
                   </AreaChart>
                 </ResponsiveContainer>
               </div>
             </motion.div>
           )}

           {/* Smart Savings Suggestions Carousel */}
           {insights && insights.savings_suggestions && insights.savings_suggestions.length > 0 && (
             <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
               <h3 className="title-bold text-lg mb-4">Recommended Cuts</h3>
               <div className="flex overflow-x-auto no-scrollbar gap-4 -mx-6 px-6 pb-4">
                  {insights.savings_suggestions.map((sug, i) => (
                    <div key={i} className="min-w-[260px] max-w-[280px] bg-primary/10 border border-primary/20 rounded-3xl p-5 flex-shrink-0 relative overflow-hidden group">
                      <div className="absolute top-0 right-0 w-24 h-24 blur-3xl opacity-40 rounded-full bg-success/20"></div>
                      
                      <div className="flex items-start gap-4 relative z-10 mb-4">
                         <div className="text-3xl">💡</div>
                         <div>
                           <h4 className="font-bold text-white mb-1 line-clamp-1">{sug.title}</h4>
                           <span className="text-[9px] uppercase tracking-widest font-black text-success">
                              Actionable Cut
                           </span>
                         </div>
                      </div>
                      <p className="text-xs text-gray-300 leading-relaxed mb-4 line-clamp-3 font-medium min-h-[48px]">
                        {sug.detail}
                      </p>
                      
                      <div className="bg-black/30 rounded-xl p-3 flex justify-between items-center border border-white/5">
                         <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Est. Savings</span>
                         <span className="text-success font-mono font-bold">₹{sug.estimated_monthly_savings}/mo</span>
                      </div>
                    </div>
                  ))}
               </div>
             </motion.div>
           )}

           {/* Tailored Investment suggestions */}
           {insights && insights.investment_suggestions && insights.investment_suggestions.length > 0 && (
             <motion.div 
               initial={{ opacity: 0, y: 15 }} 
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.35 }}
             >
               <h3 className="title-bold text-lg mb-4">Tailored Investment Hub</h3>
               <div className="space-y-3">
                 {insights.investment_suggestions.map((inv, idx) => (
                   <div key={idx} className="bg-surface/50 border border-primary/20 p-5 rounded-3xl relative overflow-hidden group">
                     <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-2xl rounded-full" />
                     
                     <div className="flex justify-between items-start gap-2 mb-3">
                       <div className="flex items-center gap-3">
                         <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary shadow-lg">
                           <Coins size={18} />
                         </div>
                         <div>
                           <h4 className="font-bold text-white text-sm">{inv.title}</h4>
                           <p className="text-[9px] text-white/30 uppercase tracking-widest font-black mt-0.5">Platform: {inv.platform}</p>
                         </div>
                       </div>
                       <div className="text-right">
                         <span className="text-xs font-mono font-black text-white">₹{inv.amount.toLocaleString()}/mo</span>
                         <p className="text-[9px] text-success uppercase font-bold mt-0.5">{inv.expected_return}</p>
                       </div>
                     </div>

                     <p className="text-xs text-gray-400 leading-relaxed font-medium mt-2 bg-black/25 rounded-2xl p-3 border border-white/5">
                       {inv.detail}
                     </p>
                   </div>
                 ))}
               </div>
             </motion.div>
           )}

        </div>
     </div>
  );
}
