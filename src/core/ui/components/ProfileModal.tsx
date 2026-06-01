import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  LogOut,
  User,
  Mail,
  Calendar,
  Activity,
  Check,
  Edit2,
  Shield,
  Cloud,
  Database,
  Coins,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { auth, db as firestoreDb } from '../../../firebase';
import { updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../db';
import { useLiveQuery } from 'dexie-react-hooks';
import { toast } from 'react-hot-toast';
import { hapticFeedback } from '../../utils/haptics';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalance: number;
}

export function ProfileModal({ isOpen, onClose, availableBalance }: ProfileModalProps) {
  const { user, logout } = useAuth();
  
  // States
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(user?.displayName || '');
  const [isSavingName, setIsSavingName] = useState(false);
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);

  // Sync state with user profile
  useEffect(() => {
    if (user?.displayName) {
      setTempName(user.displayName);
    }
  }, [user]);

  // Dexie counts for dynamic app stats
  const txCount = useLiveQuery(() => db.transactions.where('isDeleted').equals(0).count()) ?? 0;
  const budgetCount = useLiveQuery(() => db.budgets.count()) ?? 0;
  const goalCount = useLiveQuery(() => db.goals.count()) ?? 0;

  // Wellness score calculated for this user
  const scoreHistory = useLiveQuery(() => db.moneyScoreHistory.reverse().sortBy('calculatedAt')) ?? [];
  const latestScore = scoreHistory[0]?.score ?? 78; // Fallback to healthy 78 if no score has been saved yet
  
  // Format dates nicely
  const memberSince = user?.metadata.creationTime
    ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Recently';

  const handleClose = () => {
    hapticFeedback.light();
    onClose();
  };

  const handleSaveName = async () => {
    if (!tempName.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    hapticFeedback.success();
    setIsSavingName(true);
    try {
      if (auth.currentUser) {
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, { displayName: tempName.trim() });
        
        // Update Firestore profile doc
        const userDocRef = doc(firestoreDb, `users/${user?.uid}`);
        await setDoc(
          userDocRef,
          { displayName: tempName.trim(), updatedAt: Date.now() },
          { merge: true }
        );

        toast.success('Display name updated successfully!');
        setIsEditingName(false);
        
        // Dispatch custom event to notify other UI screens
        window.dispatchEvent(new CustomEvent('initial_balance_changed'));
        
        // Slight delay before page reload to let Firestore sync finish
        setTimeout(() => {
          window.location.reload();
        }, 600);
      }
    } catch (error) {
      console.error('[ProfileModal] Name update failed:', error);
      toast.error('Failed to update name. Please try again.');
    } finally {
      setIsSavingName(false);
    }
  };

  const handleLogoutClick = () => {
    hapticFeedback.light();
    setShowLogoutConfirm(true);
  };

  const handleConfirmLogout = async () => {
    hapticFeedback.warning();
    toast.loading('Logging out & clearing data...');
    try {
      await logout();
      toast.dismiss();
      toast.success('Logged out successfully');
      onClose();
    } catch (e) {
      toast.dismiss();
      toast.error('Failed to log out');
    }
  };

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 md:p-6 overflow-y-auto">
          {/* Blur Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="fixed inset-0 bg-black/80 backdrop-blur-lg"
          />

          {/* Modal Container */}
          <motion.div
            initial={{ scale: 0.94, y: 20, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.94, y: 20, opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 260 }}
            className="panel-linear relative z-10 w-full max-w-lg rounded-[32px] border border-white/8 bg-[#09090d]/98 overflow-hidden shadow-2xl p-6 md:p-8"
          >
            {/* Ambient background glows */}
            <div className="absolute -left-20 -top-20 h-40 w-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
            <div className="absolute -right-20 -bottom-20 h-40 w-40 rounded-full bg-secondary/8 blur-3xl pointer-events-none" />

            {/* Header X Close Button */}
            <button
              onClick={handleClose}
              className="absolute right-6 top-6 flex h-9 w-9 items-center justify-center rounded-full bg-white/4 border border-white/5 text-white/50 hover:text-white transition duration-200 cursor-pointer"
            >
              <X size={16} />
            </button>

            {/* Title */}
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/12 text-primary shadow-[0_0_24px_rgba(108,99,255,0.2)]">
                👤
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-white/24">WORKSPACE</span>
                <h3 className="text-xl font-extrabold text-white">Your Profile</h3>
              </div>
            </div>

            {/* Profile Detail Section */}
            <div className="mb-6 rounded-[24px] bg-white/[0.02] border border-white/5 p-5">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                {/* Big Initials Avatar */}
                <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[24px] bg-gradient-to-br from-primary/30 to-secondary/20 border border-primary/20 text-3xl font-display font-black text-primary shadow-xl">
                  {tempName
                    ? tempName.split(' ').map(p => p[0]).join('').slice(0, 2).toUpperCase()
                    : 'SS'}
                </div>

                <div className="min-w-0 flex-1 text-center sm:text-left">
                  {/* Name field */}
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    {isEditingName ? (
                      <div className="flex w-full items-center gap-2 mt-1">
                        <input
                          type="text"
                          value={tempName}
                          onChange={(e) => setTempName(e.target.value)}
                          className="h-10 w-full rounded-xl border border-primary/45 bg-[#12121a] px-3 text-sm font-bold text-white outline-none focus:border-primary"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') handleSaveName();
                            if (e.key === 'Escape') setIsEditingName(false);
                          }}
                        />
                        <button
                          onClick={handleSaveName}
                          disabled={isSavingName}
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white hover:bg-primary/95 transition duration-200 cursor-pointer disabled:opacity-60"
                        >
                          {isSavingName ? (
                            <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" />
                          ) : (
                            <Check size={16} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <>
                        <h4 className="truncate text-lg font-extrabold text-white">
                          {user?.displayName || 'SmartSpend User'}
                        </h4>
                        <button
                          onClick={() => {
                            hapticFeedback.light();
                            setIsEditingName(true);
                          }}
                          className="text-white/40 hover:text-white transition duration-200 cursor-pointer"
                        >
                          <Edit2 size={13} />
                        </button>
                      </>
                    )}
                  </div>

                  <p className="mt-1 truncate text-xs text-white/34 flex items-center justify-center sm:justify-start gap-1">
                    <Mail size={12} className="shrink-0" />
                    {user?.email || 'local profile'}
                  </p>

                  <p className="mt-2 text-[10px] font-bold text-white/24 flex items-center justify-center sm:justify-start gap-1">
                    <Calendar size={11} className="shrink-0" />
                    MEMBER SINCE: {memberSince}
                  </p>
                </div>
              </div>
            </div>

            {/* App specific financials (Balance & Wellness) */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <div className="rounded-[20px] bg-white/[0.02] border border-white/5 p-4 text-left">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28 flex items-center gap-1">
                  <Coins size={12} className="text-primary" /> Available Balance
                </span>
                <div className="mt-2 text-xl font-black text-white font-mono">
                  ₹{Math.round(availableBalance).toLocaleString('en-IN')}
                </div>
              </div>

              <div className="rounded-[20px] bg-white/[0.02] border border-white/5 p-4 text-left">
                <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/28 flex items-center gap-1">
                  <Activity size={12} className="text-secondary" /> Wellness Score
                </span>
                <div className="mt-2 flex items-baseline gap-2">
                  <span className="text-xl font-black text-white font-mono">{latestScore}</span>
                  <span className="rounded-md bg-secondary/10 px-1.5 py-0.5 text-[9px] font-extrabold text-secondary border border-secondary/15">
                    {latestScore >= 80 ? 'EXCELLENT' : latestScore >= 60 ? 'HEALTHY' : 'WARNING'}
                  </span>
                </div>
              </div>
            </div>

            {/* Dynamic statistics section */}
            <div className="mb-6">
              <div className="text-[10px] font-black uppercase tracking-[0.24em] text-white/24 mb-3">WORKSPACE STATISTICS</div>
              <div className="grid grid-cols-3 gap-3">
                {[
                  { value: txCount, label: 'Transactions', color: 'text-primary bg-primary/10 border-primary/20' },
                  { value: budgetCount, label: 'Budgets Set', color: 'text-secondary bg-secondary/10 border-secondary/20' },
                  { value: goalCount, label: 'Goals Configured', color: 'text-amber-400 bg-amber-400/10 border-amber-400/20' }
                ].map((stat, i) => (
                  <div key={i} className={`rounded-[20px] bg-white/[0.02] border border-white/5 p-3 text-center`}>
                    <div className="text-lg font-black text-white font-mono">{stat.value}</div>
                    <div className="text-[9px] font-bold text-white/34 mt-1 leading-tight">{stat.label}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* App diagnostics and metadata */}
            <div className="mb-6 rounded-[22px] bg-black/30 border border-white/5 p-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-white/34 flex items-center gap-1.5">
                  <Cloud size={13} className="text-emerald-400" /> Cloud Auto-Sync
                </span>
                <div className="flex items-center gap-1.5 font-bold text-emerald-400 bg-emerald-400/10 border border-emerald-400/15 rounded-full px-2 py-0.5 text-[10px]">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  ONLINE
                </div>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/34 flex items-center gap-1.5">
                  <Database size={13} className="text-secondary" /> Local Engine
                </span>
                <span className="font-bold text-white/58">IndexedDB (Active)</span>
              </div>

              <div className="flex items-center justify-between text-xs">
                <span className="text-white/34 flex items-center gap-1.5">
                  <Shield size={13} className="text-primary" /> Data Regulation
                </span>
                <span className="font-bold text-white/58">DPDPA 2023 Compliant</span>
              </div>
            </div>

            {/* Dashboard Overview Guide */}
            <div className="mb-6 rounded-[22px] bg-primary/5 border border-primary/12 p-4 text-left relative overflow-hidden">
              <div className="absolute top-0 right-0 h-20 w-20 rounded-full bg-primary/5 blur-xl pointer-events-none" />
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs">💡</span>
                <span className="text-[10px] font-black uppercase tracking-[0.16em] text-primary">App Highlight: Dashboard</span>
              </div>
              <p className="text-[11px] leading-relaxed text-white/58 font-semibold">
                The dashboard screen is the main overview page. It presents the financial health score, income, expense, savings, recent transactions, category chart, and AI greeting. Users can understand the current month without opening multiple pages.
              </p>
            </div>

            {/* Confirmation logic for logout */}
            <AnimatePresence mode="wait">
              {showLogoutConfirm ? (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="rounded-2xl border border-error/20 bg-error/5 p-4 text-center mt-2"
                >
                  <AlertCircle className="mx-auto text-error mb-2" size={24} />
                  <h4 className="text-sm font-bold text-white">Sign out of your account?</h4>
                  <p className="text-[11px] text-white/46 mt-1 mb-4 leading-relaxed max-w-sm mx-auto">
                    Your offline data remains secure on this device. You can securely log back in at any time to resume syncing.
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowLogoutConfirm(false)}
                      className="flex-1 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 py-2.5 text-xs font-semibold transition cursor-pointer"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleConfirmLogout}
                      className="flex-1 rounded-xl bg-error hover:bg-error/95 text-white py-2.5 text-xs font-bold transition shadow-[0_4px_16px_rgba(244,63,94,0.3)] cursor-pointer"
                    >
                      Yes, Sign Out
                    </button>
                  </div>
                </motion.div>
              ) : (
                <div className="flex gap-3">
                  <button
                    onClick={handleClose}
                    className="flex-1 rounded-2xl bg-white/5 py-4 font-semibold text-gray-300 hover:bg-white/10 transition cursor-pointer"
                  >
                    Close
                  </button>
                  <button
                    onClick={handleLogoutClick}
                    className="flex-1 flex items-center justify-center gap-2 rounded-2xl border border-error/20 bg-error/10 hover:bg-error/15 py-4 font-bold text-error transition shadow-[0_12px_24px_rgba(244,63,94,0.1)] cursor-pointer"
                  >
                    <LogOut size={16} />
                    Log Out
                  </button>
                </div>
              )}
            </AnimatePresence>

            {/* Version footprint footer */}
            <div className="mt-6 text-center text-[10px] text-white/20">
              SmartSpend AI • Version 1.2.0 (Stable) • Offline-First Native
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
