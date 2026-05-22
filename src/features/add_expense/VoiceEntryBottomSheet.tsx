import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mic, X, AlertCircle, Loader2, CheckCircle2, ChevronDown } from 'lucide-react';
import { useSpeechRecognition } from './useSpeechRecognition';
import { voiceExpenseParser, VoiceParsedTransaction } from './VoiceExpenseParser';
import clsx from 'clsx';
import { transactionRepo } from '../../db/repositories/TransactionRepository';
import { v4 as uuidv4 } from 'uuid';
import { TransactionType } from '../../db/models';

export function VoiceEntryBottomSheet({ 
  isOpen, 
  onClose,
  onAdded
}: { 
  isOpen: boolean; 
  onClose: () => void;
  onAdded?: () => void;
}) {
  const [parsedData, setParsedData] = useState<VoiceParsedTransaction | null>(null);

  const handleFinalResult = async (text: string) => {
    if (!text.trim()) {
      setState('Idle');
      setTranscript('I didn\'t catch that. Please try again.');
      return;
    }

    setState('Parsing');
    try {
      const result = await voiceExpenseParser.parseVoiceInput(text);
      if (result) {
        setParsedData(result);
        setState('PreFilled');
      } else {
        setErrorMessage('Could not understand the transaction details.');
        setState('Error');
      }
    } catch (e: any) {
      console.error("Voice parsing failed:", e);
      setErrorMessage(e.message || 'Error connecting to analysis service.');
      setState('Error');
    }
  };

  const {
    state,
    transcript,
    errorMessage,
    startListening,
    stopListening,
    setState,
    setTranscript,
    setErrorMessage
  } = useSpeechRecognition(handleFinalResult);

  // Auto-start when opened
  useEffect(() => {
    if (isOpen) {
      setParsedData(null);
      setTranscript('');
      startListening();
    } else {
      stopListening();
    }
  }, [isOpen]);

  const handleConfirm = async () => {
    if (!parsedData) return;
    
    // Convert to target models and save
    const { db } = await import('../../db/database');
    await db.transactions.add({
      id: uuidv4(),
      amount: parsedData.amount,
      type: parsedData.type === 'DEBIT' ? TransactionType.DEBIT : TransactionType.CREDIT,
      categoryId: parsedData.category,
      merchantName: parsedData.merchant,
      tags: [],
      dateTime: new Date(parsedData.date).getTime(),
      source: 'Voice',
      note: parsedData.note,
      isConfirmed: 1,
      isRecurring: 0,
      currency: 'INR',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      isDeleted: 0,
    });
    
    onAdded?.();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-background/90 backdrop-blur-md z-[100]"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 glass border-t border-white/10 rounded-t-[40px] pt-4 pb-8 px-6 z-[101] max-h-[90vh] overflow-y-auto no-scrollbar flex flex-col max-w-md mx-auto"
          >
            {/* Grabber */}
            <div className="w-12 h-1.5 bg-white/10 rounded-full mx-auto mb-8" />
            
            <button 
              onClick={onClose}
              className="absolute top-6 right-6 w-8 h-8 glass flex items-center justify-center text-white/50 hover:text-white transition-colors"
            >
               <X size={20} />
            </button>

            {/* Listening State */}
            {(state === 'Idle' || state === 'Listening' || state === 'Transcribing') && (
              <div className="flex flex-col items-center justify-center py-10 flex-1">
                <div className="relative mb-12">
                  <AnimatePresence>
                    {state === 'Listening' && (
                       <>
                         <motion.div 
                           initial={{ scale: 0.8, opacity: 0 }}
                           animate={{ scale: 1.5, opacity: 0.2 }}
                           exit={{ scale: 0.8, opacity: 0 }}
                           transition={{ repeat: Infinity, duration: 1.5, ease: "easeOut" }}
                           className="absolute inset-0 bg-secondary rounded-full"
                         />
                         <motion.div 
                           initial={{ scale: 0.8, opacity: 0 }}
                           animate={{ scale: 2, opacity: 0.1 }}
                           exit={{ scale: 0.8, opacity: 0 }}
                           transition={{ repeat: Infinity, duration: 2, ease: "easeOut", delay: 0.2 }}
                           className="absolute inset-0 bg-secondary rounded-full"
                         />
                       </>
                    )}
                  </AnimatePresence>
                  
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => state === 'Listening' ? stopListening() : startListening()}
                    className={clsx(
                      "w-24 h-24 rounded-full flex items-center justify-center relative z-10 shadow-2xl transition-colors duration-500",
                      state === 'Listening' ? "bg-secondary text-background" : "bg-surface border border-white/10 text-white"
                    )}
                  >
                     <Mic size={36} />
                  </motion.button>
                </div>
                
                <p className="text-gray-400 font-medium mb-4 uppercase tracking-widest text-xs">
                  {state === 'Listening' ? 'Listening...' : (state === 'Transcribing' ? 'Transcribing...' : 'Tap mic to speak')}
                </p>
                
                <div className="min-h-[80px] text-center px-4">
                  <motion.p 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    key={transcript}
                    className="text-xl font-display text-white italic"
                  >
                    "{transcript || 'Say something like "Spent 400 on coffee today"'}"
                  </motion.p>
                </div>
              </div>
            )}

            {/* Parsing State */}
            {state === 'Parsing' && (
              <div className="flex flex-col items-center justify-center py-20 flex-1">
                 <Loader2 size={48} className="text-primary animate-spin mb-6" />
                 <h3 className="title-bold text-2xl mb-2">Analyzing...</h3>
                 <p className="text-gray-400 text-center max-w-xs">Using AI to extract amount, merchant, and category.</p>
              </div>
            )}

            {/* Error State */}
            {state === 'Error' && (
               <div className="flex flex-col items-center justify-center py-16 flex-1">
                 <div className="w-16 h-16 bg-error/20 text-error rounded-full flex items-center justify-center mb-6">
                   <AlertCircle size={32} />
                 </div>
                 <h3 className="title-bold text-2xl mb-2">Oops</h3>
                 <p className="text-gray-400 text-center mb-8 px-4">{errorMessage}</p>
                 <button 
                   onClick={startListening}
                   className="bg-primary px-8 py-3 rounded-full font-bold shadow-lg hover:opacity-90 active:scale-95 transition-all text-white"
                 >
                   Try Again
                 </button>
               </div>
            )}

            {/* PreFilled State */}
            {state === 'PreFilled' && parsedData && (
               <div className="flex flex-col animate-fade-in-up">
                 <h2 className="title-bold text-3xl mb-6 text-center">Confirm Details</h2>
                 
                 <div className="space-y-4 mb-8">
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.1 }}
                      className={clsx(
                        "glass rounded-2xl p-5 flex items-center justify-between",
                        parsedData.confidence < 0.7 && !parsedData.amount ? "border-yellow-500/50" : "border-white/5"
                      )}
                    >
                       <span className="text-gray-400 font-medium">Amount</span>
                       <span className="text-3xl font-mono font-bold text-white">
                         ₹{parsedData.amount}
                       </span>
                    </motion.div>
                    
                    <motion.div 
                      initial={{ x: -20, opacity: 0 }}
                      animate={{ x: 0, opacity: 1 }}
                      transition={{ delay: 0.2 }}
                      className="glass rounded-2xl p-5 border border-white/5 flex items-center justify-between"
                    >
                       <span className="text-gray-400 font-medium">Merchant</span>
                       <span className="text-lg font-semibold text-white capitalize">
                         {parsedData.merchant}
                       </span>
                    </motion.div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.3 }}
                        className={clsx(
                          "glass p-4 rounded-2xl border",
                          parsedData.confidence < 0.7 ? "border-yellow-500/50 bg-yellow-500/5" : "border-white/5"
                        )}
                      >
                         <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Category</span>
                         <span className="text-white font-medium capitalize flex items-center gap-2">
                           <div className="w-2 h-2 rounded-full bg-primary" />
                           {parsedData.category.replace('_', ' ')}
                         </span>
                      </motion.div>
                      <motion.div 
                        initial={{ x: -20, opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        transition={{ delay: 0.4 }}
                        className="glass p-4 rounded-2xl border border-white/5"
                      >
                         <span className="text-xs text-gray-500 uppercase tracking-wider block mb-1">Date</span>
                         <span className="text-white font-medium">{parsedData.date}</span>
                      </motion.div>
                    </div>
                 </div>

                 {parsedData.confidence < 0.7 && (
                   <p className="text-yellow-500 text-xs text-center mb-6 px-4">
                     Low confidence ({(parsedData.confidence * 100).toFixed(0)}%). Please verify the highlighted details.
                   </p>
                 )}

                 <motion.button 
                   initial={{ y: 20, opacity: 0 }}
                   animate={{ y: 0, opacity: 1 }}
                   transition={{ delay: 0.5 }}
                   onClick={handleConfirm}
                   className="w-full bg-success text-surface font-bold text-lg p-4 rounded-xl shadow-[0_10px_30px_rgba(46,213,115,0.3)] hover:opacity-90 active:scale-95 transition-all text-center flex items-center justify-center gap-2"
                 >
                   <CheckCircle2 size={24} />
                   Confirm & Save
                 </motion.button>
               </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
