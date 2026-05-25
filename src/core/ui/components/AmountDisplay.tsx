import React, { useState, useEffect } from 'react';
import clsx from 'clsx';

interface AmountDisplayProps {
  value: number;
  type?: 'debit' | 'credit' | 'neutral';
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl' | '2xl';
  animate?: boolean;
  className?: string;
}

export function AmountDisplay({
  value,
  type = 'neutral',
  size = 'md',
  animate = true,
  className
}: AmountDisplayProps) {
  const [displayValue, setDisplayValue] = useState(animate ? 0 : value);

  useEffect(() => {
    if (!animate) {
      setDisplayValue(value);
      return;
    }

    let startTime: number;
    const startValue = displayValue;
    const duration = 1000; // 1s animation

    const animateCount = (time: number) => {
      if (!startTime) startTime = time;
      const progress = Math.min((time - startTime) / duration, 1);
      const easeProgress = 1 - Math.pow(1 - progress, 4); // Quartic ease out
      setDisplayValue(startValue + (value - startValue) * easeProgress);

      if (progress < 1) {
        requestAnimationFrame(animateCount);
      }
    };
    requestAnimationFrame(animateCount);
  }, [value, animate]);

  const formattedAmount = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(displayValue);

  const sizeClasses = {
    xs: 'text-sm font-bold font-mono',
    sm: 'text-base font-bold font-mono',
    md: 'text-xl font-extrabold font-mono',
    lg: 'text-2xl font-black font-mono tracking-tight',
    xl: 'text-4xl font-black font-mono tracking-tight',
    '2xl': 'text-5xl md:text-6xl font-black font-mono tracking-tighter'
  };

  const typeClasses = {
    debit: 'text-[#FF4757] drop-shadow-[0_0_10px_rgba(255,71,87,0.15)]',
    credit: 'text-[#2ED573] drop-shadow-[0_0_10px_rgba(46,213,115,0.15)]',
    neutral: 'text-white'
  };

  return (
    <span className={clsx(
      "inline-block font-sans select-none",
      sizeClasses[size],
      typeClasses[type],
      className
    )}>
      {type === 'debit' && value > 0 && '- '}
      {type === 'credit' && value > 0 && '+ '}
      {formattedAmount}
    </span>
  );
}
