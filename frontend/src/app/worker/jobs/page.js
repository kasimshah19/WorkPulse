'use client';

import React from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Briefcase } from 'lucide-react';

export default function WorkerJobsPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">उपलब्ध काम (Nearby Jobs)</h1>
            <p className="text-xs text-slate-400">TODO Phase 2: Geo-radius job matching</p>
          </div>
        </div>

        <Card className="text-center py-12 space-y-2">
          <p className="text-sm text-slate-300 font-semibold">कोई सक्रिय काम नहीं (No active jobs)</p>
          <p className="text-xs text-slate-500">
            TODO Phase 2: Live nearby jobs feed based on worker GPS location and skills.
          </p>
        </Card>
      </main>

      <BottomNav role="worker" />
    </div>
  );
}
