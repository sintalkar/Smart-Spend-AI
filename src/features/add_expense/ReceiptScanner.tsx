import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Camera, X, Upload, Sparkles, AlertCircle } from 'lucide-react';
import { insightsService } from '../insights/GeminiInsightsService';
import { hapticFeedback } from '../../core/utils/haptics';

interface ReceiptScannerProps {
  onScanComplete: (data: any) => void;
  onClose: () => void;
}

export default function ReceiptScanner({ onScanComplete, onClose }: ReceiptScannerProps) {
  const [image, setImage] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const base64 = event.target?.result as string;
        setImage(base64);
        processImage(base64, file.type);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (base64: string, mimeType: string) => {
    setIsScanning(true);
    setError(null);
    hapticFeedback.light();
    
    try {
      const result = await insightsService.scanReceipt(base64, mimeType);
      hapticFeedback.success();
      setIsScanning(false);
      onScanComplete(result);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to parse receipt. Please try again or enter manually.");
      setIsScanning(false);
      hapticFeedback.error();
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md"
    >
      <div className="relative w-full max-w-lg bg-surface border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl">
        <div className="p-6 flex items-center justify-between border-b border-white/5">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 rounded-2xl bg-primary/20 flex items-center justify-center text-primary">
                <Sparkles size={20} />
             </div>
             <h3 className="text-xl font-bold text-white">Receipt Scanner</h3>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-full bg-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div className="relative aspect-[3/4] bg-black/40 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center overflow-hidden mb-8 group overflow-hidden">
            <AnimatePresence>
              {!image ? (
                <motion.div 
                   key="upload-prompt"
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   exit={{ opacity: 0, scale: 0.9 }}
                   className="flex flex-col items-center gap-4 text-center p-6"
                >
                   <div className="w-20 h-20 rounded-full bg-primary/10 flex items-center justify-center text-primary border border-primary/20 group-hover:scale-110 transition-transform">
                      <Camera size={32} />
                   </div>
                   <div>
                     <p className="text-white font-bold mb-1">Snap or Upload Receipt</p>
                     <p className="text-xs text-gray-500 max-w-[200px]">We'll automatically detect items, totals, and merchant info.</p>
                   </div>
                   <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="mt-2 bg-primary text-white p-4 px-8 rounded-2xl font-bold flex items-center gap-2 active:scale-95 transition-all shadow-lg shadow-primary/20"
                   >
                      <Upload size={18} />
                      Choose Photo
                   </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="image-preview" 
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="w-full h-full relative"
                >
                  <img src={image} alt="Receipt" className="w-full h-full object-cover" />
                  
                  {isScanning && (
                    <>
                      <div className="absolute inset-0 bg-primary/10 backdrop-blur-[2px]" />
                      {/* Scanning Line Animation */}
                      <motion.div 
                        initial={{ top: '0%' }}
                        animate={{ top: '100%' }}
                        transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                        className="absolute left-0 right-0 h-1 bg-primary shadow-[0_0_20px_rgba(99,102,241,0.8)] z-10"
                      />
                      <div className="absolute inset-0 flex items-center justify-center z-20">
                         <div className="bg-black/60 backdrop-blur-md rounded-2xl p-4 flex flex-col items-center gap-3 border border-white/10">
                            <motion.div 
                               animate={{ rotate: 360 }}
                               transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                            >
                               <Sparkles size={24} className="text-primary" />
                            </motion.div>
                            <span className="text-xs font-black uppercase tracking-widest text-white">Analyzing Bill...</span>
                         </div>
                      </div>
                    </>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

            {error && (
               <div className="absolute bottom-6 left-6 right-6 p-4 bg-error/90 backdrop-blur-md rounded-2xl flex items-start gap-3 z-30">
                  <AlertCircle size={18} className="text-white shrink-0 mt-0.5" />
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-widest text-white mb-1">Processing Error</p>
                    <p className="text-xs text-white/90 leading-tight">{error}</p>
                    <button 
                       onClick={() => setImage(null)}
                       className="mt-3 text-[9px] font-black uppercase tracking-[0.2em] bg-white/20 px-3 py-1.5 rounded-lg active:scale-95 transition-all"
                    >
                       Try Another
                    </button>
                  </div>
               </div>
            )}
          </div>

          <input 
            type="file" 
            ref={fileInputRef}
            onChange={handleFileChange}
            accept="image/*"
            capture="environment"
            className="hidden"
          />

          {!isScanning && image && !error && (
            <div className="flex gap-4">
               <button 
                  onClick={() => setImage(null)}
                  className="flex-1 h-16 rounded-3xl border border-white/10 text-white font-bold text-sm bg-white/5 active:scale-95 transition-all"
               >
                  Cancel
               </button>
               <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 h-16 rounded-3xl bg-primary text-white font-bold text-sm active:scale-95 transition-all shadow-lg shadow-primary/20"
               >
                  Retake
               </button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}
