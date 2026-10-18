import React from 'react';
import Link from 'next/link';
import { Briefcase, CalendarCheck, Wallet, User } from 'lucide-react';

export function BottomNav({ role = 'worker' }) {
  const items =
    role === 'worker'
      ? [
          { href: '/worker/jobs', label: 'Jobs', icon: Briefcase },
          { href: '/worker/attendance', label: 'Attendance', icon: CalendarCheck },
          { href: '/worker/wallet', label: 'Wallet', icon: Wallet },
          { href: '/worker/dashboard', label: 'Profile', icon: User },
        ]
      : [
          { href: '/contractor/dashboard', label: 'Home', icon: Briefcase },
          { href: '/contractor/post-job', label: 'Post Job', icon: CalendarCheck },
          { href: '/contractor/escrow', label: 'Escrow', icon: Wallet },
        ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 bg-slate-900 border-t border-slate-800 pb-safe">
      <div className="max-w-md mx-auto flex items-center justify-around h-16">
        {items.map((item) => {
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full text-slate-400 hover:text-brand-500 transition-colors focus:outline-none"
            >
              <Icon className="w-5 h-5 mb-1" />
              <span className="text-[11px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
