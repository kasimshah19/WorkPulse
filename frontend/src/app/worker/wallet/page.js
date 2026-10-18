'use client';

import React from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Wallet } from 'lucide-react';

export default function WorkerWalletPage() {
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-yellow-500/20 text-yellow-500 flex items-center justify-center">
            <Wallet className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">बटुआ और कमाई (Wallet)</h1>
            <p className="text-xs text-slate-400">TODO Phase 3: Escrow release and UPI payout</p>
          </div>
        </div>

        <Card className="text-center py-10 space-y-2">
          <p className="text-3xl font-black text-white">₹0.00</p>
          <p className="text-xs text-slate-400">उपलब्ध शेष राशि (Available Balance)</p>
          <p className="text-xs text-slate-500 pt-4">
            TODO Phase 3: Instant daily payouts via Razorpay/UPI upon contractor escrow release.
          </p>
        </Card>
      </main>

      <BottomNav role="worker" />
    </div>
  );
}
