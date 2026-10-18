'use client';

import React from 'react';
import Link from 'next/link';
import { HardHat, LogOut, User } from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { useSocketStore } from '../../store/socketStore';
import { useSocket } from '../../hooks/useSocket';
import { AlertToast } from '../ui/AlertToast';

export function Navbar() {
  const { user, isAuthenticated, logout } = useAuthStore();
  const { isConnected } = useSocketStore();

  // Initialize socket lifecycle listener
  useSocket();

  return (
    <>
      <AlertToast />
      <header className="sticky top-0 z-40 bg-slate-900/95 backdrop-blur border-b border-slate-800 px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-md shadow-blue-500/20">
              <HardHat className="w-6 h-6" />
            </div>
            <div>
              <span className="text-xl font-black tracking-tight text-white flex items-center">
                Work<span className="text-blue-500">Pulse</span>
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {/* Live Socket Connection Dot */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-800 border border-slate-700 text-xs font-semibold"
              title={isConnected ? 'Live Socket Connected' : 'Socket Reconnecting...'}
            >
              <span
                className={`w-2.5 h-2.5 rounded-full ${
                  isConnected ? 'bg-emerald-500 shadow-sm shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'
                }`}
              />
              <span className="text-slate-300 text-[11px]">
                {isConnected ? 'Live' : 'Offline'}
              </span>
            </div>

            {isAuthenticated && user ? (
              <div className="flex items-center gap-2">
                <Link
                  href={user.role === 'contractor' ? '/contractor/dashboard' : '/worker/dashboard'}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-600/20 border border-blue-500/30 text-blue-400 text-xs font-bold"
                >
                  <User className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[80px]">{user.name?.split(' ')[0]}</span>
                </Link>

                <button
                  onClick={logout}
                  title="Logout"
                  className="p-1.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-400 hover:text-rose-400"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <Link
                href="/login"
                className="px-3 py-1.5 rounded-lg bg-blue-600 text-white font-bold text-xs shadow hover:bg-blue-500"
              >
                लॉगिन (Login)
              </Link>
            )}
          </div>
        </div>
      </header>
    </>
  );
}
