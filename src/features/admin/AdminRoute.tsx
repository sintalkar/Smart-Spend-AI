import { useState, useEffect, useMemo, useSyncExternalStore } from 'react';
import { motion } from 'motion/react';
import { useLiveQuery } from 'dexie-react-hooks';
import { BarChart, Bar, ResponsiveContainer, XAxis, Tooltip, PieChart, Pie, Cell } from 'recharts';
import { Shield, ToggleLeft, ToggleRight, Download, Trash2, Smartphone, Terminal, Activity, ChevronLeft, Users, Mail, Clock, Sparkles } from 'lucide-react';
import clsx from 'clsx';
import { useNavigate } from 'react-router-dom';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';
import { db as firestoreDb } from '../../firebase';
import { db } from '../../db';
import { TransactionType } from '../../db/models';
import { adminService, AdminFeatureToggles } from './AdminService';
import { useAuth } from '../../core/auth/AuthProvider';
import { format, subDays, startOfDay } from 'date-fns';
import AdminAITerminal from './AdminAITerminal';

const COLORS = ['#6C63FF', '#00D4AA', '#FF4757', '#F5A623', '#9B51E0', '#2ED573'];

export default function AdminRoute() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && (!user || user.email !== 'v90369@gmail.com')) {
      navigate('/');
    }
  }, [user, loading, navigate]);

  if (loading) return (
    <div className="h-screen w-full flex items-center justify-center bg-background">
      <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
    </div>
  );

  if (!user || user.email !== 'v90369@gmail.com') {
    return null;
  }

  return <AdminDashboardScreen />;
}

function AdminDashboardScreen() {
  const navigate = useNavigate();
  const [toggles, setToggles] = useState<AdminFeatureToggles>(adminService.getToggles());
  const [authUsers, setAuthUsers] = useState<any[]>([]);

  useEffect(() => {
    // Subscriber to live firestore users
    const q = query(collection(firestoreDb, 'users'), orderBy('lastLogin', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const users = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setAuthUsers(users);
    }, (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, 'users');
      } catch (e) {
        console.error("[AdminRoute] Error in onSnapshot:", e);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    return adminService.subscribe(() => {
      setToggles(adminService.getToggles());
    });
  }, []);

  const handleToggle = (key: keyof AdminFeatureToggles) => {
    adminService.setToggle(key, !toggles[key]);
  };

  // --- Data Queries ---
  const allTxs = useLiveQuery(() => db.transactions.toArray()) || [];
  const events = useLiveQuery(() => db.adminEvents.orderBy('createdAt').reverse().limit(20).toArray()) || [];
  const categories = useLiveQuery(() => db.categories.toArray()) || [];

  const { stats, usageChartData, categoryData } = useMemo(() => {
    const today = startOfDay(new Date());

    let txToday = 0;
    let smsToday = 0;
    let fallbackToday = 0;
    let voiceToday = 0;
    let receiptToday = 0;
    
    // Category Distribution (All-time Expenses)
    const catMap: Record<string, number> = {};
    const catNameMap = categories.reduce((acc, c) => ({ ...acc, [c.id]: c.name }), {} as Record<string, string>);

    allTxs.forEach(t => {
      if (t.createdAt >= today.getTime()) {
        txToday++;
        if (t.source === 'sms') smsToday++;
        if (t.source === 'voice') voiceToday++;
        if (t.source === 'receipt') receiptToday++;
      }
      if (t.type === TransactionType.DEBIT) {
        catMap[t.categoryId] = (catMap[t.categoryId] || 0) + t.amount;
      }
    });

    // We can't strictly get fallback today from TXs easily unless we recorded it. We check admin events instead.
    events.forEach(e => {
       if (e.eventType === 'AI_FALLBACK_USED' && e.createdAt >= today.getTime()) fallbackToday++;
    });

    // Bar Chart: 7-day Breakdown
    const last7Days = Array.from({length: 7}).map((_, i) => subDays(today, 6 - i));
    const groupedTxs = allTxs.reduce((acc, t) => {
      const d = format(new Date(t.createdAt), 'yyyy-MM-dd');
      if (!acc[d]) acc[d] = { sms: 0, manual: 0, voice: 0, receipt: 0 };
      if (t.source === 'sms') acc[d].sms++;
      else if (t.source === 'manual') acc[d].manual++;
      else if (t.source === 'voice') acc[d].voice++;
      else if (t.source === 'receipt') acc[d].receipt++;
      return acc;
    }, {} as Record<string, any>);

    const usageData = last7Days.map(d => {
      const dateStr = format(d, 'yyyy-MM-dd');
      const g = groupedTxs[dateStr] || { sms: 0, manual: 0, voice: 0, receipt: 0 };
      return {
        date: format(d, 'EEE'),
        ...g
      };
    });

    const pieData = Object.keys(catMap).map((k, i) => ({
      name: catNameMap[k] || k,
      value: catMap[k],
      color: COLORS[i % COLORS.length]
    })).sort((a,b) => b.value - a.value).slice(0, 5);

    return {
      stats: {
        total: allTxs.length,
        txToday,
        smsToday,
        fallbackToday,
        voiceToday,
        receiptToday
      },
      usageChartData: usageData,
      categoryData: pieData
    };
  }, [allTxs, events, categories]);

  const handleClearLog = () => {
    db.adminEvents.clear();
  };

  const exportData = async () => {
     try {
       const txs = await db.transactions.toArray();
       
       // 1. Convert to CSV
       const headers = ['id', 'amount', 'type', 'categoryId', 'source', 'dateTime', 'isDeleted'];
       let csvContent = headers.join(',') + '\n';
       txs.forEach(t => {
         const row = [t.id, t.amount, t.type, t.categoryId, t.source, t.dateTime, t.isDeleted];
         csvContent += row.join(',') + '\n';
       });

       // 2. Export using Blob for better compatibility
       const csvBlob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });
       const dataUrl = URL.createObjectURL(csvBlob);
       const dlAnchorElem = document.createElement('a');
       dlAnchorElem.setAttribute("href", dataUrl);
       dlAnchorElem.setAttribute("download", `smartspend_secure_export_${new Date().getTime()}.csv`);
       dlAnchorElem.click();
       setTimeout(() => URL.revokeObjectURL(dataUrl), 100);
     } catch (err) {
       console.error("Export failed:", err);
       alert("Export failed. Please check logs.");
     }
  };

  const handleFactoryReset = () => {
    const code = Math.floor(1000 + Math.random() * 9000).toString();
    const input = window.prompt(`DANGER: Factory reset will delete ALL data.\nType ${code} to confirm:`);
    if (input === code) {
      adminService.factoryResetApp();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background pt-safe pb-32 overflow-y-auto w-full max-w-7xl mx-auto">
       <header className="px-6 py-4 flex items-center gap-4 sticky top-0 bg-background/90 backdrop-blur-md z-30 border-b border-white/5">
          <button onClick={() => navigate('/')} className="w-10 h-10 rounded-full bg-surface flex items-center justify-center text-gray-400 hover:text-white transition-colors">
            <ChevronLeft size={20} />
          </button>
          <div className="flex-1">
             <h2 className="title-bold text-lg flex items-center gap-2">
               <Shield size={18} className="text-primary" /> Admin Control
             </h2>
          </div>
       </header>

       <div className="px-6 py-6 space-y-8">
          
          {/* Smart Spend Admin AI Controller */}
          <section>
             <h3 className="text-sm font-semibold uppercase tracking-widest text-primary mb-4 flex items-center gap-2">
               <Sparkles size={16} /> AI Command Center
             </h3>
             <AdminAITerminal />
          </section>

          {/* Stats Grid */}
          <section>
             <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Live Metrics</h3>
             <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { label: "Total Trx", val: stats.total, color: "text-white" },
                  { label: "Trx Today", val: stats.txToday, color: "text-primary" },
                  { label: "SMS Parsed (Today)", val: stats.smsToday, color: "text-success" },
                  { label: "AI Fallbacks (Today)", val: stats.fallbackToday, color: "text-yellow-500" },
                  { label: "Voice (Today)", val: stats.voiceToday, color: "text-[#9B51E0]" },
                  { label: "Receipts (Today)", val: stats.receiptToday, color: "text-[#FF4757]" },
                ].map((s, i) => (
                  <div key={i} className="bg-surface rounded-2xl p-4 border border-white/5">
                     <p className="text-xs font-semibold text-gray-400 mb-1 line-clamp-1">{s.label}</p>
                     <p className={clsx("text-2xl font-mono font-bold", s.color)}>{s.val}</p>
                  </div>
                ))}
             </div>
          </section>

          {/* Feature Toggles */}
          <section>
             <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Feature Rollout</h3>
             <div className="bg-surface rounded-3xl border border-white/5 divide-y divide-white/5">
                {[
                  { key: 'smsDetection', label: 'SMS Detection Engine', desc: 'Scan local SMS for transactions' },
                  { key: 'aiParsing', label: 'AI Structured Parsing', desc: 'Use Gemini for complex messages' },
                  { key: 'receiptScanner', label: 'Receipt Scanner', desc: 'Allow camera uploads' },
                  { key: 'voiceEntry', label: 'Voice Entry', desc: 'Audio recording feature' },
                  { key: 'analyticsCollection', label: 'Local Analytics', desc: 'Log anonymous usage events' },
                ].map((f, i) => {
                  const isOn = toggles[f.key as keyof AdminFeatureToggles];
                  return (
                    <div key={i} className="flex items-center gap-4 p-5">
                       <div className="flex-1">
                          <p className="font-semibold text-white">{f.label}</p>
                          <p className="text-xs text-gray-400">{f.desc}</p>
                       </div>
                       <button onClick={() => handleToggle(f.key as any)} className="active:scale-95 transition-transform">
                          {isOn ? (
                             <ToggleRight size={32} className="text-primary" />
                          ) : (
                             <ToggleLeft size={32} className="text-gray-600" />
                          )}
                       </button>
                    </div>
                  );
                })}
             </div>
          </section>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Usage Chart */}
            <section>
               <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Source Volume (7d)</h3>
               <div className="bg-surface rounded-3xl p-5 h-64 border border-white/5">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={usageChartData} margin={{top:10, right:10, left:0, bottom:0}}>
                       <XAxis dataKey="date" tick={{fill: '#666', fontSize: 12}} axisLine={false} tickLine={false} />
                       <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{backgroundColor: '#1C2333', border: 'none', borderRadius: '12px'}} />
                       <Bar dataKey="sms" stackId="a" fill="#00D4AA" radius={[0,0,4,4]} />
                       <Bar dataKey="manual" stackId="a" fill="#6C63FF" />
                       <Bar dataKey="voice" stackId="a" fill="#9B51E0" />
                       <Bar dataKey="receipt" stackId="a" fill="#FF4757" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
               </div>
            </section>

            {/* Category Donut */}
            <section>
               <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Volume by Category (Top 5)</h3>
               <div className="bg-surface rounded-3xl p-5 border border-white/5 flex flex-col items-center justify-center relative min-h-[256px]">
                  {categoryData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={240}>
                      <PieChart>
                         <Pie data={categoryData} cx="50%" cy="50%" innerRadius="60%" outerRadius="80%" paddingAngle={2} dataKey="value" stroke="none">
                            {categoryData.map((e,i) => <Cell key={i} fill={e.color} />)}
                         </Pie>
                         <Tooltip formatter={(val: number) => `₹${val.toFixed(0)}`} contentStyle={{backgroundColor: '#1C2333', border: 'none', borderRadius: '8px'}} />
                      </PieChart>
                    </ResponsiveContainer>
                  ) : <p className="text-gray-500 text-sm">No data available.</p>}
               </div>
            </section>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Event Log */}
            <section>
               <div className="flex justify-between items-center mb-4">
                 <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500">Event Stream (Recent 20)</h3>
                 <button onClick={handleClearLog} className="text-xs font-semibold text-primary">Clear</button>
               </div>
               <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
                 <div className="max-h-64 overflow-y-auto no-scrollbar p-2">
                    {events.length === 0 && <p className="p-4 flex items-center gap-2 text-gray-500 text-sm"><Activity size={16}/> No recent events.</p>}
                    {events.map((e) => (
                      <div key={e.id} className="p-3 bg-white/5 rounded-xl mb-2 flex items-center justify-between">
                         <div className="flex items-center gap-3">
                           <div className="w-2 h-2 rounded-full bg-primary" />
                           <div>
                             <p className="text-sm font-medium text-white">{e.eventType}</p>
                             <p className="text-[10px] text-gray-400 font-mono">{e.deviceId?.slice(0, 8)}... • {new Date(e.createdAt).toLocaleTimeString()}</p>
                           </div>
                         </div>
                      </div>
                    ))}
                 </div>
               </div>
            </section>

            {/* Auth Users */}
            <section>
               <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">Authenticated Users</h3>
               <div className="bg-surface rounded-3xl border border-white/5 overflow-hidden">
                 <div className="max-h-64 overflow-y-auto no-scrollbar p-2">
                    {authUsers.length === 0 && <p className="p-4 flex items-center gap-2 text-gray-500 text-sm"><Users size={16}/> No users logged in yet.</p>}
                    {authUsers.map((u) => (
                      <div key={u.id} className="p-4 bg-white/5 rounded-xl mb-2 flex items-center gap-4 transition-all hover:bg-white/10">
                         {u.photoURL ? (
                           <img src={u.photoURL} alt={u.displayName} className="w-10 h-10 rounded-full border border-white/10" />
                         ) : (
                           <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold">
                             {u.email?.[0].toUpperCase() || 'U'}
                           </div>
                         )}
                         <div className="flex-1 min-w-0">
                           <p className="text-sm font-semibold text-white truncate">{u.displayName || 'Anonymous User'}</p>
                           <div className="flex items-center gap-3 mt-1">
                             <span className="flex items-center gap-1 text-[10px] text-gray-400 truncate">
                               <Mail size={10} /> {u.email}
                             </span>
                             <span className="flex items-center gap-1 text-[10px] text-gray-400 shrink-0">
                               <Clock size={10} /> {u.lastLogin?.toDate ? format(u.lastLogin.toDate(), 'HH:mm') : 'Just now'}
                             </span>
                           </div>
                         </div>
                      </div>
                    ))}
                 </div>
               </div>
            </section>

            {/* App Info */}
            <section>
               <h3 className="text-sm font-semibold uppercase tracking-widest text-gray-500 mb-4">System Actions</h3>
               <div className="bg-surface rounded-3xl border border-white/5 p-2 space-y-2">
                  <div className="p-4 flex items-center justify-between">
                     <div className="flex items-center gap-3">
                        <Smartphone className="text-gray-400" size={20} />
                        <div>
                          <p className="font-semibold text-white">App Version</p>
                          <p className="text-xs text-gray-400">1.0.0-beta</p>
                        </div>
                     </div>
                  </div>
                  <div className="p-4 flex items-center justify-between hover:bg-white/5 rounded-2xl transition-colors text-left group">
                     <div className="flex items-center gap-3">
                        <Terminal className="text-primary group-hover:text-primary/80" size={20} />
                        <div>
                          <p className="font-semibold text-white">Cache & Storage</p>
                          <p className="text-xs text-gray-400">Local DB: ~{(JSON.stringify(allTxs).length / 1024).toFixed(1)} KB</p>
                        </div>
                     </div>
                     <button onClick={() => { localStorage.removeItem('admin_feature_toggles'); alert('Cache cleared'); }} className="px-3 py-1 bg-white/5 hover:bg-white/10 rounded-full text-xs font-semibold text-white">
                        Clear Cache
                     </button>
                  </div>
                  <button onClick={exportData} className="w-full p-4 flex items-center justify-between hover:bg-white/5 rounded-2xl transition-colors text-left group">
                     <div className="flex items-center gap-3">
                        <Download className="text-success group-hover:text-success/80" size={20} />
                        <div>
                          <p className="font-semibold text-white">Export Local Data</p>
                          <p className="text-xs text-gray-400">Download JSON dump</p>
                        </div>
                     </div>
                  </button>
                  <button onClick={handleFactoryReset} className="w-full p-4 flex items-center justify-between hover:bg-error/10 bg-error/5 rounded-2xl transition-colors text-left group">
                     <div className="flex items-center gap-3">
                        <Trash2 className="text-error" size={20} />
                        <div>
                          <p className="font-semibold text-error">Factory Reset</p>
                          <p className="text-xs text-error/60">Wipe all DB & localStorage</p>
                        </div>
                     </div>
                  </button>
               </div>
            </section>
          </div>

       </div>
    </div>
  );
}
