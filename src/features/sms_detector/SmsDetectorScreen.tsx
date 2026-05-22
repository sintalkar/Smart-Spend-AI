import { useState, useEffect } from 'react';
import { ShieldAlert, CheckCircle, MessagesSquare, SmartphoneNfc, ClipboardPaste, Settings, History, Sparkles, X } from 'lucide-react';
import { smsProcessor } from './SmsProcessor';
import { ParsedTransaction } from './RegexParserEngine';
import { transactionRepo } from '../../db/repositories/TransactionRepository';
import { v4 as uuidv4 } from 'uuid';
import { motion, AnimatePresence } from 'motion/react';

export default function SmsDetectorScreen() {
  const [hasPermission, setHasPermission] = useState(true);
  const [parsing, setParsing] = useState(false);
  const [lastResult, setLastResult] = useState<ParsedTransaction | null>(null);
  const [autoApprove, setAutoApprove] = useState(false);
  const [recentDetections, setRecentDetections] = useState<ParsedTransaction[]>([]);
  
  // Simulation inputs
  const [senderTitle, setSenderTitle] = useState('HDFCBK');
  const [smsBody, setSmsBody] = useState('Rs.450.00 debited from a/c **1234 on 12-05-2026 to SWIGGY. UPI ref: 123456789012');

  const saveTransaction = async (result: ParsedTransaction) => {
    try {
      await transactionRepo.upsert({
        id: uuidv4(),
        amount: result.amount,
        type: result.type,
        categoryId: result.categoryId || 'miscellaneous',
        merchantName: result.merchantName,
        tags: [],
        dateTime: result.dateTime,
        source: result.source,
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
    } catch (error) {
      console.error("Failed to save transaction:", error);
      alert("Error saving transaction to database.");
    }
  };

  const handleProcess = async (text: string, title: string) => {
    setParsing(true);
    setLastResult(null);
    try {
      const result = await smsProcessor.processSms(text, title);
      
      if (result) {
        if (autoApprove && result.confidence > 0.9) {
          await saveTransaction(result);
          setLastResult(null);
          // Quick feedback
          const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2013/2013-preview.mp3');
          audio.play().catch(() => {});
        } else {
          setLastResult(result);
        }
      } else {
        alert("Could not process this text as a transaction.");
      }
    } catch (e) {
      console.error(e);
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
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        await handleProcess(text, 'CLIPBOARD');
      }
    } catch (err) {
      alert("Clipboard access denied. Please paste manually.");
    }
  };

  // Auto-paste effect on focus (optional but cool)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const text = e.clipboardData?.getData('text');
      if (text) handleProcess(text, 'PASTE');
    };
    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [autoApprove]);

  return (
    <div className="p-6 pb-32">
      <header className="mb-10 mt-4 flex justify-between items-start">
        <div>
          <div className="flex items-center gap-3 text-success mb-2">
            <CheckCircle size={20}/>
            <span className="text-xs uppercase tracking-widest font-bold">Smart Detector Active</span>
          </div>
          <h1 className="title-bold text-5xl leading-tight">
            Auto<br/>Sync.
          </h1>
        </div>
        <div className="flex flex-col items-end gap-2">
           <button 
             onClick={() => setAutoApprove(!autoApprove)}
             className={`p-3 rounded-2xl glass transition-all flex items-center gap-2 ${autoApprove ? 'bg-primary text-white' : 'text-gray-500 border border-white/5'}`}
           >
             <Settings size={18} />
             <span className="text-xs font-bold">{autoApprove ? 'AUTO ON' : 'MANUAL'}</span>
           </button>
        </div>
      </header>

      <div className="space-y-6">
        {/* Main Action Card */}
        <motion.div 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={scanClipboard}
          className="bg-primary rounded-[2.5rem] p-8 text-white shadow-2xl shadow-primary/30 relative overflow-hidden cursor-pointer"
        >
          <div className="relative z-10">
            <div className="w-14 h-14 bg-white/20 rounded-2xl flex items-center justify-center mb-6">
              <ClipboardPaste size={32} />
            </div>
            <h2 className="text-2xl font-bold mb-2">Scan Clipboard</h2>
            <p className="text-white/70 text-sm leading-relaxed">
              Copy a bank SMS and tap here to automatically detect the transaction.
            </p>
          </div>
          <div className="absolute top-0 right-0 -mt-8 -mr-8 w-40 h-40 bg-white/10 rounded-full blur-3xl"></div>
        </motion.div>

        {/* Processed Results */}
        <AnimatePresence>
          {lastResult && (
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="glass-card p-6 rounded-[2.5rem]"
            >
              <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-2 text-primary font-bold uppercase tracking-wider text-[10px]">
                  <Sparkles size={14} />
                  New Detection
                </div>
                <button onClick={() => setLastResult(null)} className="w-8 h-8 rounded-full glass flex items-center justify-center text-gray-500 hover:text-white transition-colors">
                  <X size={14} />
                </button>
              </div>

              <div className="flex items-end justify-between mb-8">
                <div>
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Detected Amount</p>
                  <p className="text-5xl font-display font-black text-white tracking-tighter">
                    {lastResult.type === 'DEBIT' ? '-' : '+'}₹{lastResult.amount.toLocaleString()}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-white/40 text-[10px] font-black uppercase tracking-widest mb-2">Source</p>
                  <p className="text-lg font-bold text-white tracking-tight">{lastResult.merchantName || lastResult.bankName || 'Unknown'}</p>
                </div>
              </div>

              <button 
                onClick={handleInsert}
                disabled={parsing}
                className="w-full bg-primary text-white font-black uppercase tracking-[0.2em] text-xs py-5 rounded-[2rem] shadow-2xl shadow-primary/20 active:scale-95 transition-all group overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
                Approve & Add Details
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Advanced Simulation */}
        <div className="glass-card rounded-[2.5rem] p-8">
           <div className="flex items-center gap-2 mb-6 text-white/40">
             <MessagesSquare size={16} />
             <span className="text-[10px] font-black uppercase tracking-[0.2em]">Manual Simulator</span>
           </div>
           
           <div className="space-y-6">
              <textarea 
                value={smsBody}
                onChange={e => setSmsBody(e.target.value)}
                placeholder="Paste sample bank SMS here..."
                className="w-full bg-white/[0.03] text-white p-5 rounded-[1.5rem] outline-none focus:ring-1 focus:ring-primary/50 text-sm min-h-[100px] border border-white/5 transition-all"
              />
              <button 
                onClick={() => handleProcess(smsBody, senderTitle)} 
                disabled={parsing}
                className="w-full glass-button hover:bg-white/5 text-white font-black uppercase tracking-[0.2em] text-[10px] py-4 rounded-2xl transition-all"
              >
                {parsing ? "Parsing..." : "Process Test Message"}
              </button>
           </div>
        </div>

        {/* Recent Auto-detections */}
        {recentDetections.length > 0 && (
          <div className="pt-4">
            <div className="flex items-center gap-2 mb-4 text-gray-500">
              <History size={16} />
              <span className="text-xs font-bold uppercase tracking-widest">Recent Auto-Syncs</span>
            </div>
            <div className="space-y-3">
              {recentDetections.map((d, i) => (
                <motion.div 
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  key={i} 
                  className="bg-white/5 p-4 rounded-2xl flex items-center justify-between border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${d.type === 'DEBIT' ? 'bg-red-500/10 text-red-500' : 'bg-green-500/10 text-green-500'}`}>
                      <SmartphoneNfc size={20} />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white uppercase">{d.merchantName || d.bankName}</p>
                      <p className="text-[10px] text-gray-500 font-mono">{d.source}</p>
                    </div>
                  </div>
                  <div className={`text-sm font-bold ${d.type === 'DEBIT' ? 'text-red-400' : 'text-green-400'}`}>
                    {d.type === 'DEBIT' ? '-' : '+'}₹{d.amount.toLocaleString()}
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
