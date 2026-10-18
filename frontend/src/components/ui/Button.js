import React from 'react';
import { cn } from '../../lib/utils';

export function Button({
  children,
  className,
  variant = 'primary',
  size = 'md',
  disabled = false,
  ...props
}) {
  const baseStyles =
    'inline-flex items-center justify-center font-bold rounded-xl transition-all duration-150 min-h-[48px] px-6 select-none focus:outline-none focus:ring-4 disabled:opacity-50 disabled:cursor-not-allowed active:scale-[0.98]';

  const variants = {
    primary:
      'bg-brand-500 hover:bg-brand-600 active:bg-brand-700 text-white shadow-lg shadow-brand-500/30 focus:ring-brand-500/50',
    secondary:
      'bg-slate-800 hover:bg-slate-700 text-slate-100 border border-slate-700 focus:ring-slate-600',
    outline:
      'bg-transparent hover:bg-slate-800 text-brand-500 border-2 border-brand-500 focus:ring-brand-500/30',
  };

  const sizes = {
    sm: 'text-sm py-2 px-4 min-h-[44px]',
    md: 'text-base py-3 px-6 min-h-[50px]',
    lg: 'text-lg py-4 px-8 min-h-[56px]',
  };

  return (
    <button
      className={cn(baseStyles, variants[variant], sizes[size], className)}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
