'use client';

import React from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { PlusCircle } from 'lucide-react';

export default function PostJobPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-brand-500/20 text-brand-500 flex items-center justify-center">
            <PlusCircle className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">काम पोस्ट करें (Post Job)</h1>
            <p className="text-xs text-slate-400">TODO Phase 2: Skill, wage, location form</p>
          </div>
        </div>

        <Card className="space-y-4 py-8 text-center">
          <p className="text-xs text-slate-400">
            TODO Phase 2: Form with skillRequired, workersNeeded, wagePerDay, geofence radius.
          </p>

          <Button disabled className="w-full">
            काम प्रकाशित करें (Publish Job)
          </Button>
        </Card>
      </main>

      <BottomNav role="contractor" />
    </div>
  );
}
