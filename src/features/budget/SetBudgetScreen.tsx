import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Target, Save, AlertCircle, ShoppingBag, Coffee, Car, Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { db } from '../../db';
import { BudgetPeriod } from '../../db/models';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';

import { db as firestoreDb } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../../core/auth/AuthProvider';
import { handleFirestoreError, OperationType } from '../../lib/firestoreUtils';

const CATEGORIES = [
  { id: 'food_dining', label: 'Dining', icon: Coffee, color: 'text-orange-400', bg: 'bg-orange-400/10' },
  { id: 'shopping', label: 'Shopping', icon: ShoppingBag, color: 'text-purple-400', bg: 'bg-purple-400/10' },
  { id: 'transportation', label: 'Transport', icon: Car, color: 'text-blue-400', bg: 'bg-blue-400/10' },
  { id: 'entertainment', label: 'Entertainment', icon: Activity, color: 'text-pink-400', bg: 'bg-pink-400/10' },
  { id: 'bills_utilities', label: 'Bills', icon: Activity, color: 'text-yellow-400', bg: 'bg-yellow-400/10' },
  { id: 'other', label: 'Other', icon: Activity, color: 'text-gray-400', bg: 'bg-gray-400/10' },
];

export default function SetBudgetScreen() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [globalAmount, setGlobalAmount] = useState('');
  const [categoryBudgets, setCategoryBudgets] = useState<Record<string, string>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'global' | 'categories'>('global');
  
  // Storing snapshots of initial budgets to show as "Previous"
  const [initialGlobal, setInitialGlobal] = useState<number | null>(null);
  const [initialCategoryMap, setInitialCategoryMap] = useState<Record<string, number>>({});
  const [isDataLoaded, setIsDataLoaded] = useState(false);
  
  // Fetch existing budgets
  const budgets = useLiveQuery(() => db.budgets.toArray()) || [];
  const budgetHistory = useLiveQuery(() => db.budgetHistory.orderBy('changedAt').reverse().limit(10).toArray()) || [];

  useEffect(() => {
    if (budgets.length > 0 && !isDataLoaded) {
      const global = budgets.find(b => b.categoryId === 'global');
      if (global) {
        setGlobalAmount(global.amount.toString());
        setInitialGlobal(global.amount);
      }

      const catBudgets: Record<string, string> = {};
      const catMap: Record<string, number> = {};
      budgets.forEach(b => {
        if (b.categoryId && b.categoryId !== 'global') {
          catBudgets[b.categoryId] = b.amount.toString();
          catMap[b.categoryId] = b.amount;
        }
      });
      setCategoryBudgets(catBudgets);
      setInitialCategoryMap(catMap);
      setIsDataLoaded(true);
    }
  }, [budgets, isDataLoaded]);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // 1. Save Global Budget
      const gAmount = parseFloat(globalAmount);
      if (!isNaN(gAmount) && gAmount > 0) {
        const existingGlobal = budgets.find(b => b.categoryId === 'global');
        if (existingGlobal) {
          if (existingGlobal.amount !== gAmount) {
            // Track history
            await db.budgetHistory.add({
              id: uuidv4(),
              categoryId: 'global',
              amount: existingGlobal.amount,
              changedAt: Date.now()
            });
            await db.budgets.update(existingGlobal.id, {
              amount: gAmount
            });
          }
        } else {
          await db.budgets.add({
            id: uuidv4(),
            categoryId: 'global',
            amount: gAmount,
            period: BudgetPeriod.MONTHLY,
            startDate: new Date().setHours(0, 0, 0, 0),
            endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).setHours(23, 59, 59, 999),
            alertThreshold: 0.8,
            isActive: 1
          } as any);
        }
      }

      // 2. Save Category Budgets
      for (const cat of CATEGORIES) {
        const val = categoryBudgets[cat.id];
        const cAmount = val === '' ? 0 : parseFloat(val);
        const existingCat = budgets.find(b => b.categoryId === cat.id);
        
        if (!isNaN(cAmount) && cAmount > 0) {
          if (existingCat) {
            if (existingCat.amount !== cAmount) {
              // Track history
              await db.budgetHistory.add({
                id: uuidv4(),
                categoryId: cat.id,
                amount: existingCat.amount,
                changedAt: Date.now()
              });
              await db.budgets.update(existingCat.id, {
                amount: cAmount
              });
            }
          } else {
            await db.budgets.add({
              id: uuidv4(),
              categoryId: cat.id,
              amount: cAmount,
              period: BudgetPeriod.MONTHLY,
              startDate: new Date().setHours(0, 0, 0, 0),
              endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).setHours(23, 59, 59, 999),
              alertThreshold: 0.8,
              isActive: 1
            } as any);
          }
        } else if (existingCat && (val === '' || cAmount === 0)) {
          await db.budgets.delete(existingCat.id);
        }
      }

      // 3. Sync to Firestore if user is logged in
      if (user) {
        const userDocPath = `users/${user.uid}`;
        try {
          await setDoc(doc(firestoreDb, userDocPath), {
            budgetLimit: parseFloat(globalAmount) || 0,
            categoryBudgets: categoryBudgets,
            updatedAt: Date.now()
          }, { merge: true });
        } catch (fsError) {
          console.error("Firestore sync error:", fsError);
          // Show non-blocking warning but still navigate back
          handleFirestoreError(fsError, OperationType.UPDATE, userDocPath);
        }
      }

      navigate(-1);
    } catch (error: any) {
      console.error("Failed to save budget:", error);
      alert(`Critical error: ${error.message || "Failed to save budget"}`);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-6 pb-32">
      <header className="flex items-center gap-4 mb-8">
        <button 
          onClick={() => navigate(-1)}
          className="w-10 h-10 rounded-xl glass-button flex items-center justify-center text-gray-400"
        >
          <ChevronLeft size={20} />
        </button>
        <h1 className="text-xl font-bold text-white uppercase tracking-[0.2em] text-sm">Budget Settings</h1>
      </header>

      <div className="flex glass p-1 rounded-2xl mb-8">
        {(['global', 'categories'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] transition-all ${
              activeTab === tab ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-white/40 hover:text-white/60'
            }`}
          >
            {tab === 'global' ? 'Global' : 'Categories'}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        <AnimatePresence mode="wait">
          {activeTab === 'global' ? (
            <motion.div 
              key="global"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="glass-card rounded-[2.5rem] p-8 relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
              <div className="flex items-center gap-4 mb-6 relative z-10">
                <div className="w-12 h-12 rounded-2xl bg-primary/20 flex items-center justify-center text-primary shadow-xl shadow-primary/10">
                  <Target size={24} />
                </div>
                <div>
                  <p className="text-[10px] text-primary font-black uppercase tracking-[0.2em] mb-1">Monthly Limit</p>
                  <p className="text-xs text-white/40 font-medium">Set your total spending cap</p>
                </div>
              </div>

              {budgets.find(b => b.categoryId === 'global') && (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="mb-4 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10"
                >
                  <div className="w-1 h-1 rounded-full bg-primary animate-pulse" />
                  <span className="text-[9px] font-black uppercase tracking-widest text-white/40">Current: ₹{budgets.find(b => b.categoryId === 'global')?.amount.toLocaleString()}</span>
                </motion.div>
              )}

              <div className="relative z-10 text-center">
                <div className="relative inline-block">
                  <span className="absolute -left-8 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary">₹</span>
                  <input 
                    type="number"
                    value={globalAmount}
                    onChange={(e) => setGlobalAmount(e.target.value)}
                    placeholder="0"
                    className="w-full bg-transparent text-6xl font-display font-bold text-white outline-none text-center placeholder:text-white/10"
                  />
                </div>
                {initialGlobal !== null && (
                  <div className="mt-4 px-4 py-2 bg-white/5 inline-flex items-center gap-3 rounded-full border border-white/10 backdrop-blur-sm">
                    <div className="flex items-center gap-1.5 border-r border-white/10 pr-3">
                       <div className="w-1.5 h-1.5 rounded-full bg-white/20" />
                       <span className="text-[10px] font-black text-white/30 uppercase tracking-[0.1em]">Original</span>
                    </div>
                    <span className="text-xs font-mono font-bold text-white/60">₹{initialGlobal.toLocaleString()}</span>
                    
                    {parseFloat(globalAmount) > 0 && parseFloat(globalAmount) !== initialGlobal && (
                      <div className={`flex items-center gap-1 text-[9px] font-bold ${parseFloat(globalAmount) > initialGlobal ? 'text-red-400' : 'text-green-400'}`}>
                        {parseFloat(globalAmount) > initialGlobal ? <ChevronUp size={10} /> : <ChevronDown size={10} />}
                        {Math.abs(((parseFloat(globalAmount) - initialGlobal) / initialGlobal) * 100).toFixed(0)}%
                      </div>
                    )}
                  </div>
                )}
              </div>

              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleSave}
                disabled={isSaving}
                className="w-full mt-12 h-16 rounded-3xl bg-primary text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50 relative z-10 overflow-hidden group"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700"></div>
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    Confirm Budget
                  </>
                )}
              </motion.button>
            </motion.div>
          ) : (
            <motion.div 
              key="categories"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              {CATEGORIES.map((cat) => (
                <div key={cat.id} className="glass-card rounded-[2rem] p-5 flex items-center gap-5">
                  <div className={`w-12 h-12 ${cat.bg} ${cat.color} rounded-2xl flex items-center justify-center shrink-0 shadow-lg`}>
                    <cat.icon size={20} />
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-2">
                       <p className="text-[10px] font-black text-white/40 uppercase tracking-[0.2em]">{cat.label}</p>
                       {initialCategoryMap[cat.id] !== undefined && (
                         <div className="flex items-center gap-2 px-2 py-0.5 rounded-full bg-white/5 border border-white/5">
                           <span className="text-[8px] font-black text-white/20 uppercase">Prev</span>
                           <span className="text-[9px] font-mono text-primary/50 font-bold">₹{initialCategoryMap[cat.id].toLocaleString()}</span>
                         </div>
                       )}
                    </div>
                    <div className="relative">
                      <span className="absolute left-0 top-1/2 -translate-y-1/2 text-sm font-bold text-primary">₹</span>
                      <input 
                        type="number"
                        value={categoryBudgets[cat.id] || ''}
                        onChange={(e) => setCategoryBudgets({ ...categoryBudgets, [cat.id]: e.target.value })}
                        placeholder="Not set"
                        className="w-full bg-transparent border-b border-white/5 py-1 pl-4 text-white font-mono font-bold outline-none focus:border-primary transition-colors text-lg"
                      />
                    </div>
                  </div>
                </div>
              ))}

              <motion.button 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                onClick={handleSave}
                disabled={isSaving}
                className="w-full h-16 rounded-3xl bg-primary text-white font-black uppercase tracking-[0.2em] text-xs flex items-center justify-center gap-3 shadow-xl shadow-primary/30 active:scale-95 transition-all disabled:opacity-50"
              >
                {isSaving ? (
                  <div className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    <Save size={18} />
                    Save Changes
                  </>
                )}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {budgets.length === 0 && (
          <div className="glass rounded-2xl p-4 flex gap-4 border-white/20">
            <AlertCircle size={20} className="text-primary shrink-0 animate-pulse" />
            <p className="text-[10px] text-white/60 leading-relaxed font-medium uppercase tracking-wider">
              AI Smart Spend uses these limits to prioritize your alerts and optimization tips.
            </p>
          </div>
        )}

        {budgetHistory.length > 0 && (
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <h3 className="text-[10px] text-white/40 font-black uppercase tracking-[0.2em]">Previous Budgets</h3>
              <div className="h-px flex-1 bg-white/5" />
            </div>
            <div className="space-y-3">
              {budgetHistory.map((history) => {
                const cat = CATEGORIES.find(c => c.id === history.categoryId);
                const Icon = cat?.icon || Target;
                return (
                  <div key={history.id} className="glass-card rounded-2xl p-4 flex items-center justify-between border-white/5">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${cat?.bg || 'bg-primary/10'} ${cat?.color || 'text-primary'} flex items-center justify-center`}>
                        <Icon size={14} />
                      </div>
                      <div>
                        <p className="text-[10px] text-white font-bold tracking-tight">{cat?.label || 'Global'}</p>
                        <p className="text-[8px] text-white/20 uppercase font-black">{new Date(history.changedAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-mono font-bold text-white/40">₹{history.amount.toLocaleString()}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
