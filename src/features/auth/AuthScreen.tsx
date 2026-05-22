import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Mail, Lock, UserPlus, LogIn as LogInIcon, Smartphone, Download, X } from 'lucide-react';
import { auth } from '../../firebase';
import { 
  signInWithPopup, 
  GoogleAuthProvider, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword 
} from 'firebase/auth';

export default function AuthScreen() {
  const [loading, setLoading] = useState(false);
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  const [installPromptEvent, setInstallPromptEvent] = useState<any>(() => {
    return (window as any).deferredInstallPrompt || null;
  });
  const [showInstallPrompt, setShowInstallPrompt] = useState(false);

  useEffect(() => {
    if (installPromptEvent) {
      // Small timeout to let the page settle before displaying the gorgeous promo
      const timer = setTimeout(() => setShowInstallPrompt(true), 1500);
      return () => clearTimeout(timer);
    }

    const handlePromptAvailable = () => {
      setInstallPromptEvent((window as any).deferredInstallPrompt);
      setShowInstallPrompt(true);
    };

    window.addEventListener('pwa-install-prompt-available', handlePromptAvailable);
    return () => window.removeEventListener('pwa-install-prompt-available', handlePromptAvailable);
  }, [installPromptEvent]);

  const handleInstallClick = async () => {
    if (!installPromptEvent) return;
    installPromptEvent.prompt();
    const { outcome } = await installPromptEvent.userChoice;
    console.log(`PWA install prompt outcome: ${outcome}`);
    (window as any).deferredInstallPrompt = null;
    setInstallPromptEvent(null);
    setShowInstallPrompt(false);
  };

  const handleGoogleLogin = async () => {
    try {
      setLoading(true);
      setError(null);
      const provider = new GoogleAuthProvider();
      await signInWithPopup(auth, provider);
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleEmailAction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please fill in all fields');
      return;
    }

    try {
      setLoading(true);
      setError(null);
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (e: any) {
      console.error(e);
      setError(e.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col justify-center items-center p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-8"
      >
        <div className="w-20 h-20 mx-auto bg-primary rounded-3xl flex items-center justify-center mb-4 shadow-[0_0_30px_rgba(108,99,255,0.4)]">
           <svg width="40" height="40" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 2L2 7L12 12L22 7L12 2Z" fill="white"/>
              <path d="M2 17L12 22L22 17" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M2 12L12 17L22 12" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
           </svg>
        </div>
        <h1 className="title-bold text-3xl mb-2">SmartSpend</h1>
        <p className="text-gray-400 text-sm">Your intelligent financial companion.</p>
      </motion.div>

      <div className="w-full max-w-sm space-y-6">
        <motion.button
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          onClick={handleGoogleLogin}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white text-black font-semibold py-3.5 rounded-2xl transition-transform active:scale-95 disabled:opacity-50 shadow-sm"
        >
          {loading && !email ? (
            <div className="w-5 h-5 border-2 border-black/20 border-t-black rounded-full animate-spin" />
          ) : (
            <>
               <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M22.56 12.25C22.56 11.47 22.49 10.72 22.36 10H12V14.26H17.92C17.67 15.63 16.89 16.79 15.72 17.57V20.35H19.28C21.36 18.43 22.56 15.6 22.56 12.25Z" fill="#4285F4"/>
                  <path d="M12 23C14.97 23 17.47 22.02 19.28 20.35L15.72 17.57C14.74 18.23 13.48 18.63 12 18.63C9.14 18.63 6.72 16.7 5.86 14.1H2.18V16.95C3.99 20.55 7.7 23 12 23Z" fill="#34A853"/>
                  <path d="M5.86 14.1C5.64 13.44 5.51 12.74 5.51 12C5.51 11.26 5.64 10.56 5.86 9.9V7.05H2.18C1.45 8.52 1 10.21 1 12C1 13.79 1.45 15.48 2.18 16.95L5.86 14.1Z" fill="#FBBC05"/>
                  <path d="M12 5.38C13.62 5.38 15.06 5.94 16.21 7.03L19.35 3.89C17.46 2.13 14.97 1 12 1C7.7 1 3.99 3.45 2.18 7.05L5.86 9.9C6.72 7.3 9.14 5.38 12 5.38Z" fill="#EA4335"/>
               </svg>
               Continue with Google
            </>
          )}
        </motion.button>

        <div className="relative flex items-center py-2">
          <div className="flex-grow border-t border-gray-800"></div>
          <span className="flex-shrink mx-4 text-gray-500 text-xs uppercase tracking-widest">or</span>
          <div className="flex-grow border-t border-gray-800"></div>
        </div>

        <motion.div
           initial={{ opacity: 0, y: 20 }}
           animate={{ opacity: 1, y: 0 }}
           transition={{ delay: 0.2 }}
           className="space-y-4"
        >
          <form onSubmit={handleEmailAction} className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 ml-1">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="email" 
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full bg-surface border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-xs font-medium text-gray-400 ml-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                <input 
                  type="password" 
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full bg-surface border border-white/5 rounded-2xl py-3.5 pl-12 pr-4 text-white placeholder:text-gray-600 focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
            </div>

            {error && (
              <p className="text-red-400 text-xs px-1">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-primary text-white font-bold py-4 rounded-2xl shadow-lg shadow-primary/20 active:scale-95 disabled:opacity-50 transition-all flex items-center justify-center gap-2"
            >
              {loading && email ? (
                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
              ) : (
                <>
                  {isSignUp ? <UserPlus className="w-5 h-5" /> : <LogInIcon className="w-5 h-5" />}
                  {isSignUp ? 'Create Account' : 'Sign In'}
                </>
              )}
            </button>
          </form>

          <div className="text-center pt-2">
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="text-gray-400 text-sm hover:text-white transition-colors"
            >
              {isSignUp ? "Already have an account? Sign In" : "Don't have an account? Sign Up"}
            </button>
          </div>
        </motion.div>
      </div>

      {/* PWA Install Promo Modal specifically on Login Page */}
      <AnimatePresence>
        {showInstallPrompt && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowInstallPrompt(false)}
              className="absolute inset-0 bg-black/85 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, y: 50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 50, opacity: 0 }}
              className="relative w-full max-w-md bg-surface border border-white/10 rounded-[32px] p-8 shadow-2xl overflow-hidden glass-card text-center"
            >
              <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 blur-[80px] rounded-full -z-10" />
              
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary mx-auto mb-6 shadow-lg shadow-primary/20">
                <Smartphone size={32} className="animate-pulse" />
              </div>
              
              <h3 className="text-2xl font-black text-white mb-2 tracking-tight">SmartSpend AI App</h3>
              <p className="text-gray-400 text-sm mb-6 leading-relaxed">
                Install our official app on your homescreen for quick offline access, real-time AI tips, and a premium standalone experience.
              </p>

              <div className="flex gap-4">
                <button 
                  onClick={() => setShowInstallPrompt(false)}
                  className="flex-1 h-14 rounded-2xl bg-white/5 text-gray-300 font-semibold hover:bg-white/10 active:scale-95 transition-all cursor-pointer border border-white/5"
                >
                  Later
                </button>
                <button 
                  onClick={handleInstallClick}
                  className="flex-1 h-14 rounded-2xl bg-primary text-white font-semibold hover:bg-primary/95 shadow-lg shadow-primary/20 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2 border border-white/10"
                >
                  <Download size={18} />
                  Install App
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

