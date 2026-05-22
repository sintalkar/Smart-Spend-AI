import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X } from 'lucide-react';

export function PwaInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsVisible(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    return () => window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User response to install prompt: ${outcome}`);
    setDeferredPrompt(null);
    setIsVisible(false);
  };

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 50 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 50 }}
        className="fixed bottom-20 left-4 right-4 bg-primary text-white p-4 rounded-3xl shadow-xl z-50 flex items-center justify-between border border-white/20"
      >
        <div className="flex flex-col">
          <span className="font-bold">Install Smart Spend</span>
          <span className="text-xs opacity-90">Install on your device for quick access.</span>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setIsVisible(false)} className="bg-white/20 p-2 rounded-full">
            <X size={20} />
          </button>
          <button onClick={handleInstall} className="bg-white text-primary px-4 py-2 rounded-xl font-bold flex items-center gap-2">
            <Download size={18} />
            Install
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
