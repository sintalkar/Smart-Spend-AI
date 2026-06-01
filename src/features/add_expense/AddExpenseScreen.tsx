import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ChevronLeft, Sparkles, Check, Mic, MicOff, Plus, X, Camera, AlertCircle, Loader2 } from 'lucide-react';
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
import { toast } from 'react-hot-toast';

export default function AddExpenseScreen() {
  const navigate = useNavigate();
  const location = useLocation();
  const handledModeRef = useRef<string | null>(null);
  
  // URL Mode State
  const modeParam = new URLSearchParams(location.search).get('mode') || 'manual';
  const isVoiceMode = modeParam === 'voice';

  // Core Form Fields
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [note, setNote] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [type, setType] = useState<TransactionType>(TransactionType.DEBIT);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [error, setError] = useState<string | null>(null);
  
  // Scanned Billing Info
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showManualFieldsInVoice, setShowManualFieldsInVoice] = useState(false);

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

  // Auto-parse on voice recognition complete
  const handleVoiceDone = async (finalTranscript: string) => {
    setMagicInput(finalTranscript);
    if (!finalTranscript.trim()) return;

    setIsParsingAI(true);
    hapticFeedback.light();
    toast.loading('Analyzing speech with Gemini...');
    try {
      const result = await voiceExpenseParser.parseVoiceInput(finalTranscript);
      toast.dismiss();
      if (result) {
        setAmount(result.amount.toString());
        setMerchant(result.merchant || '');
        setNote(result.note || '');
        setCategoryId(result.category || 'other');
        setType(result.type === 'CREDIT' ? TransactionType.CREDIT : TransactionType.DEBIT);
        setDate(result.date);
        
        toast.success('Successfully parsed speech!');
        hapticFeedback.success();
        setShowManualFieldsInVoice(true); // Expose fields for quick review
      } else {
        toast.error('Could not understand transaction details.');
        hapticFeedback.error();
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || 'Error connecting to Gemini');
      hapticFeedback.error();
    } finally {
      setIsParsingAI(false);
    }
  };

  const { state: speechState, startListening, stopListening, transcript } = useSpeechRecognition(handleVoiceDone);

  // Mode based effects
  useEffect(() => {
    const mode = new URLSearchParams(location.search).get('mode');
    if (!mode || handledModeRef.current === mode) return;

    if (mode === 'receipt') {
      handledModeRef.current = mode;
      setIsScannerOpen(true);
      return;
    }

    if (mode === 'voice' && speechState === 'Idle') {
      handledModeRef.current = mode;
      adminService.logEvent('SPEECH_RECOGNITION_STARTED');
      startListening();
    }
  }, [location.search, speechState, startListening]);

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
      const { auth } = await import('../../firebase');
      const response = await fetch('/api/gemini/categorize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          merchant: merchantName, 
          note: noteText,
          userId: auth.currentUser?.uid
        })
      });
      if (response.ok) {
        const data = await response.json();
        const foundCat = dbCategories.find(c => {
            const name = c.name.toLowerCase();
            const target = data.categoryId.toLowerCase();
            return name.includes(target) || target.includes(name);
        });
        
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
        color: '#6c63ff',
        isCustom: 1,
        sortOrder: dbCategories.length + 1
      });
      setCategoryId(id);
      setNewCategoryName('');
      setIsAddingCategory(false);
      hapticFeedback.success();
      toast.success('Custom category created!');
    } catch (e) {
      console.error(e);
      hapticFeedback.error();
    }
  };

  // Debounced AI call
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (merchant.length > 2) {
        try {
          const { merchantMemoryService } = await import('../../lib/merchantMemory');
          const learned = await merchantMemoryService.recallMerchant(merchant);
          if (learned) {
            setSuggestion({
              categoryId: learned.category,
              confidence: 1.0,
              reason: 'Learned from history'
            });
            return;
          }
        } catch (e) {
          console.warn("[Merchant Memory recall failed]", e);
        }
      }
      
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
    toast.loading('Parsing transaction text...');
    try {
      const result = await voiceExpenseParser.parseVoiceInput(magicInput);
      toast.dismiss();
      if (result) {
        setAmount(result.amount.toString());
        setMerchant(result.merchant || '');
        setNote(result.note || '');
        setCategoryId(result.category || 'other');
        setType(result.type === 'CREDIT' ? TransactionType.CREDIT : TransactionType.DEBIT);
        setDate(result.date);
        setMagicInput('');
        toast.success('Successfully pre-filled form!');
        hapticFeedback.success();
        setShowManualFieldsInVoice(true);
      } else {
        toast.error('Failed to parse text. Please try again.');
      }
    } catch (e: any) {
      toast.dismiss();
      toast.error(e.message || 'Error parsing text');
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
      
      if (data.items && data.items.length > 0) {
        const itemSummary = data.items.map((item: any) => `${item.name} (${item.quantity || 1}x)`).join(', ');
        setNote(`Bill Items: ${itemSummary}`);
        
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
      toast.success('Receipt scanned successfully!');
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
        source: isVoiceMode ? 'voice' : 'manual',
        isDeleted: 0,
        isRecurring: 0,
        isConfirmed: 1,
        tags: [],
        createdAt: new Date().getTime(),
        updatedAt: new Date().getTime(),
      });
      hapticFeedback.success();
      checkAndNotifyHighSpending(categoryId);
      toast.success('Transaction saved!');
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
        <h2 className="title-bold !mb-0 text-lg uppercase tracking-[0.2em]">
          {isVoiceMode ? 'Voice Entry' : 'New Entry'}
        </h2>
        
        {/* Only show receipt scanner button in manual/receipt modes */}
        {!isVoiceMode ? (
          <button 
             onClick={() => setIsScannerOpen(true)}
             className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group active:scale-95 transition-all"
             title="Scan Receipt"
          >
             <Camera size={18} />
          </button>
        ) : <div className="w-10 h-10" />}
      </header>

      <div className="p-6">
        {/* DEDICATED VOICE MODE INTERFACE */}
        {isVoiceMode && (
          <div className="mb-6 space-y-6">
            <div className="glass-card rounded-[2.5rem] p-6 relative overflow-hidden text-center border-primary/20 bg-primary/5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 blur-3xl rounded-full" />
              
              {/* Wave/State visuals */}
              <div className="flex flex-col items-center justify-center py-6">
                <div className="relative mb-6">
                  <AnimatePresence>
                    {speechState === 'Listening' && (
                       <>
                         <motion.div 
                           initial={{ scale: 0.8, opacity: 0 }}
                           animate={{ scale: 1.5, opacity: 0.25 }}
                           exit={{ scale: 0.8, opacity: 0 }}
                           transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                           className="absolute inset-0 bg-primary rounded-full"
                         />
                         <motion.div 
                           initial={{ scale: 0.8, opacity: 0 }}
                           animate={{ scale: 2, opacity: 0.12 }}
                           exit={{ scale: 0.8, opacity: 0 }}
                           transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.2 }}
                           className="absolute inset-0 bg-primary rounded-full"
                         />
                       </>
                    )}
                  </AnimatePresence>

                  <motion.button
                    whileTap={{ scale: 0.94 }}
                    onClick={() => {
                      if (speechState === 'Listening') stopListening();
                      else startListening();
                    }}
                    className={clsx(
                      "w-20 h-20 rounded-full flex items-center justify-center relative z-10 shadow-2xl transition duration-300 cursor-pointer",
                      speechState === 'Listening' 
                        ? "bg-primary text-white shadow-[0_0_30px_rgba(108,99,255,0.45)]" 
                        : "bg-white/5 border border-white/10 text-white/70 hover:text-white"
                    )}
                  >
                     {speechState === 'Listening' ? <MicOff size={28} /> : <Mic size={28} />}
                  </motion.button>
                </div>

                <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-4">
                  {speechState === 'Listening' 
                    ? 'Recording...' 
                    : speechState === 'Transcribing' 
                    ? 'Transcribing Speech...'
                    : 'Tap microphone to speak'}
                </p>

                {/* Real-time transcribed text */}
                <div className="min-h-[50px] flex items-center justify-center px-4 mb-2">
                  <AnimatePresence mode="wait">
                    {magicInput || transcript ? (
                      <motion.p
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="text-base font-display font-semibold italic text-white leading-relaxed"
                      >
                        "{magicInput || transcript}"
                      </motion.p>
                    ) : (
                      <p className="text-xs text-white/34 leading-relaxed max-w-xs">
                        "Say something like 'Spent 350 rupees on dinner yesterday' or 'Received 15000 salary today'"
                      </p>
                    )}
                  </AnimatePresence>
                </div>
              </div>

              {/* Loader while AI is analyzing */}
              {isParsingAI && (
                <div className="flex items-center justify-center gap-2 border-t border-white/5 pt-4 mt-2 text-xs font-bold text-primary">
                  <Loader2 size={14} className="animate-spin" />
                  Gemini is parsing transaction...
                </div>
              )}
              
              {/* Fallback Text Input inside the voice section to tweak or type */}
              <div className="mt-4 flex gap-2 border-t border-white/5 pt-4">
                <input 
                  type="text" 
                  value={magicInput}
                  onChange={(e) => setMagicInput(e.target.value)}
                  placeholder="Or type here..."
                  className="flex-1 bg-black/20 border border-white/8 rounded-xl px-4 py-2.5 text-xs text-white outline-none focus:border-primary/50"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleMagicParse();
                  }}
                />
                <button
                  onClick={handleMagicParse}
                  disabled={isParsingAI || !magicInput.trim()}
                  className="bg-primary text-white text-xs font-bold px-4 rounded-xl active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  Parse Text
                </button>
              </div>
            </div>

            {/* Quick action to reveal manual fields to review */}
            {amount && !showManualFieldsInVoice && (
              <button
                onClick={() => setShowManualFieldsInVoice(true)}
                className="w-full rounded-2xl bg-white/5 border border-white/8 py-3 text-xs font-bold text-white/60 hover:text-white transition"
              >
                Tweak Parsed Details Manually ↓
              </button>
            )}
          </div>
        )}

        {/* CORE FORM WRAPPER */}
        <form onSubmit={handleSave} className="space-y-6 relative z-10">
          
          {/* RENDER FORM FIELDS - Only show if in Manual Mode, or if Voice has prefilled details */}
          {(!isVoiceMode || showManualFieldsInVoice || amount) && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-6 duration-300">
              
              {/* Income/Expense Toggle */}
              <div className="flex glass p-1 rounded-2xl mb-8">
                 <button 
                   type="button" 
                   onClick={() => { setType(TransactionType.DEBIT); setCategoryId(dbCategories[0]?.id || ''); }} 
                   className={clsx(
                     "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer", 
                     type === TransactionType.DEBIT ? 'bg-error/20 text-error shadow-inner' : 'text-white/40 hover:text-white/60'
                   )}
                 >
                   Expense
                 </button>
                 <button 
                   type="button" 
                   onClick={() => { setType(TransactionType.CREDIT); setCategoryId(dbCategories[0]?.id || ''); }} 
                   className={clsx(
                     "flex-1 py-3 rounded-xl text-xs font-black uppercase tracking-[0.1em] transition-all cursor-pointer", 
                     type === TransactionType.CREDIT ? 'bg-success/20 text-success shadow-inner' : 'text-white/40 hover:text-white/60'
                   )}
                 >
                   Income
                 </button>
              </div>

              {/* Giant Amount Display */}
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
                    className="bg-transparent text-7xl text-white font-display font-bold outline-none text-center w-full max-w-[240px]"
                    required
                    autoFocus={!isVoiceMode}
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

              {/* Merchant & Note fields */}
              <div className="grid grid-cols-1 gap-6">
                <div className="group">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black block mb-3 pl-1">Where & What</label>
                  <div className="space-y-3">
                    <input 
                      type="text" 
                      value={merchant}
                      onChange={(e) => setMerchant(e.target.value)}
                      onFocus={() => hapticFeedback.light()}
                      placeholder="Merchant / Source" 
                      className="w-full glass-card text-base text-white p-5 rounded-[1.5rem] outline-none focus:border-primary/50 transition-all font-medium"
                    />
                    <input 
                      type="text" 
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      onFocus={() => hapticFeedback.light()}
                      placeholder="Add a note... (Optional)" 
                      className="w-full glass text-sm text-white/60 p-4 rounded-2xl outline-none focus:border-primary/30 transition-all italic font-medium"
                    />
                  </div>
                </div>

                {/* Date Selection */}
                <div className="group">
                  <label className="text-[10px] text-white/40 uppercase tracking-[0.2em] font-black block mb-3 pl-1">Transaction Date</label>
                  <input 
                    type="date" 
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full glass-card text-base text-white p-5 rounded-[1.5rem] outline-none focus:border-primary/50 transition-all font-medium"
                  />
                </div>
              </div>

              {/* AI Categorization recommendation */}
              <div className="relative pt-4">
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
                      className="mb-6 glass border-primary/30 rounded-3xl p-5 flex items-center justify-between relative overflow-hidden group border"
                    >
                      <div className="absolute inset-0 bg-primary/5 group-hover:bg-primary/10 transition-colors pointer-events-none"></div>
                      <div className="flex gap-4 items-center relative z-10">
                        <div className="w-10 h-10 rounded-2xl bg-primary text-white flex items-center justify-center shadow-lg shadow-primary/20">
                          <Sparkles size={18} />
                        </div>
                        <div>
                          <p className="text-[9px] text-primary font-black uppercase tracking-[0.22em] mb-1">AI Recommendation</p>
                          <p className="text-sm text-white font-bold tracking-tight">Use <span className="text-primary">{dbCategories.find(c => c.id === suggestion.categoryId)?.name || suggestion.categoryId}</span>?</p>
                        </div>
                      </div>
                      <button 
                        type="button"
                        onClick={applySuggestion}
                        className="bg-primary text-white p-3 px-5 rounded-xl text-xs font-black uppercase tracking-widest flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20 relative z-10 cursor-pointer"
                      >
                        Apply
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Categories Grid */}
                <div className="grid grid-cols-2 gap-3 mb-10">
                  {dbCategories.map(cat => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => { setCategoryId(cat.id); setSuggestion(null); hapticFeedback.light(); }}
                      className={clsx(
                        "p-4 rounded-2xl glass-card text-xs font-black uppercase tracking-widest transition-all text-left flex items-center justify-between group cursor-pointer",
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
                    className="p-4 rounded-2xl border border-white/10 border-dashed bg-white/5 text-white/40 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:text-white hover:border-white/30 transition-all cursor-pointer"
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
                        <button onClick={() => setIsAddingCategory(false)} className="text-gray-500 hover:text-white cursor-pointer">
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
                          className="bg-primary text-white p-3 px-4 rounded-xl text-xs font-bold disabled:opacity-50 cursor-pointer"
                        >
                          Add
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}

          {/* Sticky Add Button */}
          {(!isVoiceMode || amount) && (
            <div className="fixed bottom-0 left-0 right-0 pb-28 pt-6 px-6 bg-gradient-to-t from-background via-background/95 to-transparent z-40">
              <button 
                type="submit" 
                className="w-full max-w-2xl mx-auto flex items-center justify-center gap-2 bg-primary text-white font-black uppercase tracking-[0.2em] text-sm p-6 rounded-[2rem] shadow-2xl shadow-primary/40 hover:scale-[1.02] active:scale-[0.98] transition-all relative overflow-hidden group cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                <Plus size={20} className="relative z-10" />
                <span className="relative z-10">Add Transaction</span>
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
