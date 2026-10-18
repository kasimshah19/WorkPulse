import React from 'react';
import Link from 'next/link';
import { HardHat, Globe } from 'lucide-react';

export function Navbar() {
  return (
    <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
      <div className="max-w-md mx-auto flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2 group">
          <div className="w-10 h-10 rounded-xl bg-brand-500 flex items-center justify-center text-white shadow-md shadow-brand-500/20">
            <HardHat className="w-6 h-6" />
          </div>
          <div>
            <span className="text-xl font-black tracking-tight text-white flex items-center">
              Work<span className="text-brand-500">Pulse</span>
            </span>
          </div>
        </Link>

        {/* Language selector stub */}
        <button
          aria-label="Change Language"
          className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 border border-slate-700 text-xs font-semibold text-slate-200 min-h-[40px] hover:bg-slate-700"
        >
          <Globe className="w-4 h-4 text-brand-500" />
          <span>हिं / EN</span>
        </button>
      </div>
    </header>
  );
}
