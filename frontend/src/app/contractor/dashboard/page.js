'use client';

import React from 'react';
import Link from 'next/link';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Building2, PlusCircle, ShieldCheck } from 'lucide-react';

export default function ContractorDashboardPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-blue-500/20 text-blue-500 flex items-center justify-center">
            <Building2 className="w-7 h-7" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">ठेकेदार डैशबोर्ड (Contractor)</h1>
            <p className="text-xs text-slate-400">TODO Phase 1 & 2: Contractor management</p>
          </div>
        </div>

        <Card className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">त्वरित क्रियाएँ (Actions)</h2>
          <div className="grid grid-cols-2 gap-3">
            <Link
              href="/contractor/post-job"
              className="p-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-slate-700 transition"
            >
              <PlusCircle className="w-6 h-6 text-brand-500" />
              <span className="text-xs font-bold text-white">नया काम पोस्ट करें (Post Job)</span>
            </Link>

            <Link
              href="/contractor/escrow"
              className="p-4 bg-slate-800 rounded-xl flex flex-col items-center justify-center text-center gap-2 hover:bg-slate-700 transition"
            >
              <ShieldCheck className="w-6 h-6 text-green-500" />
              <span className="text-xs font-bold text-white">एस्क्रो फंड (Escrow)</span>
            </Link>
          </div>
        </Card>
      </main>

      <BottomNav role="contractor" />
    </div>
  );
}
