import React, { useEffect, useRef, useState } from 'react';
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
        video: { facingMode: 'environment' },
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setErrorMsg('');
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setErrorMsg('Camera access denied. Please enable camera permissions in your browser settings to scan receipts.');
      } else {
        setErrorMsg('Could not access camera. Please ensure a camera is available or upload a receipt image.');
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
      const mimeType = dataUrl.substring(dataUrl.indexOf(':') + 1, dataUrl.indexOf(';'));
      const data = await receiptScannerService.scanReceipt(dataUrl, mimeType);

      if (!data) {
        throw new Error('Could not extract data from the receipt.');
      }

      setReceiptData(data);
      setState('Results');
    } catch (e: any) {
      setErrorMsg(e.message || 'Failed to process receipt');
      setState('Error');
    }
  };

  const preprocessImageCanvas = (canvas: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
    try {
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        let gray = 0.299 * r + 0.587 * g + 0.114 * b;
        const contrastFactor = 1.3;
        gray = (gray - 128) * contrastFactor + 128;
        gray = Math.max(0, Math.min(255, gray));

        data[i] = gray;
        data[i + 1] = gray;
        data[i + 2] = gray;
      }

      ctx.putImageData(imgData, 0, 0);
      console.log('[OCR Preprocessing] High-contrast canvas filtering completed successfully.');
    } catch (e) {
      console.warn('[OCR Preprocessing] Canvas pixel extraction blocked by CORS. Using original capture.', e);
    }
  };

  const handleCapture = () => {
    if (!videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    preprocessImageCanvas(canvas, ctx);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    processImage(dataUrl);
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      if (!e.target?.result) return;

      const img = new Image();
      img.onload = () => {
        if (!canvasRef.current) return;
        const canvas = canvasRef.current;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.drawImage(img, 0, 0);
        preprocessImageCanvas(canvas, ctx);
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        processImage(dataUrl);
      };
      img.src = e.target.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      window.history.back();
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex h-full w-full flex-col bg-background">
      <AnimatePresence mode="wait">
        {state === 'Camera' && (
          <motion.div
            key="camera"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative flex flex-1 flex-col"
          >
            <div className="absolute left-0 right-0 top-0 z-10 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent p-6 pt-safe">
              <button onClick={handleClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md">
                <X size={20} />
              </button>
              <div className="flex flex-col items-center">
                <h2 className="title-bold text-lg text-white">Scan Receipt</h2>
                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-white/35">
                  Live receipt import
                </p>
              </div>
              <button className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur-md">
                <Zap size={20} />
              </button>
            </div>

            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
              <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />
              <canvas ref={canvasRef} className="hidden" />

              <div className="pointer-events-none absolute inset-0 flex flex-col p-10 pt-32">
                <div className="relative flex-1 overflow-hidden rounded-xl border-2 border-white/40">
                  <div className="absolute left-0 top-0 h-8 w-8 rounded-tl-xl border-l-4 border-t-4 border-primary"></div>
                  <div className="absolute right-0 top-0 h-8 w-8 rounded-tr-xl border-r-4 border-t-4 border-primary"></div>
                  <div className="absolute bottom-0 left-0 h-8 w-8 rounded-bl-xl border-b-4 border-l-4 border-primary"></div>
                  <div className="absolute bottom-0 right-0 h-8 w-8 rounded-br-xl border-b-4 border-r-4 border-primary"></div>
                  <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px]"></div>
                </div>
                <p className="mt-6 self-center rounded-full bg-black/40 px-4 py-2 text-center text-sm font-medium text-white/80 backdrop-blur-md">
                  Position receipt inside frame
                </p>
              </div>
            </div>

            <div className="relative z-20 -mt-6 flex h-40 items-center justify-between rounded-t-3xl bg-surface px-8 pb-safe">
              <input
                type="file"
                accept="image/*,application/pdf"
                ref={fileInputRef}
                className="hidden"
                onChange={handleFileUpload}
              />
              <button onClick={() => fileInputRef.current?.click()} className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20">
                <ImageIcon size={24} />
              </button>

              <button onClick={handleCapture} className="h-20 w-20 rounded-full border-4 border-primary p-1">
                <div className="h-full w-full rounded-full bg-white transition-transform active:scale-90"></div>
              </button>

              <div className="w-12"></div>
            </div>
          </motion.div>
        )}

        {state === 'Processing' && (
          <motion.div
            key="processing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center bg-black p-6"
          >
            <div className="relative aspect-[3/4] w-full max-w-sm overflow-hidden rounded-2xl border border-white/10 bg-surface shadow-2xl">
              {capturedImage &&
                (capturedImage.startsWith('data:application/pdf') ? (
                  <div className="flex h-full w-full flex-col items-center justify-center bg-gray-950 p-6 text-primary">
                    <FileText size={80} className="mb-4 animate-pulse text-primary" />
                    <p className="text-sm font-semibold text-white">PDF Receipt Selected</p>
                    <p className="mt-1 text-xs text-gray-400">Extracting items...</p>
                  </div>
                ) : (
                  <img src={capturedImage} alt="Captured" className="h-full w-full object-cover opacity-60 grayscale" referrerPolicy="no-referrer" />
                ))}

              <div className="absolute inset-0 bg-primary/5">
                <motion.div
                  animate={{ y: ['0%', '100%', '0%'] }}
                  transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
                  className="absolute left-0 right-0 z-10 h-0.5 bg-gradient-to-r from-transparent via-primary to-transparent shadow-[0_0_20px_#6C63FF]"
                />
              </div>
            </div>

            <div className="mt-8 px-6 text-center">
              <motion.div animate={{ opacity: [0.5, 1, 0.5] }} transition={{ repeat: Infinity, duration: 1.5 }}>
                <h2 className="title-bold mb-2 text-2xl text-white">Analyzing Receipt</h2>
                <p className="text-sm italic text-gray-400">Smart AI is identifying items and prices...</p>
              </motion.div>
            </div>
          </motion.div>
        )}

        {state === 'Error' && (
          <motion.div
            key="error"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-1 flex-col items-center justify-center bg-background p-6"
          >
            <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-error/20 text-error">
              <X size={32} />
            </div>
            <h2 className="title-bold mb-2 text-2xl">Scan Failed</h2>
            <p className="mb-8 max-w-sm text-center text-gray-400">{errorMsg}</p>
            <button
              onClick={() => setState('Camera')}
              className="rounded-xl bg-primary px-8 py-3 font-bold text-white shadow-lg shadow-primary/30 transition-all active:scale-95"
            >
              Try Again
            </button>
            <button onClick={handleClose} className="mt-4 px-8 py-3 font-medium text-gray-400">
              Cancel
            </button>
          </motion.div>
        )}

        {state === 'Results' && receiptData && (
          <motion.div
            key="results"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="flex h-full flex-col bg-background"
          >
            <ReceiptResultsScreen receipt={receiptData} onClose={handleClose} onRetake={() => setState('Camera')} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
