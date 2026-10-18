import React from 'react';
import { cn } from '../../lib/utils';

export function BigIconButton({
  icon: Icon,
  title,
  subtitle,
  onClick,
  className,
  variant = 'primary',
}) {
  const variants = {
    primary:
      'bg-slate-800/90 border-2 border-brand-500/80 hover:border-brand-500 text-white shadow-xl hover:bg-slate-800',
    contractor:
      'bg-slate-800/90 border-2 border-blue-500/80 hover:border-blue-500 text-white shadow-xl hover:bg-slate-800',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center p-6 rounded-2xl w-full min-h-[140px] transition-all duration-200 active:scale-[0.97] group cursor-pointer text-center',
        variants[variant],
        className,
      )}
    >
      {Icon && (
        <div className="w-16 h-16 rounded-full bg-slate-700/60 flex items-center justify-center mb-3 group-hover:scale-110 transition-transform">
          <Icon className="w-9 h-9 text-brand-500 group-hover:text-brand-400" />
        </div>
      )}
      <span className="text-xl font-bold tracking-tight">{title}</span>
      {subtitle && <span className="text-xs text-slate-400 mt-1">{subtitle}</span>}
    </button>
  );
}
