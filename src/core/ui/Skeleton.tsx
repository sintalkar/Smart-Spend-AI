import clsx from 'clsx';
import { motion } from 'motion/react';

interface SkeletonProps {
  className?: string;
  variant?: 'text' | 'circular' | 'rectangular';
}

export function Skeleton({ className, variant = 'rectangular' }: SkeletonProps) {
  return (
    <motion.div
      animate={{ opacity: [0.4, 0.7, 0.4] }}
      transition={{ repeat: Infinity, duration: 1.5, ease: "easeInOut" }}
      className={clsx(
        "bg-white/5 border border-white/5",
        {
          'rounded-md h-4': variant === 'text',
          'rounded-full': variant === 'circular',
          'rounded-3xl': variant === 'rectangular',
        },
        className
      )}
    />
  );
}
