'use client';

import React from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { Card } from '../../../components/ui/Card';
import { ShieldAlert } from 'lucide-react';

export default function AdminDisputesPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-12">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-500 flex items-center justify-center">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">विवाद समाधान (Disputes)</h1>
            <p className="text-xs text-slate-400">TODO Phase 7 & 9: Admin dispute resolution</p>
          </div>
        </div>

        <Card className="text-center py-10 space-y-2">
          <p className="text-sm font-semibold text-slate-300">कोई सक्रिय विवाद नहीं</p>
          <p className="text-xs text-slate-500">
            TODO Phase 7 & 9: Review evidence, GPS check logs, and arbitrate payouts.
          </p>
        </Card>
      </main>
    </div>
  );
}
