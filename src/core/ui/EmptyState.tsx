import { HelpCircle, Plus } from 'lucide-react';
import { motion } from 'motion/react';

interface EmptyStateProps {
  title: string;
  description: string;
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, description, actionLabel, onAction }: EmptyStateProps) {
  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="py-12 px-6 bg-surface/50 border border-dashed border-white/10 rounded-[32px] flex flex-col items-center justify-center text-center w-full"
    >
      <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 mb-4">
        <HelpCircle size={24} />
      </div>
      <h4 className="text-white font-bold text-sm mb-1">{title}</h4>
      <p className="text-gray-400 text-xs max-w-[240px] leading-relaxed mb-6">{description}</p>
      
      {actionLabel && onAction && (
        <button
          onClick={onAction}
          className="flex items-center gap-1.5 px-4 py-2.5 bg-primary hover:bg-primary/90 active:scale-95 text-white text-[10px] font-black uppercase tracking-widest rounded-xl transition-all cursor-pointer shadow-lg shadow-primary/20"
        >
          <Plus size={12} />
          <span>{actionLabel}</span>
        </button>
      )}
    </motion.div>
  );
}
