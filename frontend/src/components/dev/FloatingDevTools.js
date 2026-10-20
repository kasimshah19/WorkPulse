'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import api from '../../lib/api';
import { useAuthStore } from '../../store/authStore';
import { Wrench, X, Zap, Clock, ShieldCheck, RefreshCw, UserCheck } from 'lucide-react';

export function FloatingDevTools() {
  const [isOpen, setIsOpen] = useState(false);
  const [loadingAction, setLoadingAction] = useState('');
  const [statusMsg, setStatusMsg] = useState('');
  const [escrowIdInput, setEscrowIdInput] = useState('');
  const { user } = useAuthStore();

  const isDevMode = process.env.NEXT_PUBLIC_DEV_MODE !== 'false';
  if (!isDevMode) return null;

  const showStatus = (msg) => {
    setStatusMsg(msg);
    setTimeout(() => setStatusMsg(''), 4000);
  };

  const handleDevTopup = async () => {
    setLoadingAction('topup');
    try {
      const res = await api.post('/dev/wallet/topup', { amountPaise: 500000 });
      showStatus('✅ ₹5,000 वॉलेट में जमा हो गए!');
    } catch (err) {
      showStatus('❌ Topup failed: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleExpireApproval = async () => {
    if (!escrowIdInput.trim()) {
      showStatus('⚠️ कृपया Escrow ID दर्ज करें');
      return;
    }
    setLoadingAction('expire');
    try {
      await api.post(`/dev/escrow/${escrowIdInput.trim()}/expire-approval`);
      showStatus('✅ Auto-approval Expired in DB!');
    } catch (err) {
      showStatus('❌ Expire failed: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleRunScheduler = async () => {
    setLoadingAction('scheduler');
    try {
      const res = await api.post('/dev/scheduler/run');
      showStatus(`✅ Scheduler Ran: ${res.data?.autoApprovedCount || 0} approved`);
    } catch (err) {
      showStatus('❌ Scheduler failed: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  return (
    <div className="fixed bottom-20 right-4 z-50">
      {!isOpen ? (
        <button
          onClick={() => setIsOpen(true)}
          className="w-11 h-11 rounded-full bg-purple-600 hover:bg-purple-500 text-white shadow-xl flex items-center justify-center border-2 border-purple-400 active:scale-95 transition-transform"
          title="Open Dev Tools"
        >
          <Wrench className="w-5 h-5" />
        </button>
      ) : (
        <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-4 shadow-2xl w-72 space-y-3 text-slate-100">
          <div className="flex items-center justify-between border-b border-slate-800 pb-2">
            <div className="flex items-center gap-1.5 text-xs font-black text-purple-400">
              <Zap className="w-4 h-4" />
              <span>WorkPulse Dev Panel</span>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-slate-400 hover:text-white p-1"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {statusMsg && (
            <div className="text-[11px] p-2 rounded-lg bg-slate-800 text-amber-300 font-medium">
              {statusMsg}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2">
            <button
              onClick={handleDevTopup}
              disabled={loadingAction === 'topup'}
              className="w-full py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <Zap className="w-3.5 h-3.5" />
              {loadingAction === 'topup' ? 'Top-up जारी...' : 'Dev Top-up ₹5,000'}
            </button>

            <button
              onClick={handleRunScheduler}
              disabled={loadingAction === 'scheduler'}
              className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingAction === 'scheduler' ? 'animate-spin' : ''}`} />
              Run Scheduler Now
            </button>

            <div className="pt-1">
              <div className="flex gap-1">
                <input
                  type="text"
                  placeholder="Escrow ID..."
                  value={escrowIdInput}
                  onChange={(e) => setEscrowIdInput(e.target.value)}
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-[11px] font-mono text-white placeholder-slate-500 focus:outline-none"
                />
                <button
                  onClick={handleExpireApproval}
                  disabled={loadingAction === 'expire'}
                  className="px-2 py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[10px] shrink-0"
                >
                  Expire
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="border-t border-slate-800 pt-2 flex items-center justify-between text-[11px] text-slate-400 font-semibold">
            <Link
              href="/dev/login"
              onClick={() => setIsOpen(false)}
              className="hover:text-purple-300 flex items-center gap-1"
            >
              <UserCheck className="w-3 h-3" />
              Dev Login
            </Link>
            <Link
              href="/admin/disputes"
              onClick={() => setIsOpen(false)}
              className="hover:text-purple-300 flex items-center gap-1"
            >
              <ShieldCheck className="w-3 h-3" />
              Admin
            </Link>
            <Link
              href="/admin/ledger"
              onClick={() => setIsOpen(false)}
              className="hover:text-purple-300 flex items-center gap-1"
            >
              Ledger
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
