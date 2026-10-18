import React from 'react';
import { cn } from '../../lib/utils';

export function Card({ children, className, ...props }) {
  return (
    <div
      className={cn(
        'bg-slate-900/90 backdrop-blur-sm border border-slate-800 rounded-2xl p-6 shadow-xl',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
