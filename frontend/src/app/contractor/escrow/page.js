'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import api from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useAuthStore } from '../../../store/authStore';
import { formatRupees } from '../../../lib/utils';
import {
  ShieldCheck,
  Lock,
  Wallet,
  Clock,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Filter,
} from 'lucide-react';
import Link from 'next/link';

const STATUS_STYLES = {
  CREATED: { label: 'Unfunded', bg: 'bg-slate-800 text-slate-300 border-slate-700' },
  FUNDED: { label: 'Funded (Locked)', bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  CHECKED_IN: { label: 'Checked In', bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  CHECKED_OUT: { label: 'Checked Out', bg: 'bg-amber-500/10 text-amber-300 border-amber-500/30' },
  APPROVED: { label: 'Approved', bg: 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30' },
  RELEASED: { label: 'Released', bg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40' },
  DISPUTED: { label: 'Disputed', bg: 'bg-red-500/10 text-red-400 border-red-500/30' },
  REFUNDED: { label: 'Refunded', bg: 'bg-purple-500/10 text-purple-300 border-purple-500/30' },
  CANCELLED: { label: 'Cancelled', bg: 'bg-slate-800 text-slate-400 border-slate-700' },
};

export default function ContractorEscrowPage() {
  const { user } = useAuthStore();
  const [escrows, setEscrows] = useState([]);
  const [wallet, setWallet] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [actionError, setActionError] = useState('');

  const fetchEscrows = useCallback(async () => {
    try {
      setIsLoading(true);
      const [escrowRes, walletRes] = await Promise.all([
        api.get('/escrow/me'),
        api.get('/wallet/me'),
      ]);

      if (escrowRes.data) setEscrows(escrowRes.data);
      if (walletRes.data) setWallet(walletRes.data);
    } catch (err) {
      console.error('Failed to load escrows:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEscrows();

    const socket = getSocket();
    if (socket && user?._id) {
      socket.emit('join:user', user._id);
      socket.on('escrow:funded', fetchEscrows);
      socket.on('payment:released', fetchEscrows);
      socket.on('payment:refunded', fetchEscrows);

      return () => {
        socket.off('escrow:funded', fetchEscrows);
        socket.off('payment:released', fetchEscrows);
        socket.off('payment:refunded', fetchEscrows);
      };
    }
  }, [fetchEscrows, user]);

  const handleRelease = async (escrowId) => {
    setActionError('');
    try {
      await api.post(`/escrow/${escrowId}/release`, {});
      fetchEscrows();
    } catch (err) {
      setActionError(err.message || 'भुगतान जारी नहीं हो सका।');
    }
  };

  const filteredEscrows = escrows.filter((item) => {
    if (filter === 'ALL') return true;
    if (filter === 'ACTIVE') {
      return ['FUNDED', 'CHECKED_IN', 'CHECKED_OUT', 'APPROVED'].includes(item.status);
    }
    if (filter === 'COMPLETED') return item.status === 'RELEASED';
    if (filter === 'DISPUTED') return item.status === 'DISPUTED';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-24 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">एस्क्रो प्रबंधन (Escrow)</h1>
              <p className="text-xs text-slate-400">दैनिक सुरक्षित भुगतान मील के पत्थर</p>
            </div>
          </div>
          <button
            onClick={fetchEscrows}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        {/* Locked Overview Banner */}
        <Card className="p-4 bg-gradient-to-r from-blue-950/60 to-slate-900 border-blue-900/40 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-blue-300 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5" />
              वर्तमान में एस्क्रो में सुरक्षित
            </span>
            <p className="text-2xl font-black text-white mt-1 font-mono">
              {formatRupees(wallet?.lockedPaise || 0)}
            </p>
          </div>
          <Link
            href="/contractor/wallet"
            className="px-3 py-1.5 bg-blue-600/30 border border-blue-500/50 hover:bg-blue-600/40 text-blue-200 text-xs font-semibold rounded-lg flex items-center gap-1 transition-all"
          >
            वॉलेट देखें
            <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </Card>

        {actionError && (
          <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
            <span>{actionError}</span>
          </div>
        )}

        {/* Filter Tabs */}
        <div className="flex gap-1.5 overflow-x-auto text-xs">
          {[
            { id: 'ALL', label: 'सभी (All)' },
            { id: 'ACTIVE', label: 'सक्रिय (Active)' },
            { id: 'COMPLETED', label: 'रिलीज़्ड (Paid)' },
            { id: 'DISPUTED', label: 'विवादित (Disputed)' },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilter(tab.id)}
              className={`py-1.5 px-3 rounded-lg font-medium transition-all ${
                filter === tab.id
                  ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-500/20'
                  : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Escrow Items List */}
        {filteredEscrows.length === 0 ? (
          <Card className="text-center py-10 space-y-2 border-dashed border-slate-800">
            <Clock className="w-8 h-8 text-slate-600 mx-auto" />
            <p className="text-sm font-medium text-slate-400">कोई एस्क्रो रिकॉर्ड नहीं मिला</p>
            <p className="text-xs text-slate-500">
              जब कोई काम असाइन और फंड होगा, यहाँ दैनिक एस्क्रो मील के पत्थर दिखेंगे।
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {filteredEscrows.map((row) => {
              const statusCfg = STATUS_STYLES[row.status] || STATUS_STYLES.CREATED;
              const canRelease = row.status === 'CHECKED_OUT' || row.status === 'APPROVED';

              return (
                <Card
                  key={row._id}
                  className="p-4 bg-slate-900 border-slate-800/80 space-y-3 hover:border-slate-700/80 transition-all"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="text-xs font-bold text-white">
                        {row.job?.title || 'Job Milestone'}
                      </h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">
                        तारीख: <span className="text-slate-300 font-mono">{row.dayDate}</span> • श्रमिक: {row.worker?.name || 'Assigned Worker'}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-sm font-bold text-white font-mono">
                        {formatRupees(row.amountPaise)}
                      </div>
                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold inline-block mt-1 ${statusCfg.bg}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>
                  </div>

                  {row.autoApprovalAt && row.status === 'CHECKED_OUT' && (
                    <div className="p-2 bg-amber-950/30 border border-amber-900/40 rounded-lg flex items-center gap-1.5 text-[11px] text-amber-300">
                      <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                      <span>
                        स्वतः मंज़ूरी:{' '}
                        {new Date(row.autoApprovalAt).toLocaleTimeString('hi-IN', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                  )}

                  {canRelease && (
                    <div className="flex gap-2 pt-1 border-t border-slate-800/60">
                      <Button
                        variant="primary"
                        onClick={() => handleRelease(row._id)}
                        className="flex-1 py-1.5 text-xs bg-emerald-600 hover:bg-emerald-500 font-semibold rounded-lg"
                      >
                        भुगतान रिलीज़ करें (Approve & Pay)
                      </Button>
                      <Link
                        href={`/contractor/jobs/${row.job?._id || row.job}/attendance`}
                        className="py-1.5 px-3 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs font-semibold flex items-center justify-center transition-colors"
                      >
                        हाज़िरी
                      </Link>
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav role="contractor" />
    </div>
  );
}
