import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import { Home, ListOrdered, Plus, PieChart, Shield, Mic, Camera, Edit3, X, Coins, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import clsx from 'clsx';
import { VoiceEntryBottomSheet } from '../../features/add_expense/VoiceEntryBottomSheet';
import ReceiptScannerScreen from '../../features/receipt_scanner/ReceiptScannerScreen';
import { adminService, AdminFeatureToggles } from '../../features/admin/AdminService';
import { PwaInstallPrompt } from '../../features/pwa/PwaInstallPrompt';
import { db as firestoreDb } from '../../firebase';
import { doc, setDoc } from 'firebase/firestore';
import { useAuth } from '../auth/AuthProvider';
import { AiAssistant } from '../../features/ai_assistant/AiAssistant';

export function Layout() {
  const location = useLocation();
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isVoiceSheetOpen, setIsVoiceSheetOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [toggles, setToggles] = useState<AdminFeatureToggles>(adminService.getToggles());
  const openedOnce = useRef(false);

  const { user } = useAuth();
  const [isBalanceModalOpen, setIsBalanceModalOpen] = useState(false);
  const [balanceInput, setBalanceInput] = useState('');
  const [balanceError, setBalanceError] = useState<string | null>(null);
  const [initialBalance, setInitialBalance] = useState<number | null>(() => {
    const stored = localStorage.getItem('initial_balance');
    return stored ? Number(stored) : null;
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const stored = localStorage.getItem('initial_balance');
      setInitialBalance(stored ? Number(stored) : null);
    };
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 1000);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  const handleFabClick = (onClickAction: () => void) => {
    if (initialBalance === null) {
      setIsBalanceModalOpen(true);
    } else {
      onClickAction();
    }
  };

  const handleSetBalance = async () => {
    const val = Number(balanceInput);
    if (!balanceInput || isNaN(val) || val <= 0) {
      setBalanceError("Please enter a valid positive balance");
      return;
    }
    
    try {
      localStorage.setItem('initial_balance', val.toString());
      setInitialBalance(val);
      setIsBalanceModalOpen(false);
      setBalanceInput('');
      setBalanceError(null);
      
      // Also sync it to Firestore if logged in
      if (user) {
        const userDocRef = doc(firestoreDb, `users/${user.uid}`);
        await setDoc(userDocRef, {
          initialBalance: val,
          updatedAt: Date.now()
        }, { merge: true });
      }
    } catch (e) {
      console.error(e);
      setBalanceError("Failed to set starting balance. Please try again.");
    }
  };

  useEffect(() => {
    if (!openedOnce.current) {
      adminService.logEvent('APP_OPEN');
      openedOnce.current = true;
    }
  }, []);

  useEffect(() => {
    return adminService.subscribe(() => {
      setToggles(adminService.getToggles());
    });
  }, []);

  const navItems = [
    { path: '/', icon: Home, label: 'Home' },
    { path: '/transactions', icon: ListOrdered, label: 'History' },
    { isFab() { return true; }, path: '#', icon: Plus, label: '' },
    { path: '/insights', icon: PieChart, label: 'Insights' },
    { path: '/score', icon: Shield, label: 'Score' },
  ];

  const fabOptions = [
    { icon: Edit3, label: 'Manual Entry', color: 'bg-primary', onClick: () => { adminService.logEvent('MANUAL_ENTRY'); window.location.href='/add'; }, enabled: true },
    { icon: Mic, label: 'Voice', color: 'bg-secondary', onClick: () => { adminService.logEvent('VOICE_ENTRY_USED'); setIsVoiceSheetOpen(true); }, enabled: toggles.voiceEntry },
    { icon: Camera, label: 'Receipt', color: 'bg-blue-500', onClick: () => { adminService.logEvent('RECEIPT_SCANNED'); setIsReceiptScannerOpen(true); }, enabled: toggles.receiptScanner },
  ];

  // Close FAB when navigating
  useEffect(() => {
    setIsFabOpen(false);
  }, [location.pathname]);

  return (
    <div className="flex flex-col h-screen w-full relative overflow-hidden bg-background md:mx-auto md:max-w-2xl lg:max-w-4xl shadow-2xl">
      <main className="flex-1 overflow-y-auto pb-24 md:pb-6 no-scrollbar w-full h-full">
        <Outlet />
      </main>

      {/* FAB Overlay */}
      <AnimatePresence>
        {isFabOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-background/80 backdrop-blur-sm z-40"
              onClick={() => setIsFabOpen(false)}
            />
            <motion.div 
              initial={{ y: 200, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 200, opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 300 }}
              className="absolute bottom-28 left-6 right-6 bg-surface border border-white/10 rounded-3xl p-6 z-50 shadow-2xl glass-card"
            >
              <h3 className="title-bold text-xl mb-4">Quick Add</h3>
              <div className="grid grid-cols-3 gap-4">
                {fabOptions.filter(o => o.enabled).map((opt, i) => (
                  <motion.div 
                    key={i}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex flex-col items-center gap-2 cursor-pointer"
                    onClick={() => {
                      setIsFabOpen(false);
                      handleFabClick(opt.onClick);
                    }}
                  >
                    <div className={clsx("w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg", opt.color)}>
                      <opt.icon size={24} />
                    </div>
                    <span className="text-[10px] font-medium text-gray-300 text-center">{opt.label}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="absolute bottom-6 left-6 right-6 h-16 glass rounded-[2rem] px-4 flex justify-between items-center z-50 shadow-2xl border border-white/20">
        {navItems.map((item, index) => {
          if (item.isFab?.()) {
            return (
              <div key="fab" className="relative -top-2">
                <motion.button
                  whileHover={{ scale: 1.1 }}
                  whileTap={{ scale: 0.9 }}
                  onClick={() => setIsFabOpen(!isFabOpen)}
                  className="w-14 h-14 rounded-2xl bg-primary flex items-center justify-center text-white shadow-xl shadow-primary/30 z-50 border border-white/20"
                  animate={{ rotate: isFabOpen ? 45 : 0 }}
                >
                  {isFabOpen ? <X size={24} /> : <Plus size={24} />}
                </motion.button>
              </div>
            );
          }

          const isActive = location.pathname === item.path;
          
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                "relative flex items-center justify-center w-12 h-12 transition-all duration-300 rounded-xl",
                isActive ? "text-primary bg-primary/20 shadow-[0_0_15px_rgba(99,102,241,0.2)]" : "text-white/40 hover:text-white/60 hover:bg-white/10"
              )}
            >
              <item.icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              
              {isActive && (
                <motion.div
                  layoutId="nav-dot"
                  className="absolute -bottom-1.5 w-1 h-1 bg-primary rounded-full shadow-[0_0_8px_var(--color-primary)]"
                />
              )}
            </Link>
          );
        })}
      </nav>

      <VoiceEntryBottomSheet 
        isOpen={isVoiceSheetOpen} 
        onClose={() => setIsVoiceSheetOpen(false)} 
        onAdded={() => {
           // Provide haptic feedback or simple refresh if needed here
        }}
      />

      {isReceiptScannerOpen && (
        <ReceiptScannerScreen onClose={() => setIsReceiptScannerOpen(false)} />
      )}
      <PwaInstallPrompt />
      <AiAssistant />

      {/* Balance Setup Modal */}
      <AnimatePresence>
        {isBalanceModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsBalanceModalOpen(false)}
              className="absolute inset-0 bg-black/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 50, opacity: 0 }}
              className="relative w-full max-w-md bg-surface border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden glass-card text-center"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -z-10" />
              
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6">
                <Coins size={32} className="animate-bounce" />
              </div>
              
              <h3 className="text-2xl font-bold text-white mb-2">Set Available Balance</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Please enter your starting available balance to unlock manual entry, voice, receipt scanning, and transfers.
              </p>

              <div className="relative mb-6">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-white/50">₹</span>
                <input 
                  type="number"
                  autoFocus
                  value={balanceInput}
                  onChange={(e) => {
                    setBalanceInput(e.target.value);
                    if (balanceError) setBalanceError(null);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSetBalance();
                  }}
                  placeholder="0"
                  className="w-full h-16 bg-black/40 border border-white/10 rounded-2xl pl-12 pr-6 text-2xl font-bold text-white placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors"
                />
                
                <AnimatePresence>
                  {balanceError && (
                    <motion.div 
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 p-3 bg-error/10 border border-error/20 rounded-xl flex items-center justify-center gap-2 text-error text-xs font-bold"
                    >
                      <AlertCircle size={14} />
                      {balanceError}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-4">
                <button 
                  onClick={() => setIsBalanceModalOpen(false)}
                  className="flex-1 h-14 rounded-2xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 active:scale-95 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={handleSetBalance}
                  className="flex-1 h-14 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/95 shadow-lg shadow-primary/20 active:scale-95 transition-all"
                >
                  Set Balance
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
