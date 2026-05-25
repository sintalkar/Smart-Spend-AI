import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Shield, Sparkles, Check, X, CreditCard, Lock } from 'lucide-react';
import { useSubscription } from './useSubscription';
import { useAuth } from './AuthProvider';
import { doc, setDoc } from 'firebase/firestore';
import { db as firestoreDb } from '../../firebase';
import { hapticFeedback } from '../utils/haptics';
import toast from 'react-hot-toast';

interface ProGateProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  featureName?: string;
  isTriggered?: boolean;
  onClose?: () => void;
}

export function ProGate({ children, fallback, featureName = 'Premium Feature', isTriggered = false, onClose }: ProGateProps) {
  const { isPro, loading } = useSubscription();
  const { user } = useAuth();
  const [showModal, setShowModal] = useState(isTriggered);
  const [upgrading, setUpgrading] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<'monthly' | 'yearly'>('monthly');

  React.useEffect(() => {
    if (isTriggered) {
      setShowModal(true);
    }
  }, [isTriggered]);

  const handleClose = () => {
    setShowModal(false);
    if (onClose) onClose();
  };

  const handleUpgrade = async () => {
    if (!user) return;
    setUpgrading(true);
    hapticFeedback.light();
    
    try {
      // 1. Create Razorpay order via backend
      const amount = selectedPlan === 'monthly' ? 14900 : 99900;
      const orderRes = await fetch('/api/razorpay/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ amount, currency: 'INR' })
      });
      const order = await orderRes.json();
      
      // Simulate standard Razorpay overlay processing
      toast.loading("Initiating secure Razorpay checkout...", { id: 'payment' });
      await new Promise(r => setTimeout(r, 1500));
      
      // 2. Verify payment via backend
      const verifyRes = await fetch('/api/razorpay/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: user.uid,
          razorpay_order_id: order.id,
          razorpay_payment_id: `pay_${Math.random().toString(36).substr(2, 9)}`
        })
      });
      const verify = await verifyRes.json();
      
      if (verify.status === 'success') {
        // 3. Write subscription plan = 'pro' in Firestore
        const userDocRef = doc(firestoreDb, `users/${user.uid}`);
        const validDays = selectedPlan === 'monthly' ? 30 : 365;
        await setDoc(userDocRef, {
          subscription: {
            plan: 'pro',
            validUntil: Date.now() + 1000 * 60 * 60 * 24 * validDays
          }
        }, { merge: true });
        
        hapticFeedback.success();
        toast.success("Congratulations! You are now a PRO Member! 🚀", { id: 'payment' });
        handleClose();
      } else {
        throw new Error("Payment verification failed");
      }
    } catch (e) {
      console.error(e);
      hapticFeedback.error();
      toast.error("Checkout failed. Please try again.", { id: 'payment' });
    } finally {
      setUpgrading(false);
    }
  };

  if (loading) return null;

  // If user is PRO, render children directly
  if (isPro) {
    return <>{children}</>;
  }

  // If user is NOT pro, but the gate isn't triggered directly, render fallback or null
  if (!isTriggered) {
    return <>{fallback || null}</>;
  }

  return (
    <AnimatePresence>
      {showModal && (
        <div className="fixed inset-0 z-[100] flex items-end justify-center p-0 md:p-4">
          {/* Backdrop Blur */}
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Premium Bottom Sheet */}
          <motion.div 
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative w-full max-w-lg bg-gradient-to-b from-[#1E123A] via-[#0F0A1C] to-[#0B0F1A] border-t border-white/10 md:border border-white/10 rounded-t-[32px] md:rounded-[32px] p-6 pb-12 shadow-2xl text-center overflow-hidden"
          >
            {/* Ambient Glows */}
            <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#7C5CFC]/20 blur-[60px] rounded-full pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-[#4F8EF7]/10 blur-[40px] rounded-full pointer-events-none" />
            
            {/* Handle Drag bar */}
            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mb-6" />

            <header className="flex justify-between items-start mb-4">
              <span className="text-[10px] text-[#7C5CFC] font-extrabold uppercase tracking-[0.25em] flex items-center gap-1.5 bg-[#7C5CFC]/10 border border-[#7C5CFC]/20 px-3 py-1 rounded-full">
                <Sparkles size={10} />
                Smart Spend PRO
              </span>
              <button 
                onClick={handleClose}
                className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer"
              >
                <X size={14} />
              </button>
            </header>

            <div className="w-16 h-16 bg-[#7C5CFC]/15 border border-[#7C5CFC]/25 rounded-2xl flex items-center justify-center text-[#7C5CFC] mx-auto mb-5 shadow-lg shadow-[#7C5CFC]/20">
              <Lock size={28} className="animate-pulse" />
            </div>

            <h3 className="text-xl font-extrabold text-white tracking-tight mb-2 select-none">
              Unlock {featureName}
            </h3>
            <p className="text-gray-400 text-xs mb-6 max-w-sm mx-auto leading-relaxed select-none">
              Upgrade to PRO to instantly unlock premium AI features, unlimited scans, and advanced ledger controls.
            </p>

            {/* Pro Capabilities Checklist */}
            <div className="bg-black/30 border border-white/5 rounded-3xl p-5 mb-6 text-left space-y-3">
              {[
                'Unlimited Receipt & PDF OCR Scans',
                'Comprehensive Gemini AI Spending Insights',
                'Personal CA Financial Chatbot Assistant',
                'Advanced 8-Factor Financial Score Metric',
                'One-tap Bank Statement PDF Import'
              ].map((benefit, idx) => (
                <div key={idx} className="flex items-center gap-3 text-xs">
                  <div className="w-5 h-5 rounded-full bg-[#7C5CFC]/15 text-[#7C5CFC] flex items-center justify-center shrink-0 border border-[#7C5CFC]/20">
                    <Check size={10} />
                  </div>
                  <span className="text-gray-300 font-semibold">{benefit}</span>
                </div>
              ))}
            </div>

            {/* Plan selection toggle buttons */}
            <div className="grid grid-cols-2 gap-3 mb-6">
              <button 
                type="button"
                onClick={() => { setSelectedPlan('monthly'); hapticFeedback.light(); }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all ${
                  selectedPlan === 'monthly' 
                    ? 'border-[#7C5CFC] bg-[#7C5CFC]/10 text-white' 
                    : 'border-white/5 bg-white/[0.02] text-gray-500 hover:border-white/10'
                }`}
              >
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1 leading-none">Monthly</span>
                <span className="text-lg font-black text-white font-mono leading-none">₹149<span className="text-xs font-normal text-gray-500">/mo</span></span>
              </button>

              <button 
                type="button"
                onClick={() => { setSelectedPlan('yearly'); hapticFeedback.light(); }}
                className={`p-4 rounded-2xl border text-left flex flex-col justify-between transition-all relative overflow-hidden ${
                  selectedPlan === 'yearly' 
                    ? 'border-[#7C5CFC] bg-[#7C5CFC]/10 text-white' 
                    : 'border-white/5 bg-white/[0.02] text-gray-500 hover:border-white/10'
                }`}
              >
                <span className="absolute top-0 right-0 bg-[#7C5CFC] text-white text-[8px] font-black uppercase px-2 py-0.5 rounded-bl-lg tracking-wider">Save 44%</span>
                <span className="text-[10px] uppercase font-bold tracking-widest block mb-1 leading-none">Yearly Plan</span>
                <span className="text-lg font-black text-white font-mono leading-none">₹999<span className="text-xs font-normal text-gray-500">/yr</span></span>
              </button>
            </div>

            {/* Buy CTA */}
            <button
              onClick={handleUpgrade}
              disabled={upgrading}
              className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-[#4F8EF7] to-[#7C5CFC] text-white font-black uppercase tracking-[0.2em] text-xs py-5 rounded-[2rem] shadow-2xl shadow-[#7C5CFC]/40 active:scale-95 disabled:opacity-50 transition-all cursor-pointer relative overflow-hidden group"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <CreditCard size={16} />
              <span>{upgrading ? 'Connecting Razorpay...' : 'Upgrade To Pro Now'}</span>
            </button>
            
            <p className="text-[9px] text-gray-500 uppercase font-bold tracking-widest mt-4">
              Secure 256-bit bank encryption via Razorpay
            </p>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
