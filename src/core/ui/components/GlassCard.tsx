import React from 'react';
import { motion } from 'motion/react';
import clsx from 'clsx';

interface GlassCardProps {
  children: React.ReactNode;
  className?: string;
  glowColor?: 'primary' | 'success' | 'error' | 'warning' | 'indigo' | 'none';
  onClick?: () => void;
  hoverEffect?: boolean;
}

export function GlassCard({
  children,
  className,
  glowColor = 'none',
  onClick,
  hoverEffect = true
}: GlassCardProps) {
  const glowClasses = {
    primary: 'shadow-[0_0_30px_rgba(99,102,241,0.12)] border-primary/20',
    success: 'shadow-[0_0_30px_rgba(16,185,129,0.12)] border-success/20',
    error: 'shadow-[0_0_30px_rgba(244,63,94,0.12)] border-error/20',
    warning: 'shadow-[0_0_30px_rgba(245,158,11,0.12)] border-warning/20',
    indigo: 'shadow-[0_0_30px_rgba(124,92,252,0.15)] border-[#7C5CFC]/30',
    none: 'border-white/[0.05] shadow-[0_8px_32px_0_rgba(0,0,0,0.37)]'
  };

  const Component = onClick ? motion.button : motion.div;

  return (
    <Component
      onClick={onClick}
      whileHover={hoverEffect && onClick ? { scale: 0.98, y: -2 } : hoverEffect ? { y: -2 } : undefined}
      whileTap={onClick ? { scale: 0.96 } : undefined}
      className={clsx(
        "relative rounded-[2rem] bg-gradient-to-b from-white/[0.03] to-transparent backdrop-blur-2xl border text-left p-6 transition-all duration-300 overflow-hidden",
        glowClasses[glowColor],
        onClick && 'cursor-pointer',
        className
      )}
    >
      {/* Dynamic light refraction glow inside card */}
      <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/[0.01] to-transparent pointer-events-none" />
      {children}
    </Component>
  );
}
