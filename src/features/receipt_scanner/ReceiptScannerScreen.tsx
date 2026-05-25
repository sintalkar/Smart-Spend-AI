import React, { useState, useRef, useEffect } from 'react';
import { Camera, Image as ImageIcon, X, Zap, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { receiptScannerService, ReceiptData } from './GeminiReceiptScanner';
import { ReceiptResultsScreen } from './ReceiptResultsScreen';

type ScannerState = 'Camera' | 'Processing' | 'Results' | 'Error';

export default function ReceiptScannerScreen({ onClose }: { onClose?: () => void }) {
  const [state, setState] = useState<ScannerState>('Camera');
  const [errorMsg, setErrorMsg] = useState('');
  const [receiptData, setReceiptData] = useState<ReceiptData | null>(null);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isDemo, setIsDemo] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state === 'Camera') {
      startCamera();
    } else {
      stopCamera();
    }
    return () => stopCamera();
  }, [state]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: 'environment' } 
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setErrorMsg('');
    } catch (err: any) {
      console.error("Error accessing camera:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access denied. Please enable camera permissions in your browser settings to scan receipts.');
      } else {
        setErrorMsg('Could not access camera. Please ensure a camera is available.');
      }
      setState('Error');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach(track => track.stop());
    }
  };

  const processImage = async (dataUrl: string) => {
    setCapturedImage(dataUrl);
    setState('Processing');
    stopCamera();
    
    try {
      // For Demo mode, wait 3 seconds and return mock data
      if (isDemo) {
        await new Promise(resolve => setTimeout(resolve, 3500));
        const mockData: ReceiptData = {
          merchant_name: "Whole Foods Market",
          date: new Date().toISOString(),
          items: [
            { id: '1', name: 'Organic Avocado', quantity: 2, unit_price: 1.5, total_price: 3.0, category: 'Groceries', selected: true },
            { id: '2', name: 'Almond Milk', quantity: 1, unit_price: 4.99, total_price: 4.99, category: 'Groceries', selected: true },
            { id: '3', name: 'Artisan Bread', quantity: 1, unit_price: 5.5, total_price: 5.5, category: 'Groceries', selected: true },
          ],
          subtotal: 13.49,
          tax: 1.08,
          discount: 0,
          total: 14.57,
          payment_method: 'VISA •••• 1234',
          currency: 'USD',
          confidence: 'High'
        };
        setReceiptData(mockData);
        setState('Results');
        setIsDemo(false);
        return;
      }

      const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
      const data = await receiptScannerService.scanReceipt(dataUrl, mimeType);
      
      if (data) {
        setReceiptData(data);
        setState('Results');
      } else {
        throw new Error("Could not extract data from the receipt.");
      }
    } catch (e: any) {
      setErrorMsg(e.message || "Failed to process receipt");
      setState('Error');
    }
  };

  const preprocessImageCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;
      
      // 1. Grayscale & Contrast boost loop (OpenCV-like threshold preparation)
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        
        // Luminosity grayscaling weights
        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        
        // Boost contrast (stretch around 128 threshold)
        const contrastFactor = 1.3;
        gray = (gray - 128) * contrastFactor + 128;
        gray = Math.max(0, Math.min(255, gray));
        
        data[i] = gray;     // R
        data[i + 1] = gray; // G
        data[i + 2] = gray; // B
      }
      
      ctx.putImageData(imgData, 0, 0);
      console.log("[OCR Preprocessing] OpenCV-like high-contrast canvas filtering completed successfully!");
    } catch (e) {
      console.warn("[OCR Preprocessing] Canvas pixel extraction blocked by CORS. Using original capture.", e);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const video = videoRef.current;
      const canvas = canvasRef.current;
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        // Preprocess captured image with OpenCV contrast boosting before OCR
        preprocessImageCanvas(canvas, ctx);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        processImage(dataUrl);
      }
    }
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        if (e.target?.result) {
          const img = new Image();
          img.onload = () => {
            if (canvasRef.current) {
              const canvas = canvasRef.current;
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext('2d');
              if (ctx) {
                ctx.drawImage(img, 0, 0);
                // Preprocess uploaded files with high-contrast thresholding
                preprocessImageCanvas(canvas, ctx);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
                processImage(dataUrl);
              }
            }
          };
          img.src = e.target.result as string;
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  };

  const handleDemo = () => {
    setIsDemo(true);
    // Use a placeholder receipt image for demo if no camera image is available
    const demoImage = "https://images.unsplash.com/photo-1534951009808-df43b5930180?auto=format&fit=crop&q=80&w=800";
    processImage(demoImage);
  };

  return (
    <div className="fixed inset-0 z-[200] bg-background flex flex-col h-full w-full">
      <AnimatePresence mode="wait">
        {state === 'Camera' && (
          <motion.div 
            key="camera"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col relative"
          >
            <div className="absolute top-0 left-0 right-0 p-6 flex justify-between items-center z-10 bg-gradient-to-b from-black/60 to-transparent pt-safe">
               <button onClick={handleClose} className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-md">
                 <X size={20} />
               </button>
               <div className="flex flex-col items-center">
                 <h2 className="title-bold text-lg text-white">Scan Receipt</h2>
                 <button 
                  onClick={handleDemo}
                  className="bg-primary/20 border border-primary/40 px-3 py-0.5 rounded-full text-[10px] uppercase font-black tracking-widest text-primary-light mt-1 animate-pulse"
                 >
                   Try Demo
                 </button>
               </div>
               <button className="w-10 h-10 rounded-full bg-black/40 flex items-center justify-center text-white backdrop-blur-md">
                 <Zap size={20} />
               </button>
            </div>
            
            <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
              <video 
                ref={videoRef} 
                autoPlay 
                playsInline 
                muted 
                className="absolute inset-0 w-full h-full object-cover"
              />
              <canvas ref={canvasRef} className="hidden" />
              
              {/* Overlay Guide Frame */}
              <div className="absolute inset-0 pointer-events-none p-10 flex flex-col pt-32">
                <div className="flex-1 border-2 border-white/40 rounded-xl relative overflow-hidden">
                   {/* Frame corners */}
                   <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-primary rounded-tl-xl"></div>
                   <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-primary rounded-tr-xl"></div>
                   <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-primary rounded-bl-xl"></div>
                   <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-primary rounded-br-xl"></div>
                   <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
                </div>
                <p className="text-center text-white/80 mt-6 font-medium bg-black/40 py-2 px-4 rounded-full self-center backdrop-blur-md text-sm">
                  Position receipt inside frame
                </p>
              </div>
            </div>

            <div className="bg-surface h-40 pb-safe px-8 flex items-center justify-between rounded-t-3xl relative -mt-6 z-20">
               <input 
                 type="file" 
                 accept="image/*,application/pdf" 
                 ref={fileInputRef} 
                 className="hidden" 
                 onChange={handleFileUpload}
               />
               <button onClick={() => fileInputRef.current?.click()} className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-colors">
                 <ImageIcon size={24} />
               </button>
               
               <button onClick={handleCapture} className="w-20 h-20 rounded-full border-4 border-primary p-1">
                 <div className="w-full h-full bg-white rounded-full active:scale-90 transition-transform"></div>
               </button>
               
               <div className="w-12"></div> {/* Spacer to center the capture button */}
            </div>
          </motion.div>
        )}

        {state === 'Processing' && (
          <motion.div 
            key="processing"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-black"
          >
             <div className="relative w-full max-w-sm aspect-[3/4] bg-surface rounded-2xl overflow-hidden shadow-2xl border border-white/10">
               {capturedImage && (
                 capturedImage.startsWith('data:application/pdf') ? (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-gray-950 text-primary p-6">
                      <FileText size={80} className="mb-4 animate-pulse text-primary" />
                      <p className="text-sm font-semibold text-white">PDF Receipt Selected</p>
                      <p className="text-xs text-gray-400 mt-1">Extracting items...</p>
                    </div>
                  ) : (
                    <img src={capturedImage} alt="Captured" className="w-full h-full object-cover opacity-60 grayscale" referrerPolicy="no-referrer" />
                  )
               )}
               
               {/* Scanning Overlay */}
               <div className="absolute inset-0 bg-primary/5">
                 {/* Scanning Laser */}
                 <motion.div 
                   animate={{ y: ['0%', '100%', '0%'] }} 
                   transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                   className="absolute left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent z-10 shadow-[0_0_20px_#6C63FF]"
                 />

                 {/* Simulated Detection Boxes */}
                 <motion.div 
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: [0, 1, 1, 0] }}
                   transition={{ times: [0, 0.1, 0.4, 0.5], duration: 3, repeat: Infinity, delay: 0.5 }}
                   className="absolute top-[10%] left-[10%] w-[40%] h-[8%] border border-primary-light bg-primary/10 rounded"
                 >
                   <span className="absolute -top-4 left-0 text-[10px] text-primary-light font-bold">MERCHANT</span>
                 </motion.div>

                 <motion.div 
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: [0, 1, 1, 0] }}
                   transition={{ times: [0, 0.2, 0.5, 0.6], duration: 3, repeat: Infinity, delay: 0.7 }}
                   className="absolute top-[20%] right-[10%] w-[30%] h-[6%] border border-primary-light bg-primary/10 rounded"
                 >
                   <span className="absolute -top-4 right-0 text-[10px] text-primary-light font-bold">DATE</span>
                 </motion.div>

                 {[1, 2, 3, 4, 5].map((i) => (
                   <motion.div 
                     key={i}
                     initial={{ opacity: 0, scale: 0.8 }}
                     animate={{ opacity: [0, 1, 1, 0] }}
                     transition={{ times: [0, 0.3, 0.8, 0.9], duration: 3, repeat: Infinity, delay: 1 + i * 0.2 }}
                     className="absolute border border-primary-light/50 bg-primary/5 rounded"
                     style={{ 
                       top: `${35 + i * 10}%`, 
                       left: '10%', 
                       right: '10%', 
                       height: '6%' 
                     }}
                   >
                     <span className="absolute -top-4 left-0 text-[8px] text-primary-light/70 font-mono">ITEM_{i}</span>
                   </motion.div>
                 ))}

                 <motion.div 
                   initial={{ opacity: 0, scale: 0.8 }}
                   animate={{ opacity: [0, 1, 1, 0] }}
                   transition={{ times: [0, 0.4, 0.9, 1], duration: 3, repeat: Infinity, delay: 2.2 }}
                   className="absolute bottom-[10%] right-[10%] w-[40%] h-[10%] border-2 border-primary bg-primary/20 rounded shadow-[0_0_15px_rgba(108,99,255,0.3)]"
                 >
                   <span className="absolute -top-5 right-0 text-xs text-primary font-black">TOTAL DETECTED</span>
                 </motion.div>
               </div>
             </div>
             
             <div className="mt-8 text-center px-6">
               <motion.div
                 animate={{ opacity: [0.5, 1, 0.5] }}
                 transition={{ repeat: Infinity, duration: 1.5 }}
                >
                 <h2 className="title-bold text-2xl mb-2 text-white">Analyzing Receipt</h2>
                 <p className="text-gray-400 text-sm italic">
                   Smart AI is identifying items and prices...
                 </p>
               </motion.div>
               
               <div className="mt-6 flex gap-2 justify-center">
                 <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '0ms' }}></div>
                 <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '200ms' }}></div>
                 <div className="w-1.5 h-1.5 rounded-full bg-primary animate-bounce" style={{ animationDelay: '400ms' }}></div>
               </div>
             </div>
          </motion.div>
        )}

        {state === 'Error' && (
          <motion.div 
            key="error"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center p-6 bg-background"
          >
             <div className="w-16 h-16 bg-error/20 text-error rounded-full flex items-center justify-center mb-6">
               <X size={32} />
             </div>
             <h2 className="title-bold text-2xl mb-2">Scan Failed</h2>
             <p className="text-gray-400 text-center max-w-sm mb-8">{errorMsg}</p>
             <button 
               onClick={() => setState('Camera')}
               className="bg-primary px-8 py-3 rounded-xl font-bold text-white shadow-lg shadow-primary/30 active:scale-95 transition-all"
             >
               Try Again
             </button>
             <button 
               onClick={handleClose}
               className="mt-4 px-8 py-3 font-medium text-gray-400"
             >
               Cancel
             </button>
          </motion.div>
        )}

        {state === 'Results' && receiptData && (
          <motion.div 
            key="results"
            initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
            className="flex flex-col h-full bg-background" // Take up full viewport
          >
            <ReceiptResultsScreen 
              receipt={receiptData} 
              onClose={handleClose}
              onRetake={() => setState('Camera')}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
