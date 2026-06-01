import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Globe, Mail, X, ShieldCheck } from 'lucide-react';
import { auth } from '../../firebase';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  updateProfile,
} from 'firebase/auth';

type AuthMode = 'login' | 'signup';

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<AuthMode>('login');
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [installPromptEvent, setInstallPromptEvent] = useState<any>(() => {
    return (window as any).deferredInstallPrompt || null;
  });
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    if (!isStandalone) {
      setShowInstallPrompt(true);
    }

    const handlePromptAvailable = () => {
      setInstallPromptEvent((window as any).deferredInstallPrompt);
    };

    window.addEventListener('pwa-install-prompt-available', handlePromptAvailable);
    return () => window.removeEventListener('pwa-install-prompt-available', handlePromptAvailable);
  }, []);

  const handleInstallClick = async () => {
    if (installPromptEvent) {
      installPromptEvent.prompt();
      await installPromptEvent.userChoice;
      (window as any).deferredInstallPrompt = null;
      setInstallPromptEvent(null);
      setShowInstallPrompt(false);
      return;
    }

    alert(
      "To install:\n• On Chrome/Edge, click the install icon in the address bar.\n• On iPhone Safari, tap Share and choose 'Add to Home Screen'."
    );
  };

  const handleGoogleLogin = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });

    try {
      setLoading(true);
      setError(null);
      await signInWithPopup(auth, provider);
      sessionStorage.setItem('just_logged_in', 'true');
    } catch (e: any) {
      console.error(e);

      if (e?.code === 'auth/popup-blocked') {
        try {
          setError('Popup blocked by the browser. Redirecting you to Google sign-in...');
          await signInWithRedirect(auth, provider);
          return;
        } catch (redirectError: any) {
          console.error(redirectError);
          setError(redirectError?.message || 'Redirect sign-in failed. Please try again.');
          setLoading(false);
          return;
        }
      }

      if (e?.code === 'auth/popup-closed-by-user') {
        setError('The sign-in popup was closed before login completed.');
      } else if (e?.code === 'auth/cancelled-popup-request') {
        setError('A sign-in request is already in progress. Please wait a moment and try again.');
      } else {
        setError(e.message || 'Login failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  const getAuthErrorMessage = (code?: string, fallback?: string) => {
    switch (code) {
      case 'auth/email-already-in-use':
        return 'An account already exists with this email. Switch to login.';
      case 'auth/invalid-email':
        return 'Please enter a valid email address.';
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'Email or password is incorrect.';
      case 'auth/weak-password':
        return 'Use at least 6 characters for the password.';
      case 'auth/operation-not-allowed':
        return 'Email/password sign-in is not enabled in Firebase Auth.';
      case 'auth/too-many-requests':
        return 'Too many attempts. Please wait a bit and try again.';
      default:
        return fallback || 'Authentication failed. Please try again.';
    }
  };

  const handleEmailAuth = async (event: React.FormEvent) => {
    event.preventDefault();

    const cleanEmail = email.trim();
    const cleanName = displayName.trim();

    if (!cleanEmail || !password) {
      setError('Enter your email and password to continue.');
      return;
    }

    if (mode === 'signup' && !cleanName) {
      setError('Enter your name to create an account.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      if (mode === 'signup') {
        const credential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(credential.user, { displayName: cleanName });
      } else {
        await signInWithEmailAndPassword(auth, cleanEmail, password);
      }
      sessionStorage.setItem('just_logged_in', 'true');
    } catch (e: any) {
      console.error(e);
      setError(getAuthErrorMessage(e?.code, e?.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async () => {
    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Enter your email first, then request a reset link.');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      await sendPasswordResetEmail(auth, cleanEmail);
      setError('Password reset email sent. Check your inbox.');
    } catch (e: any) {
      console.error(e);
      setError(getAuthErrorMessage(e?.code, e?.message));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050507] px-6 py-10 text-white">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(108,99,255,0.12),transparent_20%)]" />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 flex w-full max-w-md flex-col items-center text-center"
      >
        <div className="mb-8 flex h-20 w-20 items-center justify-center rounded-[24px] border border-primary/20 bg-primary/10 shadow-[0_0_30px_rgba(108,99,255,0.15)]">
          <span className="text-[40px]">💰</span>
        </div>

        <h1 className="mb-2 text-[56px] font-black tracking-[-0.04em] text-white">
          SmartSpend <span className="text-primary">AI</span>
        </h1>
        <p className="mb-3 text-[15px] text-white/52">Intelligent money management for modern teams and individuals.</p>
        <div className="mb-10 flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] text-emerald-400">
          <ShieldCheck size={14} />
          Secure Google sign-in
        </div>

        <div className="w-full max-w-[360px] space-y-3">
          <div className="grid grid-cols-2 rounded-2xl border border-white/8 bg-white/[0.03] p-1">
            {(['login', 'signup'] as AuthMode[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => {
                  setMode(option);
                  setError(null);
                }}
                className={`rounded-xl px-4 py-2.5 text-xs font-black uppercase tracking-[0.16em] transition ${
                  mode === option ? 'bg-primary text-white' : 'text-white/36 hover:text-white/70'
                }`}
              >
                {option === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>

          <form onSubmit={handleEmailAuth} className="space-y-3">
            {mode === 'signup' && (
              <input
                type="text"
                autoComplete="name"
                value={displayName}
                onChange={(event) => setDisplayName(event.target.value)}
                placeholder="Your name"
                className="h-13 w-full rounded-2xl border border-white/8 bg-[#13131a] px-4 text-sm font-semibold text-white outline-none transition focus:border-primary/50"
              />
            )}

            <input
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Email address"
              className="h-13 w-full rounded-2xl border border-white/8 bg-[#13131a] px-4 text-sm font-semibold text-white outline-none transition focus:border-primary/50"
            />

            <input
              type="password"
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Password"
              className="h-13 w-full rounded-2xl border border-white/8 bg-[#13131a] px-4 text-sm font-semibold text-white outline-none transition focus:border-primary/50"
            />

            <button
              type="submit"
              disabled={loading}
              className="flex w-full items-center justify-center gap-3 rounded-2xl bg-primary px-6 py-4 text-[15px] font-bold text-white transition hover:bg-primary/90 disabled:opacity-60"
            >
              {loading ? (
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
              ) : (
                <Mail size={18} />
              )}
              {mode === 'login' ? 'Login with Email' : 'Create Account'}
            </button>
          </form>

          <button
            onClick={handleGoogleLogin}
            disabled={loading}
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-white/8 bg-[#13131a] px-6 py-4 text-[15px] font-bold text-white transition hover:bg-[#171720] disabled:opacity-60"
          >
            {loading ? (
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            ) : (
              <Globe size={18} className="text-sky-400" />
            )}
            {loading ? 'Signing in…' : 'Continue with Google'}
          </button>

          {error ? <p className="text-sm text-error">{error}</p> : null}

          {mode === 'login' && (
            <button
              type="button"
              onClick={handlePasswordReset}
              disabled={loading}
              className="text-xs font-bold text-white/38 transition hover:text-primary disabled:opacity-60"
            >
              Forgot password?
            </button>
          )}
        </div>

        <div className="absolute -bottom-16 text-[11px] text-white/26">Protected access for your live financial workspace</div>
      </motion.div>

      <AnimatePresence>
        {showInstallPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 60 }}
            className="panel-linear fixed bottom-5 left-4 right-4 z-20 mx-auto flex max-w-xl items-center justify-between gap-4 rounded-[24px] p-4"
          >
            <div>
              <div className="text-sm font-bold text-white">Install Smart Spend AI</div>
              <div className="text-xs text-white/34">Pin the production app for faster access.</div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={handleInstallClick}
                className="rounded-xl bg-primary px-4 py-2 text-xs font-black uppercase tracking-[0.16em] text-white"
              >
                Install
              </button>
              <button
                onClick={() => setShowInstallPrompt(false)}
                className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/5 text-white/45 transition hover:text-white"
              >
                <X size={16} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
