import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Sparkles, ShieldCheck, ChevronRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
}

export default function OnboardingScreen({ onComplete }: OnboardingProps) {
  const [step, setStep] = useState(0);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  const steps = [
    {
      icon: MessageSquare,
      title: "Smart Detection",
      desc: "We read transaction SMS to save you time. We automatically detect your spends so you don't have to.",
      color: "text-primary",
      bg: "bg-primary/10"
    },
    {
      icon: Sparkles,
      title: "AI Powered",
      desc: "Our AI categorizes expenses and generates smart insights for you base on your spending habits.",
      color: "text-secondary",
      bg: "bg-secondary/10"
    },
    {
      icon: ShieldCheck,
      title: "Your Privacy",
      desc: "All data stays on your phone. Nothing leaves your device. You're always in control.",
      color: "text-success",
      bg: "bg-success/10"
    }
  ];

  const handleNext = () => {
    if (step < steps.length - 1) {
      setStep(prev => prev + 1);
    } else {
      setShowPermissionDialog(true);
    }
  };

  const finishOnboarding = () => {
    localStorage.setItem('has_seen_onboarding', 'true');
    // Mock requesting notification permission
    if ('Notification' in window) {
      Notification.requestPermission();
    }
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col pt-safe pb-safe">
      <div className="flex-1 flex flex-col justify-center items-center p-6 relative">
        <AnimatePresence mode="wait">
          {!showPermissionDialog ? (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center max-w-sm"
            >
              <div className={`w-32 h-32 rounded-full ${steps[step].bg} flex items-center justify-center mb-8 relative`}>
                <div className={`absolute inset-0 rounded-full blur-2xl opacity-50 ${steps[step].bg}`} />
                {(() => {
                  const Icon = steps[step].icon;
                  return <Icon size={48} className={`relative z-10 ${steps[step].color}`} />;
                })()}
              </div>
              <h1 className="title-bold text-3xl mb-4">{steps[step].title}</h1>
              <p className="text-gray-400 text-lg leading-relaxed">{steps[step].desc}</p>
            </motion.div>
          ) : (
            <motion.div
              key="permission"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-surface border border-white/10 rounded-3xl p-6 w-full max-w-sm shadow-2xl"
            >
              <h2 className="title-bold text-xl mb-3">Permissions Needed</h2>
              <p className="text-sm text-gray-300 mb-6 leading-relaxed">
                To enable auto-tracking, we need permission to read your SMS and Notifications. We only look for transaction messages like those from your bank or UPI apps.
              </p>
              <div className="space-y-3 mb-6">
                 <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3">
                    <MessageSquare size={18} className="text-primary" />
                    <span className="text-sm font-medium">SMS Access</span>
                 </div>
                 <div className="p-3 bg-white/5 rounded-xl flex items-center gap-3">
                    <div className="w-5 h-5 rounded flex justify-center items-center bg-[#00D4AA]/20 text-[#00D4AA]">🔔</div>
                    <span className="text-sm font-medium">Notification Access</span>
                 </div>
              </div>
              <p className="text-xs text-gray-500 mb-6 italic text-center">
                Denying permissions is fine! You can still use the app with Manual Entry.
              </p>
              <div className="flex flex-col gap-3">
                <button onClick={finishOnboarding} className="w-full bg-primary hover:bg-primary/90 text-white font-bold py-3.5 rounded-full transition-colors active:scale-95">
                  Grant Permissions
                </button>
                <button onClick={finishOnboarding} className="w-full bg-surface border border-white/10 hover:bg-white/5 text-gray-300 font-bold py-3.5 rounded-full transition-colors active:scale-95">
                  Not Now
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {!showPermissionDialog && (
        <div className="p-6 pb-10 flex flex-col items-center">
          <div className="flex gap-2 mb-8">
            {steps.map((_, i) => (
              <div
                key={i}
                className={`h-2 rounded-full transition-all duration-300 ${
                  i === step ? 'w-8 bg-primary' : 'w-2 bg-white/20'
                }`}
              />
            ))}
          </div>
          <button
            onClick={handleNext}
            className="w-full max-w-sm bg-primary hover:bg-primary/90 text-white font-bold py-4 rounded-full transition-transform active:scale-95 flex items-center justify-center gap-2"
          >
            {step === steps.length - 1 ? "Let's Begin" : "Continue"}
            <ChevronRight size={20} />
          </button>
        </div>
      )}
    </div>
  );
}
