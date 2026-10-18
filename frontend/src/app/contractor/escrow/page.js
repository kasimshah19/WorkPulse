'use client';

import React from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { ShieldCheck } from 'lucide-react';

export default function ContractorEscrowPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-500/20 text-green-500 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">एस्क्रो प्रबंधन (Escrow)</h1>
            <p className="text-xs text-slate-400">TODO Phase 3: Fund & approve contractor escrows</p>
          </div>
        </div>

        <Card className="text-center py-10 space-y-2">
          <p className="text-sm font-semibold text-slate-200">सुरक्षित एस्क्रो खाता</p>
          <p className="text-xs text-slate-400">
            TODO Phase 3: Razorpay deposit orders, auto-hold funds until work completion.
          </p>
        </Card>
      </main>

      <BottomNav role="contractor" />
    </div>
  );
}
