'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { HardHat, Briefcase, CalendarCheck, Wallet } from 'lucide-react';

export default function WorkerDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-brand-500/20 text-brand-500 flex items-center justify-center">
            <HardHat className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">मजदूर डैशबोर्ड (Worker)</h1>
            <p className="text-xs text-slate-400">TODO Phase 1: Worker Profile & Verification</p>
          </div>
        </div>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">त्वरित नेविगेशन (Quick Links)</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/worker/jobs"
              className="p-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-slate-700 transition"
            >
              <Briefcase className="w-6 h-6 text-brand-500" />
              <span className="text-xs font-bold text-white">काम खोजें (Jobs)</span>
            </Link>

            <Link
              href="/worker/attendance"
              className="p-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-slate-700 transition"
            >
              <CalendarCheck className="w-6 h-6 text-green-500" />
              <span className="text-xs font-bold text-white">हाजिरी (Attendance)</span>
            </Link>

            <Link
              href="/worker/wallet"
              className="p-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-slate-700 transition col-span-2"
            >
              <Wallet className="w-6 h-6 text-yellow-500" />
              <span className="text-xs font-bold text-white">बटुआ और भुगतान (Wallet & Escrow)</span>
            </Link>
          </div>
        </Card>
      </main>

      <BottomNav role="worker" />
    </div>
  );
}
