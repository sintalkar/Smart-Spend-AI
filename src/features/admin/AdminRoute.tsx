import { useState, useEffect, useRef } from 'react';
import { Shield, Lock, Eye, EyeOff, AlertCircle, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { adminService } from './AdminService';
import AdminDashboard from './AdminDashboard';

async function sha256(text: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(text + ':smartspend-admin-v1');
  const buffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export default function AdminRoute() {
  const [phase, setPhase] = useState<'loading' | 'setup' | 'login' | 'authed'>('loading');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [showPin, setShowPin] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    adminService.getAdminPinHash().then(hash => {
      setPhase(hash ? 'login' : 'setup');
    }).catch(() => setPhase('setup'));
  }, []);

  useEffect(() => {
    if (phase !== 'loading') {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [phase]);

  const handleSetup = async () => {
    if (pin.length < 6) { setError('PIN must be at least 6 characters.'); return; }
    if (pin !== confirmPin) { setError('PINs do not match.'); return; }
    setBusy(true);
    try {
      const hash = await sha256(pin);
      await adminService.saveAdminPin(hash);
      setPhase('authed');
    } catch {
      setError('Failed to save PIN. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  const handleLogin = async () => {
    if (!pin) { setError('Enter your admin PIN.'); return; }
    setBusy(true);
    setError(null);
    try {
      const stored = await adminService.getAdminPinHash();
      const entered = await sha256(pin);
      if (entered === stored) {
        setPhase('authed');
      } else {
        setError('Incorrect PIN. Try again.');
        setPin('');
      }
    } catch {
      setError('Could not verify PIN. Check your connection.');
    } finally {
      setBusy(false);
    }
  };

  if (phase === 'authed') return <AdminDashboard onLogout={() => setPhase('login')} />;

  return (
    <div className="min-h-screen bg-[#070709] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ scale: 0.95, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative w-full max-w-sm bg-[#0e0e14] border border-white/8 rounded-[32px] p-8 shadow-2xl"
      >
        {phase === 'loading' ? (
          <div className="flex flex-col items-center gap-4 py-8">
            <Loader2 size={32} className="text-primary animate-spin" />
            <p className="text-white/40 text-sm font-semibold">Connecting…</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex flex-col items-center mb-8">
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center mb-4">
                {phase === 'setup' ? (
                  <Shield size={28} className="text-primary" />
                ) : (
                  <Lock size={28} className="text-primary" />
                )}
              </div>
              <h1 className="text-xl font-black text-white">
                {phase === 'setup' ? 'Initialize Admin' : 'Admin Access'}
              </h1>
              <p className="text-xs text-white/35 font-bold uppercase tracking-widest mt-1">
                {phase === 'setup' ? 'Set your admin PIN' : 'Smart Spend Control Panel'}
              </p>
            </div>

            {/* PIN input */}
            <div className="space-y-3 mb-6">
              <div className="relative">
                <input
                  ref={inputRef}
                  type={showPin ? 'text' : 'password'}
                  value={pin}
                  onChange={e => { setPin(e.target.value); setError(null); }}
                  onKeyDown={e => {
                    if (e.key === 'Enter') phase === 'setup' ? handleSetup() : handleLogin();
                  }}
                  placeholder={phase === 'setup' ? 'Create PIN (min 6 chars)' : 'Enter admin PIN'}
                  className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-5 pr-12 text-white font-mono text-lg placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors tracking-widest"
                />
                <button
                  onClick={() => setShowPin(v => !v)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition-colors"
                >
                  {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>

              {phase === 'setup' && (
                <input
                  type={showPin ? 'text' : 'password'}
                  value={confirmPin}
                  onChange={e => { setConfirmPin(e.target.value); setError(null); }}
                  onKeyDown={e => { if (e.key === 'Enter') handleSetup(); }}
                  placeholder="Confirm PIN"
                  className="w-full h-14 bg-black/40 border border-white/10 rounded-2xl px-5 text-white font-mono text-lg placeholder:text-white/20 outline-none focus:border-primary/50 transition-colors tracking-widest"
                />
              )}
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
                  className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs font-bold mb-4"
                >
                  <AlertCircle size={14} /> {error}
                </motion.div>
              )}
            </AnimatePresence>

            <button
              onClick={phase === 'setup' ? handleSetup : handleLogin}
              disabled={busy}
              className="w-full h-14 bg-primary text-white font-black rounded-2xl shadow-lg shadow-primary/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {busy ? <Loader2 size={18} className="animate-spin" /> : null}
              {phase === 'setup' ? 'Set PIN & Enter' : 'Unlock Panel'}
            </button>
          </>
        )}
      </motion.div>
    </div>
  );
}
