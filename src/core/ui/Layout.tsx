import { useState, useEffect, useRef } from 'react';
import { Outlet, Link, useLocation } from 'react-router-dom';
import {
  Home,
  ListOrdered,
  Plus,
  PieChart,
  Target,
  Mic,
  Camera,
  Edit3,
  X,
  Coins,
  AlertCircle,
  Shield,
  Wallet,
  Bell,
} from 'lucide-react';
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
import { AnnouncementBanner } from './AnnouncementBanner';
import { MaintenanceScreen } from './MaintenanceScreen';

type NavItem = {
  path: string;
  icon: typeof Home;
  label: string;
};

const desktopNavItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Dashboard' },
  { path: '/transactions', icon: ListOrdered, label: 'Transactions' },
  { path: '/insights', icon: PieChart, label: 'Insights' },
  { path: '/score', icon: Shield, label: 'Money Score' },
  { path: '/goals', icon: Target, label: 'Goals' },
  { path: '/budget', icon: Wallet, label: 'Budget' },
];

const mobileNavItems: NavItem[] = [
  { path: '/', icon: Home, label: 'Home' },
  { path: '/transactions', icon: ListOrdered, label: 'History' },
  { path: '/insights', icon: PieChart, label: 'Insights' },
  { path: '/goals', icon: Target, label: 'Goals' },
];

export function Layout() {
  const location = useLocation();
  const [isFabOpen, setIsFabOpen] = useState(false);
  const [isVoiceSheetOpen, setIsVoiceSheetOpen] = useState(false);
  const [isReceiptScannerOpen, setIsReceiptScannerOpen] = useState(false);
  const [isAiOpen, setIsAiOpen] = useState(false);
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
    return adminService.subscribe(() => {
      setToggles(adminService.getToggles());
    });
  }, []);

  useEffect(() => {
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'initial_balance') {
        setInitialBalance(e.newValue ? Number(e.newValue) : null);
      }
    };
    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleFabClick = (onClickAction: () => void) => {
    if (initialBalance === null) {
      setIsBalanceModalOpen(true);
      return;
    }
    onClickAction();
  };

  const handleSetBalance = async () => {
    const val = Number(balanceInput);
    if (!balanceInput || isNaN(val) || val <= 0) {
      setBalanceError('Please enter a valid positive balance');
      return;
    }

    try {
      localStorage.setItem('initial_balance', val.toString());
      setInitialBalance(val);
      setIsBalanceModalOpen(false);
      setBalanceInput('');
      setBalanceError(null);

      if (user) {
        const userDocRef = doc(firestoreDb, `users/${user.uid}`);
        await setDoc(userDocRef, { initialBalance: val, updatedAt: Date.now() }, { merge: true });
      }
    } catch (e) {
      console.error(e);
      setBalanceError('Failed to set starting balance. Please try again.');
    }
  };

  useEffect(() => {
    if (!openedOnce.current) {
      adminService.logEvent('APP_OPEN');
      openedOnce.current = true;
    }
  }, []);

  useEffect(() => {
    setIsFabOpen(false);
  }, [location.pathname]);

  const fabOptions = [
    { icon: Edit3, label: 'Manual', onClick: () => { adminService.logEvent('MANUAL_ENTRY'); window.location.href = '/add'; }, enabled: true },
    { icon: Mic, label: 'Voice', onClick: () => { adminService.logEvent('VOICE_ENTRY_USED'); setIsVoiceSheetOpen(true); }, enabled: toggles.voiceEntry },
    { icon: Camera, label: 'Receipt', onClick: () => { adminService.logEvent('RECEIPT_SCANNED'); setIsReceiptScannerOpen(true); }, enabled: toggles.receiptScanner },
  ];

  if (toggles.maintenanceMode) {
    return <MaintenanceScreen message={toggles.maintenanceMessage} />;
  }

  const currentPath = location.pathname === '/' ? '/' : `/${location.pathname.split('/')[1]}`;
  const userInitials =
    user?.displayName
      ?.split(' ')
      .map(part => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'SS';

  return (
    <div className="app-shell min-h-screen text-white">
      <div className="mx-auto flex min-h-screen w-full max-w-[1600px]">
        <aside className="panel-linear sticky top-0 hidden h-screen w-[220px] shrink-0 flex-col justify-between border-r border-white/6 bg-[#0d0d14]/95 px-4 py-5 md:flex">
          <div>
            <div className="mb-8 flex items-center gap-3 px-2">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-xl shadow-[0_0_24px_rgba(108,99,255,0.2)]">
                💰
              </div>
              <div className="font-display text-lg font-extrabold tracking-tight">
                Smart<span className="text-primary">Spend</span>
              </div>
            </div>

            <nav className="space-y-2">
              {desktopNavItems.map(item => {
                const active = currentPath === item.path;
                return (
                  <Link
                    key={item.path}
                    to={item.path}
                    className={clsx(
                      'flex items-center gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition-all',
                      active
                        ? 'bg-primary/12 text-primary shadow-[inset_2px_0_0_0_var(--color-primary)]'
                        : 'text-white/42 hover:bg-white/4 hover:text-white/70'
                    )}
                  >
                    <item.icon size={16} />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="space-y-4">
            <button
              onClick={() => setIsAiOpen(true)}
              className="w-full rounded-2xl border border-primary/20 bg-primary/10 px-4 py-3 text-left text-sm font-bold text-primary transition hover:bg-primary/15"
            >
              + Ask SmartSpend AI
            </button>

            <div className="soft-divider flex items-center gap-3 border-t pt-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 font-display text-xs font-black text-primary">
                {userInitials}
              </div>
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-white">{user?.displayName || 'SmartSpend User'}</p>
                <p className="truncate text-[11px] text-white/28">{user?.email || 'local profile'}</p>
              </div>
            </div>
          </div>
        </aside>

        <div className="flex min-h-screen min-w-0 flex-1 flex-col">
          <AnnouncementBanner />

          <header className="sticky top-0 z-40 border-b border-white/5 bg-[#09090d]/92 px-4 py-4 backdrop-blur-xl md:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 font-display text-sm font-black text-primary md:hidden">
                  {userInitials}
                </div>
                <div className="hidden h-11 w-11 items-center justify-center rounded-2xl bg-primary/10 font-display text-sm font-black text-primary md:flex">
                  {userInitials}
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.24em] text-white/24">Welcome</p>
                  <h1 className="text-lg font-extrabold text-white">
                    {user?.displayName?.split(' ')[0] || 'Rohan'}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setIsAiOpen(true)}
                  className="hidden rounded-2xl border border-primary/20 bg-primary/10 px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-primary transition hover:bg-primary/15 md:block"
                >
                  Ask AI
                </button>
                <button className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/6 bg-white/4 text-white/45 transition hover:text-white">
                  <Bell size={16} />
                </button>
              </div>
            </div>
          </header>

          <main className="min-h-0 flex-1 overflow-y-auto pb-28 md:pb-8">
            <div className="mx-auto w-full max-w-[1280px] px-4 py-4 md:px-6">
              <Outlet />
            </div>
          </main>
        </div>
      </div>

      <AnimatePresence>
        {isFabOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/70 backdrop-blur-md md:hidden"
              onClick={() => setIsFabOpen(false)}
            />
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: 'spring', damping: 24, stiffness: 280 }}
              className="panel-linear fixed bottom-24 left-1/2 z-50 w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 rounded-[28px] p-5 md:hidden"
            >
              <div className="grid grid-cols-3 gap-3">
                {fabOptions.filter(option => option.enabled).map(option => (
                  <button
                    key={option.label}
                    onClick={() => {
                      setIsFabOpen(false);
                      handleFabClick(option.onClick);
                    }}
                    className="rounded-3xl border border-white/6 bg-white/2 px-3 py-4 text-center transition hover:bg-white/5"
                  >
                    <div className="mx-auto mb-2 flex h-11 w-11 items-center justify-center rounded-2xl bg-white/5 text-white/80">
                      <option.icon size={18} />
                    </div>
                    <div className="text-[11px] font-bold text-white/70">{option.label}</div>
                  </button>
                ))}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <nav className="fixed bottom-0 left-0 right-0 z-40 flex items-end border-t border-white/6 bg-[#09090d]/96 px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 backdrop-blur-xl md:hidden">
        {mobileNavItems.slice(0, 2).map(item => {
          const active = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition',
                active ? 'text-primary' : 'text-white/32'
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}

        <button
          onClick={() => setIsFabOpen(open => !open)}
          className="mb-2 flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-primary text-white shadow-[0_14px_32px_rgba(108,99,255,0.35)] transition"
        >
          <motion.div animate={{ rotate: isFabOpen ? 45 : 0 }}>
            <Plus size={22} />
          </motion.div>
        </button>

        {mobileNavItems.slice(2).map(item => {
          const active = currentPath === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              className={clsx(
                'flex flex-1 flex-col items-center gap-1 py-2 text-[10px] font-bold transition',
                active ? 'text-primary' : 'text-white/32'
              )}
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <VoiceEntryBottomSheet
        isOpen={isVoiceSheetOpen}
        onClose={() => setIsVoiceSheetOpen(false)}
        onAdded={() => {}}
      />

      {isReceiptScannerOpen && (
        <ReceiptScannerScreen onClose={() => setIsReceiptScannerOpen(false)} />
      )}

      <PwaInstallPrompt />
      <AiAssistant forceOpen={isAiOpen} onOpenChange={setIsAiOpen} hideLauncher />

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
              initial={{ scale: 0.92, y: 24, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.92, y: 24, opacity: 0 }}
              className="panel-linear relative z-10 w-full max-w-md rounded-[32px] p-8 text-center"
            >
              <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-3xl bg-primary/12 text-primary shadow-[0_0_30px_rgba(108,99,255,0.18)]">
                <Coins size={30} />
              </div>

              <h3 className="mb-2 text-2xl font-extrabold text-white">Set Available Balance</h3>
              <p className="mx-auto mb-6 max-w-sm text-sm leading-relaxed text-white/46">
                Enter your starting balance to unlock manual entries, voice capture, receipt scanning, and transfers.
              </p>

              <div className="relative mb-6">
                <span className="absolute left-5 top-1/2 -translate-y-1/2 text-2xl font-bold text-white/44">₹</span>
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
                  className="h-16 w-full rounded-2xl border border-white/8 bg-black/36 pl-12 pr-6 text-2xl font-black text-white outline-none transition focus:border-primary/50"
                />

                <AnimatePresence>
                  {balanceError && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="mt-3 flex items-center justify-center gap-2 rounded-xl border border-error/20 bg-error/10 p-3 text-xs font-bold text-error"
                    >
                      <AlertCircle size={14} />
                      {balanceError}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setIsBalanceModalOpen(false)}
                  className="flex-1 rounded-2xl bg-white/5 py-4 font-semibold text-gray-300 transition hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSetBalance}
                  className="flex-1 rounded-2xl bg-primary py-4 font-semibold text-white shadow-[0_14px_28px_rgba(108,99,255,0.24)] transition hover:bg-primary/90"
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
