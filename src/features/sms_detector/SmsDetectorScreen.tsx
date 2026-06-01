import { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  CheckCircle, 
  MessagesSquare, 
  SmartphoneNfc, 
  ClipboardPaste, 
  Settings, 
  History, 
  Sparkles, 
  X,
  Info,
  ArrowRight
} from 'lucide-react';
import { smsProcessor } from './SmsProcessor';
import { ParsedTransaction } from './RegexParserEngine';
import { transactionRepo } from '../../db/repositories/TransactionRepository';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'react-hot-toast';
import { hapticFeedback } from '../../core/utils/haptics';

export default function SmsDetectorScreen() {
  const [parsing, setParsing] = useState(false);
  const [lastResult, setLastResult] = useState<ParsedTransaction | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [recentDetections, setRecentDetections] = useState<ParsedTransaction[]>([]);
  
  // Input fields for direct paste / simulator
  const [senderTitle, setSenderTitle] = useState('HDFCBK');
  const [smsBody, setSmsBody] = useState('');

  const saveTransaction = async (result: ParsedTransaction) => {
    try {
      await transactionRepo.upsert({
        id: uuidv4(),
        amount: result.amount,
        type: result.type,
        categoryId: result.categoryId || 'other',
        merchantName: result.merchantName,
        tags: ['sms-sync'],
        dateTime: result.dateTime,
        source: 'SMS Parser',
        rawSmsText: result.rawText,
        bankName: result.bankName,
        accountLast4: result.accountLast4,
        upiRefId: result.upiRefId,
        isConfirmed: 1,
        isRecurring: 0,
        currency: 'INR',
        createdAt: Date.now(),
        updatedAt: Date.now(),
        isDeleted: 0,
      });
      setRecentDetections(prev => [result, ...prev].slice(0, 5));
      toast.success('Transaction logged successfully!');
      hapticFeedback.success();
    } catch (error) {
      console.error("Failed to save transaction:", error);
      toast.error("Error saving transaction to database.");
      hapticFeedback.error();
    }
  };

  const handleProcess = async (text: string, title: string) => {
    if (!text.trim()) {
      toast.error('Please enter or copy SMS text first');
      return;
    }

    setParsing(true);
    setLastResult(null);
    toast.loading('Analyzing SMS structure...');
    try {
      const result = await smsProcessor.processSms(text, title);
      toast.dismiss();
      
      if (result) {
        if (autoApprove && result.confidence > 0.85) {
          await saveTransaction(result);
          setLastResult(null);
          // Play quick success audio simulation
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
          audio.play().catch(() => {});
        } else {
          setLastResult(result);
          toast.success('SMS parsed successfully!');
          hapticFeedback.success();
        }
      } else {
        toast.error("Could not parse transaction details from this text.");
        hapticFeedback.error();
      }
    } catch (e: any) {
      toast.dismiss();
      console.error(e);
      toast.error(e.message || "Error processing SMS");
      hapticFeedback.error();
    } finally {
      setParsing(false);
    }
  };

  const handleInsert = async () => {
    if (!lastResult) return;
    try {
      await saveTransaction(lastResult);
      setLastResult(null);
    } catch (error) {
      console.error(error);
    }
  };

  const scanClipboard = async () => {
    hapticFeedback.light();
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        toast.success('Retrieved text from clipboard!');
        await handleProcess(text, 'CLIPBOARD');
      } else {
        toast.error('Clipboard is empty.');
      }
    } catch (err) {
      toast.error("Clipboard access blocked. Please paste text manually below.");
      hapticFeedback.error();
    }
  };

  // Paste keyboard listener
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text) {
        toast.success('Pasted clipboard text detected!');
        handleProcess(text, 'PASTE');
      }
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [autoApprove]);

  return (
    <div className="p-6 pb-32 max-w-2xl mx-auto">
      <header className="mb-8 mt-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 text-primary mb-2">
            <SmartphoneNfc size={20} className="animate-pulse" />
            <span className="text-[10px] uppercase tracking-widest font-black">Smart Clipboard Parser</span>
          </div>
          <h1 className="title-bold text-4xl leading-tight">
            SMS Sync
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
           <button 
             onClick={() => {
               hapticFeedback.light();
               setAutoApprove(!autoApprove);
               toast.success(autoApprove ? 'Switched to Manual approval' : 'Auto-Approve Enabled!');
             }}
             className={`p-3 px-4 rounded-2xl glass transition duration-300 flex items-center gap-2 cursor-pointer ${autoApprove ? 'bg-primary/20 border-primary text-primary shadow-[0_0_20px_rgba(108,99,255,0.18)]' : 'text-white/40 border border-white/5 hover:text-white'}`}
           >
             <Settings size={15} />
             <span className="text-[10px] font-black uppercase tracking-wider">{autoApprove ? 'AUTO APPROVE ON' : 'MANUAL REVIEW'}</span>
           </button>
        </div>
      </header>

      {/* Browser Sandbox Limitation Info Banner */}
      <div className="mb-6 rounded-[24px] bg-amber-500/10 border border-amber-500/20 p-5 relative overflow-hidden text-left animate-in fade-in duration-500">
        <div className="flex gap-4 items-start relative z-10">
          <div className="w-10 h-10 rounded-2xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-xs font-black text-amber-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
              Browser Security Notice
            </h3>
            <p className="text-[11px] leading-relaxed text-white/58 font-semibold">
              Due to mobile operating system privacy models (iOS/Android), web browsers and PWAs **cannot** automatically read your phone's SMS inbox in the background. 
            </p>
          </div>
        </div>
      </div>

      {/* Step-by-Step Instructions */}
      <div className="mb-6 rounded-[24px] bg-white/[0.02] border border-white/5 p-5 text-left">
        <div className="text-[10px] font-black uppercase tracking-widest text-white/34 mb-4 flex items-center gap-1">
          <Info size={13} className="text-primary" /> HOW TO LOG SMS TRANSACTIONS:
        </div>
        <div className="grid grid-cols-3 gap-3">
          {[
            { step: '1', title: 'COPY TEXT', desc: 'Copy any credit/debit SMS from bank' },
            { step: '2', title: 'TAP SCAN', desc: 'Click "Scan Clipboard" below' },
            { step: '3', title: 'CONFIRM', desc: 'Review & approve details' }
          ].map((item, idx) => (
            <div key={idx} className="bg-black/20 rounded-2xl p-3 border border-white/5 relative">
              <div className="absolute top-2 right-2 text-[9px] font-black bg-primary/10 text-primary px-1.5 py-0.5 rounded-md font-mono">
                {item.step}
              </div>
              <div className="text-[9px] font-black uppercase tracking-wider text-white/70 mb-1">{item.title}</div>
              <div className="text-[10px] text-white/34 leading-tight font-medium">{item.desc}</div>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        {/* Main Clipboard Tap Action Card */}
        <motion.div 
          whileHover={{ scale: 1.01, y: -2 }}
          whileTap={{ scale: 0.98 }}
          onClick={scanClipboard}
          className="bg-gradient-to-tr from-primary to-primary-glow rounded-[2.5rem] p-8 text-white shadow-2xl shadow-primary/20 relative overflow-hidden cursor-pointer text-left border border-white/10 group"
        >
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/10 border border-white/15 rounded-2xl flex items-center justify-center mb-6 shadow-xl shadow-black/10 group-hover:scale-105 transition duration-300">
              <ClipboardPaste size={30} />
            </div>
            <h2 className="text-2xl font-black tracking-tight mb-2 flex items-center gap-2">
              Scan Clipboard <ArrowRight size={20} className="group-hover:translate-x-1.5 transition duration-300" />
            </h2>
            <p className="text-white/70 text-xs leading-relaxed max-w-sm font-medium">
              Tap here after copying a bank transaction SMS. Our AI engine will instantly extract the amount, merchant, date, and category.
            </p>
          </div>
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-48 h-48 bg-white/10 rounded-full blur-3xl group-hover:scale-110 transition duration-500"></div>
        </motion.div>

        {/* Processed Transaction Result Card */}
        <AnimatePresence>
          {lastResult && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.92 }}
              className="panel-linear p-6 rounded-[2.5rem] text-left border border-white/8 bg-[#0d0d14]/98 shadow-2xl relative"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-primary font-black uppercase tracking-widest text-[9px] bg-primary/10 border border-primary/20 rounded-full px-3 py-1">
                  <Sparkles size={11} className="text-primary" />
                  Newly Detected Transaction
                </div>
                <button 
                  onClick={() => {
                    hapticFeedback.light();
                    setLastResult(null);
                  }} 
                  className="w-8 h-8 rounded-full bg-white/4 border border-white/5 flex items-center justify-center text-white/50 hover:text-white transition duration-200 cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-white/34 text-[10px] font-black uppercase tracking-[0.16em] mb-2">Detected Amount</p>
                  <p className="text-5xl font-display font-black text-white tracking-tighter font-mono">
                    {lastResult.type === 'DEBIT' ? '-' : '+'}₹{Math.round(lastResult.amount).toLocaleString('en-IN')}
                  </p>
                </div>
                <div className="text-right min-w-0">
                  <p className="text-white/34 text-[10px] font-black uppercase tracking-[0.16em] mb-2">Merchant / Source</p>
                  <p className="text-lg font-extrabold text-white tracking-tight truncate capitalize">{lastResult.merchantName || lastResult.bankName || 'Unknown Source'}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 mb-6 bg-black/24 border border-white/5 rounded-2xl p-4">
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-white/28">Category Match</div>
                  <div className="text-xs font-bold text-primary mt-0.5 capitalize">{lastResult.categoryId?.replace('_', ' ')}</div>
                </div>
                <div>
                  <div className="text-[9px] font-black uppercase tracking-wider text-white/28">Bank Account</div>
                  <div className="text-xs font-bold text-white/62 mt-0.5 font-mono">{lastResult.bankName} {lastResult.accountLast4 ? `(..${lastResult.accountLast4})` : ''}</div>
                </div>
              </div>

              <button 
                onClick={handleInsert}
                disabled={parsing}
                className="w-full bg-primary hover:bg-primary/95 text-white font-black uppercase tracking-[0.2em] text-xs py-5 rounded-[2rem] shadow-2xl shadow-primary/20 active:scale-95 transition-all group overflow-hidden relative cursor-pointer"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                Approve & Add Transaction
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Manual simulator Paste Area */}
        <div className="glass-card rounded-[2.5rem] p-6 sm:p-8 text-left">
           <div className="flex items-center gap-2 mb-4 text-white/40">
             <MessagesSquare size={16} />
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">Paste SMS Text Area</span>
           </div>
           
           <div className="space-y-4">
              <textarea 
                value={smsBody}
                onChange={e => setSmsBody(e.target.value)}
                placeholder="Paste your transaction SMS here (e.g. 'Rs 250 spent on card x1234 at SWIGGY...')"
                className="w-full bg-[#12121a] text-white p-5 rounded-[1.5rem] outline-none focus:border-primary/50 text-sm min-h-[110px] border border-white/6 transition duration-200"
              />
              <button 
                onClick={() => {
                  hapticFeedback.light();
                  handleProcess(smsBody, senderTitle);
                }} 
                disabled={parsing || !smsBody.trim()}
                className="w-full bg-white/5 border border-white/8 hover:bg-white/10 hover:border-white/15 text-white font-black uppercase tracking-[0.16em] text-[10px] py-4.5 rounded-2xl transition duration-200 cursor-pointer disabled:opacity-40"
              >
                {parsing ? "Analyzing Text..." : "Parse Transaction"}
              </button>
           </div>
        </div>

        {/* Recent Detections List */}
        {recentDetections.length > 0 && (
          <div className="pt-4 text-left animate-in fade-in duration-500">
            <div className="flex items-center gap-2 mb-4 text-white/34">
              <History size={16} />
              <span className="text-[10px] font-black uppercase tracking-widest">Recent SMS Auto-Syncs</span>
            </div>
            <div className="space-y-3">
              {recentDetections.map((d, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className="bg-white/[0.02] p-4 rounded-[20px] flex items-center justify-between border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-2xl flex items-center justify-center border ${d.type === 'DEBIT' ? 'bg-red-500/10 border-red-500/15 text-red-400' : 'bg-success/10 border-success/15 text-success'}`}>
                      <SmartphoneNfc size={18} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-extrabold text-white uppercase truncate max-w-[200px]">{d.merchantName || d.bankName}</p>
                      <p className="text-[9px] text-white/28 font-mono font-bold tracking-wider">{d.bankName} • Account sync</p>
                    </div>
                  </div>
                  <div className={`text-sm font-bold font-mono ${d.type === 'DEBIT' ? 'text-red-400' : 'text-success'}`}>
                    {d.type === 'DEBIT' ? '-' : '+'}₹{Math.round(d.amount).toLocaleString('en-IN')}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
