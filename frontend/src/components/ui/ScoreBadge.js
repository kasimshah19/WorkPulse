'use client';

import React from 'react';
import { Star, Sparkles, ShieldCheck, CheckCircle2, AlertTriangle } from 'lucide-react';

export function ScoreBadge({ score = 0, count = 0, badge, size = 'md', onClick }) {
  // Compute badge if not provided
  let computedBadge = badge;
  if (!computedBadge) {
    if (count < 3) computedBadge = 'NEW';
    else if (score >= 4.2) computedBadge = 'GOOD';
    else if (score >= 3.4) computedBadge = 'OK';
    else computedBadge = 'LOW';
  }

  const badgeConfig = {
    NEW: {
      label: 'नया (New)',
      bg: 'bg-sky-500/15 border-sky-500/30 text-sky-400',
      icon: Sparkles,
      iconColor: 'text-sky-400',
    },
    GOOD: {
      label: 'भरोसेमंद (Good)',
      bg: 'bg-emerald-500/15 border-emerald-500/30 text-emerald-400',
      icon: ShieldCheck,
      iconColor: 'text-emerald-400',
    },
    OK: {
      label: 'सामान्य (Fair)',
      bg: 'bg-amber-500/15 border-amber-500/30 text-amber-400',
      icon: CheckCircle2,
      iconColor: 'text-amber-400',
    },
    LOW: {
      label: 'सावधान (Low)',
      bg: 'bg-rose-500/15 border-rose-500/30 text-rose-400',
      icon: AlertTriangle,
      iconColor: 'text-rose-400',
    },
  }[computedBadge] || {
    label: 'नया',
    bg: 'bg-slate-800 border-slate-700 text-slate-300',
    icon: Sparkles,
    iconColor: 'text-slate-400',
  };

  const BadgeIcon = badgeConfig.icon;
  const isSmall = size === 'sm';

  const content = (
    <div
      className={`inline-flex items-center gap-1.5 rounded-xl border font-bold transition-all ${
        badgeConfig.bg
      } ${
        isSmall
          ? 'px-2 py-0.5 text-[11px]'
          : 'px-3 py-1.5 text-xs min-h-[36px]'
      } ${onClick ? 'cursor-pointer hover:opacity-90 active:scale-95' : ''}`}
      onClick={onClick}
    >
      <BadgeIcon className={`${isSmall ? 'w-3 h-3' : 'w-4 h-4'} ${badgeConfig.iconColor} shrink-0`} />
      <span className="flex items-center gap-0.5 font-black text-amber-300">
        <Star className={`${isSmall ? 'w-2.5 h-2.5' : 'w-3.5 h-3.5'} fill-amber-400 text-amber-400`} />
        {count > 0 ? Number(score).toFixed(1) : '-'}
      </span>
      <span className="text-[10px] text-slate-400 font-medium">({count})</span>
      <span className="ml-0.5 text-[10px] font-semibold tracking-wide uppercase">{badgeConfig.label}</span>
    </div>
  );

  return content;
}

export default ScoreBadge;
