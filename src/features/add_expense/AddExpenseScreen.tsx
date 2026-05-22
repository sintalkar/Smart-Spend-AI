import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, Info, Sparkles, Check, Mic, MicOff, Plus, LayoutGrid, X, Camera } from 'lucide-react';
import { db } from '../../db';
import { TransactionType, CategoryType } from '../../db/models';
import { hapticFeedback } from '../../core/utils/haptics';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { voiceExpenseParser } from './VoiceExpenseParser';
import { useSpeechRecognition } from './useSpeechRecognition';
import { adminService } from '../admin/AdminService';
import { useLiveQuery } from 'dexie-react-hooks';
import clsx from 'clsx';
import ReceiptScanner from './ReceiptScanner';
import { checkAndNotifyHighSpending } from '../../core/utils/notifications';

export default function AddExpenseScreen() {
  const navigate = useNavigate();
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.DEBIT);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  
  // Scanned Billing Info
  const [isScannerOpen, setIsScannerOpen] = useState(false);

  // Categories from DB
  const dbCategories = useLiveQuery(() => 
    db.categories.where('type').equals(type === TransactionType.DEBIT ? CategoryType.EXPENSE : CategoryType.INCOME).toArray()
  ) || [];

  // Initialize category to first item if not set
  useEffect(() => {
    if (!categoryId && dbCategories.length > 0) {
      setCategoryId(dbCategories[0].id);
    }
  }, [dbCategories, categoryId]);

  // Custom Category State
  const [isAddingCategory, setIsAddingCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  // AI Parsing State
  const [magicInput, setMagicInput] = useState('');
  const [isParsingAI, setIsParsingAI] = useState(false);

  const { state: speechState, startListening, stopListening, transcript } = useSpeechRecognition((finalTranscript) => {
    setMagicInput(finalTranscript);
  });

  useEffect(() => {
    if (transcript && speechState === 'Listening') {
      setMagicInput(transcript);
    }
  }, [transcript, speechState]);
  
  // AI Suggestion State
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [suggestion, setSuggestion] = useState<{ categoryId: string; confidence: number; reason: string } | null>(null);

  const getAiCategorization = useCallback(async (merchantName: string, noteText: string) => {
    if (!merchantName && !noteText) return;
    
    setIsCategorizing(true);
    try {
      const response = await fetch('/api/ai/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ merchant: merchantName, note: noteText })
      });
      if (response.ok) {
        const data = await response.json();
        const foundCat = dbCategories.find(c => {
            const name = c.name.toLowerCase();
            const target = data.categoryId.toLowerCase();
            return name.includes(target) || target.includes(name);
        });
        
        // Only suggest if confidence is high enough and it's different from current
        if (data.confidence > 0.4 && (foundCat ? foundCat.id !== categoryId : true)) {
          setSuggestion({ ...data, categoryId: foundCat ? foundCat.id : data.categoryId });
        } else {
          setSuggestion(null);
        }
      }
    } catch (e) {
      console.error("AI categorization failed", e);
    } finally {
      setIsCategorizing(false);
    }
  }, [categoryId, dbCategories]);

  const handleAddCustomCategory = async () => {
    if (!newCategoryName.trim()) return;
    
    const id = uuidv4();
    try {
      await db.categories.add({
        id,
        name: newCategoryName,
        type: type === TransactionType.DEBIT ? CategoryType.EXPENSE : CategoryType.INCOME,
        icon: 'tag',
        color: '#6366f1',
        isCustom: 1,
        sortOrder: dbCategories.length + 1
      });
      setCategoryId(id);
      setNewCategoryName('');
      setIsAddingCategory(false);
      hapticFeedback.success();
    } catch (e) {
      console.error(e);
      hapticFeedback.error();
    }
  };

  // Debounced AI call
  useEffect(() => {
    const timer = setTimeout(() => {
      if (merchant.length > 2 || note.length > 2) {
        getAiCategorization(merchant, note);
      }
    }, 1000);
    return () => clearTimeout(timer);
  }, [merchant, note, getAiCategorization]);

  const applySuggestion = () => {
    if (suggestion) {
      setCategoryId(suggestion.categoryId);
      setSuggestion(null);
      hapticFeedback.success();
    }
  };

  const handleMagicParse = async () => {
    if (!magicInput.trim()) return;
    setIsParsingAI(true);
    hapticFeedback.light();
    try {
      const result = await voiceExpenseParser.parseVoiceInput(magicInput);
      if (result) {
        setAmount(result.amount.toString());
        setMerchant(result.merchant || '');
        setNote(result.note || '');
        setCategoryId(result.category || 'other');
        setType(result.type === 'CREDIT' ? TransactionType.CREDIT : TransactionType.DEBIT);
        setDate(result.date);
        setMagicInput('');
        hapticFeedback.success();
      }
    } catch (e) {
      console.error(e);
      hapticFeedback.error();
    } finally {
      setIsParsingAI(false);
    }
  };

  const handleScanComplete = (data: any) => {
    setIsScannerOpen(false);
    if (data) {
      setAmount(data.total?.toString() || data.subtotal?.toString() || '');
      setMerchant(data.merchant_name || '');
      
      // Construct detailed note from items
      if (data.items && data.items.length > 0) {
        const itemSummary = data.items.map((item: any) => `${item.name} (${item.quantity || 1}x)`).join(', ');
        setNote(`Bill Items: ${itemSummary}`);
        
        // Try to pick first item category as general category
        if (data.items[0].category) {
           const catId = data.items[0].category.toLowerCase();
           const found = dbCategories.find(c => c.name.toLowerCase().includes(catId) || catId.includes(c.name.toLowerCase()));
           if (found) setCategoryId(found.id);
        }
      }

      if (data.date) {
        try {
           const parsedDate = new Date(data.date).toISOString().split('T')[0];
           setDate(parsedDate);
        } catch (e) { /* ignore */ }
      }
      
      hapticFeedback.success();
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const val = Number(amount);
    if (!amount || isNaN(val)) {
      setError("Please enter a valid amount");
      hapticFeedback.error();
      return;
    }
    
    if (val <= 0) {
      setError("Amount must be a positive number");
      hapticFeedback.error();
      return;
    }

    if (!localStorage.getItem('initial_balance')) {
      setError("Please set your starting available balance first!");
      hapticFeedback.error();
      return;
    }

    try {
      await db.transactions.add({
        id: uuidv4(),
        amount: Number(amount),
        currency: 'INR',
        type,
        categoryId,
        dateTime: new Date(date).getTime(),
        note: note || undefined,
        merchantName: merchant || undefined,
        source: 'manual',
        isDeleted: 0,
        isRecurring: 0,
        isConfirmed: 1,
        tags: [],
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      });
      hapticFeedback.success();
      checkAndNotifyHighSpending(categoryId);
      navigate(-1);
    } catch (error) {
      console.error(error);
      hapticFeedback.error();
    }
  };

  return (
    <div className="flex flex-col h-full bg-background pt-safe overflow-y-auto w-full max-w-2xl mx-auto pb-32">
      <AnimatePresence>
        {isScannerOpen && (
          <ReceiptScanner 
            onScanComplete={handleScanComplete}
            onClose={() => setIsScannerOpen(false)}
          />
        )}
      </AnimatePresence>

      <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-background/40 backdrop-blur-3xl z-30 border-b border-white/5">
        <button onClick={() => navigate(-1)} className="w-10 h-10 rounded-xl glass-button flex items-center justify-center text-gray-400 hover:text-white">
          <ChevronLeft size={20} />
        </button>
        <h2 className="title-bold !mb-0 text-lg uppercase tracking-[0.2em]">New Entry</h2>
        <button 
           onClick={() => setIsScannerOpen(true)}
           className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group active:scale-95 transition-all"
           title="Scan Receipt"
        >
           <Camera size={18} />
        </button>
      </header>

      <div className="p-6">
        <form onSubmit={handleSave} className="space-y-6 relative z-10">
          {/* AI Magic Input Block */}
          <div className="space-y-4 mb-8">
            <div className="glass-card rounded-3xl p-5 relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 blur-3xl rounded-full group-hover:scale-150 transition-transform duration-1000" />
              <div className="flex items-center justify-between mb-4">
                <label className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-2">
                  <Sparkles size={12} />
                  AI Magic Entry
                </label>
                {speechState === 'Listening' && (
                  <div className="flex items-center gap-1">
                    {[1, 2, 3].map(i => (
                      <motion.div 
                        key={i}
                        animate={{ height: [4, 12, 4] }}
                        transition={{ repeat: Infinity, duration: 0.5, delay: i * 0.1 }}
                        className="w-0.5 bg-primary rounded-full"
                      />
                    ))}
                  </div>
                )}
              </div>
              
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input 
                    type="text" 
                    value={magicInput}
                    onChange={(e) => setMagicInput(e.target.value)}
                    placeholder={speechState === 'Listening' ? 'Listening...' : 'e.g. Spent 250 on tea yesterday'}
                    className={clsx(
                      "w-full bg-white/[0.03] border rounded-2xl p-4 text-sm text-white outline-none transition-all",
                      speechState === 'Listening' ? 'border-primary/50 ring-2 ring-primary/20' : 'border-white/10 focus:border-primary/50'
                    )}
                  />
                  <button 
                    type="button"
                    onClick={() => {
                      if (speechState === 'Listening') stopListening();
                      else {
                          adminService.logEvent('SPEECH_RECOGNITION_STARTED');
                          startListening();
                      }
                    }}
                    className={clsx(
                      "absolute right-2 top-1/2 -translate-y-1/2 p-2 rounded-xl transition-all",
                      speechState === 'Listening' ? 'text-primary bg-primary/10' : 'text-gray-500 hover:text-white'
                    )}
                  >
                    {speechState === 'Listening' ? <MicOff size={18} /> : <Mic size={18} />}
                  </button>
                </div>
                <button 
                  type="button"
                  onClick={handleMagicParse}
                  disabled={isParsingAI || !magicInput.trim()}
                  className="bg-primary text-white p-4 rounded-2xl disabled:opacity-50 active:scale-95 transition-all flex items-center justify-center min-w-[56px] shadow-lg shadow-primary/20"
                >
                  {isParsingAI ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}>
                      <Sparkles size={18} />
                    </motion.div>
                  ) : (
                    <Sparkles size={18} />
                  )}
                </button>
              </div>
            </div>

            {/* Quick Bill Scan Button */}
            <motion.button 
               whileHover={{ scale: 1.01 }}
               whileTap={{ scale: 0.98 }}
               type="button"
               onClick={() => setIsScannerOpen(true)}
               className="w-full glass-card rounded-2xl p-4 flex items-center justify-between border-dashed border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors"
            >
               <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                     <Camera size={18} />
                  </div>
                  <div className="text-left">
                     <p className="text-xs font-bold text-white">Scan Bill Header</p>
                     <p className="text-[10px] text-gray-500 font-medium">Automatic item & merchant detection</p>
                  </div>
               </div>
               <Sparkles size={16} className="text-primary animate-pulse" />
            </motion.button>
          </div>

          <div className="flex glass p-1 rounded-2xl mb-8">
             <button type="button" onClick={() => setType(TransactionType.DEBIT)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all ${type === TransactionType.DEBIT ? 'bg-error/20 text-error shadow-inner' : 'text-white/40 hover:text-white/60'}`}>Expense</button>
             <button type="button" onClick={() => setType(TransactionType.CREDIT)} className={`flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all ${type === TransactionType.CREDIT ? 'bg-success/20 text-success shadow-inner' : 'text-white/40 hover:text-white/60'}`}>Income</button>
          </div>

          <div className="text-center mb-10">
            <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black block mb-4">Amount</label>
            <div className="relative inline-block">
              <span className="absolute left-0 top-1/2 -translate-y-1/2 text-2xl font-bold text-primary mr-2">₹</span>
              <input 
                type="number" 
                step="0.01"
                value={amount}
                onChange={(e) => {
                  setAmount(e.target.value);
                  if (error) setError(null);
                }}
                onFocus={() => hapticFeedback.light()}
                placeholder="0" 
                className="bg-transparent text-7xl text-white font-display font-bold outline-none text-center w-full max-w-[200px]"
                required
              />
            </div>
            <AnimatePresence>
              {error && (
                <motion.p 
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="text-error text-[10px] font-black uppercase tracking-widest mt-4"
                >
                  {error}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          <div className="grid grid-cols-1 gap-6">
            <div className="group">
              <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black block mb-3 pl-1">Where & What</label>
              <div className="space-y-3">
                <div className="relative">
                  <input 
                    type="text" 
                    value={merchant}
                    onChange={(e) => setMerchant(e.target.value)}
                    onFocus={() => hapticFeedback.light()}
                    placeholder="Merchant / Place" 
                    className="w-full glass-card text-base text-white p-5 rounded-[1.5rem] outline-none focus:border-primary/50 transition-all font-medium"
                  />
                </div>
                <input 
                  type="text" 
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  onFocus={() => hapticFeedback.light()}
                  placeholder="Add a note... (Optional)" 
                  className="w-full glass text-sm text-white/60 p-4 rounded-2xl outline-none focus:border-primary/30 transition-all italic"
                />
              </div>
            </div>

            <div className="group">
              <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black block mb-3 pl-1">Transaction Date</label>
              <div className="relative">
                <input 
                  type="date" 
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full glass-card text-base text-white p-5 rounded-[1.5rem] outline-none focus:border-primary/50 transition-all font-medium appearance-none"
                />
              </div>
            </div>
          </div>

          <div className="relative">
            <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black block mb-4 pl-1 flex items-center justify-between">
              Select Category
              {isCategorizing && <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}><Sparkles size={12} className="text-primary" /> </motion.div>}
            </label>
            
            <AnimatePresence>
              {suggestion && (
                <motion.div 
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.9, opacity: 0 }}
                  className="mb-6 glass border-primary/30 rounded-3xl p-5 flex items-center justify-between relative overflow-hidden group"
                >
                  <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors pointer-events-none"></div>
                  <div className="flex gap-4 items-center relative z-10">
                    <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                      <Sparkles size={18} />
                    </div>
                    <div>
                      <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] mb-1">AI Recommendation</p>
                      <p className="text-sm text-white font-bold tracking-tight">Use <span className="text-primary">{dbCategories.find(c => c.id === suggestion.categoryId)?.name || suggestion.categoryId}</span>?</p>
                    </div>
                  </div>
                  <button 
                    type="button"
                    onClick={applySuggestion}
                    className="bg-primary text-white p-3 px-5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 relative z-10"
                  >
                    Apply
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="grid grid-cols-2 gap-3 mb-10">
              {dbCategories.map(cat => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => { setCategoryId(cat.id); setSuggestion(null); hapticFeedback.light(); }}
                  className={clsx(
                    "p-4 rounded-2xl glass-card text-xs font-black uppercase tracking-widest transition-all text-left flex items-center justify-between group",
                    categoryId === cat.id 
                    ? "border-primary bg-primary/20 text-primary shadow-lg shadow-primary/10" 
                    : "text-white/40 hover:text-white/60"
                  )}
                >
                  <span className="truncate">{cat.name}</span>
                  {categoryId === cat.id ? <Check size={14} className="shrink-0 animate-in zoom-in" /> : <div className="w-3 h-3 rounded-full border border-white/10 group-hover:border-white/20 shrink-0" />}
                </button>
              ))}
              
              <button
                type="button"
                onClick={() => setIsAddingCategory(true)}
                className="p-4 rounded-2xl border border-white/10 border-dashed bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:text-white hover:border-white/30 transition-all"
              >
                <Plus size={14} /> Custom
              </button>
            </div>

            <AnimatePresence>
              {isAddingCategory && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="mt-4 bg-surface rounded-2xl border border-white/10 p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Custom Category</p>
                    <button onClick={() => setIsAddingCategory(false)} className="text-gray-500 hover:text-white">
                      <X size={16} />
                    </button>
                  </div>
                  <div className="flex gap-2">
                    <input 
                      type="text"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      placeholder="Category Name"
                      className="flex-1 bg-black/20 border border-white/10 rounded-xl p-3 text-sm text-white outline-none focus:border-primary/50"
                      autoFocus
                    />
                    <button 
                      type="button"
                      onClick={handleAddCustomCategory}
                      disabled={!newCategoryName.trim()}
                      className="bg-primary text-white p-3 px-4 rounded-xl text-xs font-bold disabled:opacity-50"
                    >
                      Add
                    </button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className="fixed bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-background via-background to-transparent z-40">
            <button 
              type="submit" 
              className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-[0.2em] text-sm p-6 rounded-[2rem] shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <Plus size={20} className="relative z-10" />
              <span className="relative z-10">Add Transaction</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

