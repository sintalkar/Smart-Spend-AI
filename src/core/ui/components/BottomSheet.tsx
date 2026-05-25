import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X } from 'lucide-react';
import { hapticFeedback } from '../../utils/haptics';

interface BottomSheetProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxHeight?: string;
}

export function BottomSheet({
  isOpen,
  onClose,
  title,
  children,
  maxHeight = 'max-h-[85vh]'
}: BottomSheetProps) {
  
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleClose = () => {
    hapticFeedback.light();
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          {/* Backdrop Overlay */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Sliding Sheet */}
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className={`relative w-full max-w-lg bg-gradient-to-b from-[#11101C] to-[#06070C] border-t border-white/10 rounded-t-[32px] overflow-hidden flex flex-col ${maxHeight} shadow-2xl z-10`}
          >
            {/* Header Drag Handle line */}
            <div className="w-12 h-1 bg-white/15 rounded-full mx-auto my-4 shrink-0" />

            {/* Header Bar */}
            {(title || onClose) && (
              <div className="px-6 pb-4 flex items-center justify-between shrink-0">
                {title ? (
                  <h3 className="text-lg font-extrabold text-white font-display tracking-tight leading-none">
                    {title}
                  </h3>
                ) : <div />}
                <button
                  onClick={handleClose}
                  className="w-8 h-8 rounded-full bg-white/5 border border-white/5 flex items-center justify-center text-gray-500 hover:text-white transition-colors cursor-pointer"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            {/* Content Scrolling Window */}
            <div className="flex-1 overflow-y-auto px-6 pb-12 no-scrollbar">
              {children}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
