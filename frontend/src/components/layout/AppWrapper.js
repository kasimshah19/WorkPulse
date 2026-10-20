'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/authStore';
import { Navbar } from './Navbar';
import { FloatingDevTools } from '../dev/FloatingDevTools';

export function AppWrapper({ children }) {
  const initAuth = useAuthStore((state) => state.initAuth);

  useEffect(() => {
    initAuth();
  }, [initAuth]);

  return (
    <div className="flex flex-col min-h-screen bg-slate-950">
      <Navbar />
      <main className="flex-1 w-full max-w-md mx-auto">{children}</main>
      <FloatingDevTools />
    </div>
  );
}
