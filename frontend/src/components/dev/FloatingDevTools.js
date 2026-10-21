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
      showStatus(`✅ Scheduler Ran: Auto-approved: ${res.data?.autoApprovedCount || 0}, SOS escalated: ${res.data?.escalatedCount || 0}, Ratings requested: ${res.data?.ratingsRequestedCount || 0}`);
    } catch (err) {
      showStatus('❌ Scheduler failed: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleAgeSos = async (seconds) => {
    if (!escrowIdInput.trim()) {
      showStatus('⚠️ नीचे SOS Incident ID दर्ज करें');
      return;
    }
    setLoadingAction(`age-${seconds}`);
    try {
      const res = await api.post(`/dev/incidents/${escrowIdInput.trim()}/age`, { seconds });
      showStatus(`✅ SOS incident aged by ${seconds}s (escalation clock shifted)!`);
    } catch (err) {
      showStatus('❌ Age failed: ' + err.message);
    } finally {
      setLoadingAction('');
    }
  };

  const handleQuickSwitch = async (phone, role) => {
    setLoadingAction(`switch-${phone}`);
    try {
      const res = await api.post('/auth/dev-login', { phone });
      if (res.data?.token && res.data?.user) {
        useAuthStore.getState().setAuth(res.data.user, res.data.token);
        showStatus(`✅ Switched to ${res.data.user.name} (${role})`);
        if (role === 'contractor') {
          window.location.href = '/contractor/dashboard';
        } else if (role === 'admin') {
          window.location.href = '/admin/incidents';
        } else {
          window.location.href = '/worker/dashboard';
        }
      }
    } catch (err) {
      showStatus('❌ Switch failed: ' + err.message);
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
        <div className="bg-slate-900 border border-purple-500/50 rounded-2xl p-4 shadow-2xl w-80 space-y-3 text-slate-100 max-h-[85vh] overflow-y-auto">
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

          {/* Quick Role Switcher */}
          <div className="space-y-1.5">
            <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">त्वरित लॉगिन (Quick Switch)</span>
            <div className="grid grid-cols-2 gap-1.5">
              <button
                onClick={() => handleQuickSwitch('+919000000001', 'worker')}
                disabled={!!loadingAction}
                className="py-1 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-[11px] font-bold text-emerald-300 text-left truncate"
              >
                👷 W1 (Rater/SOS)
              </button>
              <button
                onClick={() => handleQuickSwitch('+919000000002', 'worker')}
                disabled={!!loadingAction}
                className="py-1 px-2 bg-emerald-600/20 hover:bg-emerald-600/30 border border-emerald-500/30 rounded-lg text-[11px] font-bold text-emerald-300 text-left truncate"
              >
                👷 W2 (Coworker)
              </button>
              <button
                onClick={() => handleQuickSwitch('+919000000100', 'contractor')}
                disabled={!!loadingAction}
                className="py-1 px-2 bg-indigo-600/20 hover:bg-indigo-600/30 border border-indigo-500/30 rounded-lg text-[11px] font-bold text-indigo-300 text-left truncate"
              >
                🏢 Contractor
              </button>
              <button
                onClick={() => handleQuickSwitch('+919000000900', 'admin')}
                disabled={!!loadingAction}
                className="py-1 px-2 bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/30 rounded-lg text-[11px] font-bold text-purple-300 text-left truncate"
              >
                🛡️ Admin
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2 pt-1 border-t border-slate-800">
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
              Run Safety/Escrow Scheduler
            </button>

            {/* Escrow & SOS Aging controls */}
            <div className="pt-1 space-y-1.5">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400">Escrow ID / SOS ID</span>
              <input
                type="text"
                placeholder="Escrow ID या Incident ID..."
                value={escrowIdInput}
                onChange={(e) => setEscrowIdInput(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-white placeholder-slate-500 focus:outline-none"
              />
              <div className="grid grid-cols-3 gap-1">
                <button
                  onClick={handleExpireApproval}
                  disabled={loadingAction === 'expire'}
                  className="py-1 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-lg text-[10px]"
                >
                  Expire Escrow
                </button>
                <button
                  onClick={() => handleAgeSos(90)}
                  disabled={loadingAction === 'age-90'}
                  className="py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-[10px]"
                >
                  Age SOS 90s
                </button>
                <button
                  onClick={() => handleAgeSos(360)}
                  disabled={loadingAction === 'age-360'}
                  className="py-1 bg-rose-700 hover:bg-rose-600 text-white font-bold rounded-lg text-[10px]"
                >
                  Age SOS 6m
                </button>
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="border-t border-slate-800 pt-2 grid grid-cols-3 gap-1 text-[11px] text-slate-400 font-semibold text-center">
            <Link
              href="/admin/incidents"
              onClick={() => setIsOpen(false)}
              className="hover:text-purple-300 p-1 rounded bg-slate-800/50"
            >
              Incidents
            </Link>
            <Link
              href="/admin/ratings"
              onClick={() => setIsOpen(false)}
              className="hover:text-purple-300 p-1 rounded bg-slate-800/50"
            >
              Ratings
            </Link>
            <Link
              href="/admin/safety"
              onClick={() => setIsOpen(false)}
              className="hover:text-purple-300 p-1 rounded bg-slate-800/50"
            >
              Safety Stats
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
