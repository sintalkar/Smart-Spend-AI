import { motion } from 'motion/react';
import { Wrench, RefreshCw } from 'lucide-react';

interface Props {
  message: string;
}

export function MaintenanceScreen({ message }: Props) {
  return (
    <div className="fixed inset-0 z-[200] bg-[#070709] flex items-center justify-center p-6">
      <div className="absolute inset-0 bg-gradient-to-br from-yellow-500/5 via-transparent to-transparent pointer-events-none" />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="text-center max-w-sm"
      >
        <motion.div
          animate={{ rotate: [0, -10, 10, -10, 0] }}
          transition={{ repeat: Infinity, repeatDelay: 3, duration: 0.5 }}
          className="w-20 h-20 bg-yellow-500/10 border border-yellow-500/20 rounded-3xl flex items-center justify-center mx-auto mb-6"
        >
          <Wrench size={36} className="text-yellow-400" />
        </motion.div>

        <h1 className="text-2xl font-black text-white mb-3">Under Maintenance</h1>
        <p className="text-sm text-white/50 leading-relaxed mb-8">
          {message || 'The app is currently under maintenance. Please check back soon.'}
        </p>

        <button
          onClick={() => window.location.reload()}
          className="flex items-center gap-2 mx-auto px-6 py-3 bg-white/5 border border-white/10 rounded-2xl text-sm font-bold text-white/60 hover:text-white hover:bg-white/10 transition-all"
        >
          <RefreshCw size={14} /> Try again
        </button>
      </motion.div>
    </div>
  );
}
