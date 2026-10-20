'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import { TopupModal } from '../../../components/payments/TopupModal';
import api from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useAuthStore } from '../../../store/authStore';
import { formatRupees } from '../../../lib/utils';
import {
  Wallet,
  Lock,
  ArrowUpRight,
  ArrowDownLeft,
  PlusCircle,
  ShieldCheck,
  RefreshCw,
  Clock,
  ExternalLink,
  ChevronRight,
  Layers,
} from 'lucide-react';
import Link from 'next/link';

export default function ContractorWalletPage() {
  const { user } = useAuthStore();
  const [wallet, setWallet] = useState({ balancePaise: 0, lockedPaise: 0 });
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [filterTab, setFilterTab] = useState('ALL');

  const fetchWalletData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [walletRes, ledgerRes] = await Promise.all([
        api.get('/wallet/me'),
        api.get('/wallet/ledger?limit=30'),
      ]);

      if (walletRes.data) {
        setWallet(walletRes.data);
      }
      if (ledgerRes.data) {
        setLedgerEntries(ledgerRes.data);
      }
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchWalletData();

    const socket = getSocket();
    if (socket && user?._id) {
      socket.emit('join:user', user._id);

      const handleBalanceUpdate = (data) => {
        setWallet((prev) => ({
          balancePaise: data.balancePaise !== undefined ? data.balancePaise : prev.balancePaise,
          lockedPaise: data.lockedPaise !== undefined ? data.lockedPaise : prev.lockedPaise,
        }));
        fetchWalletData();
      };

      socket.on('wallet:balance', handleBalanceUpdate);
      socket.on('escrow:funded', fetchWalletData);
      socket.on('payment:released', fetchWalletData);
      socket.on('payment:refunded', fetchWalletData);

      return () => {
        socket.off('wallet:balance', handleBalanceUpdate);
        socket.off('escrow:funded', fetchWalletData);
        socket.off('payment:released', fetchWalletData);
        socket.off('payment:refunded', fetchWalletData);
      };
    }
  }, [fetchWalletData, user]);

  const filteredEntries = ledgerEntries.filter((item) => {
    if (filterTab === 'ALL') return true;
    if (filterTab === 'TOPUP') return item.referenceType === 'TOPUP';
    if (filterTab === 'ESCROW') return item.account === 'ESCROW_HOLD';
    if (filterTab === 'REFUND') return item.referenceType === 'ESCROW_REFUND' || item.referenceType === 'DISPUTE_SETTLEMENT';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-24 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">ठेकेदार बटुआ (Wallet)</h1>
              <p className="text-xs text-slate-400">सुरक्षित डबल-एंट्री लेज़र</p>
            </div>
          </div>
          <button
            onClick={fetchWalletData}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-blue-400' : ''}`} />
          </button>
        </div>

        {/* Balance Cards */}
        <div className="grid grid-cols-2 gap-3">
          {/* Available Balance */}
          <Card className="bg-gradient-to-br from-blue-950/60 to-slate-900 border-blue-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-blue-300">
              <span className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5" />
                उपलब्ध (Available)
              </span>
            </div>
            <div>
              <p className="text-2xl font-black text-white tracking-tight">
                {formatRupees(wallet.balancePaise)}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {wallet.balancePaise.toLocaleString('en-IN')} paise
              </p>
            </div>
          </Card>

          {/* Locked in Escrow */}
          <Card className="bg-gradient-to-br from-amber-950/50 to-slate-900 border-amber-900/40 p-4 space-y-3">
            <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
              <span className="flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                एस्क्रो में लॉक (Locked)
              </span>
            </div>
            <div>
              <p className="text-2xl font-black text-amber-200 tracking-tight">
                {formatRupees(wallet.lockedPaise)}
              </p>
              <p className="text-[10px] text-slate-400 font-mono mt-0.5">
                {wallet.lockedPaise.toLocaleString('en-IN')} paise
              </p>
            </div>
          </Card>
        </div>

        {/* Actions Bar */}
        <div className="flex gap-2.5">
          <Button
            variant="primary"
            onClick={() => setIsTopupOpen(true)}
            className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 font-semibold flex items-center justify-center gap-2 rounded-xl text-sm"
          >
            <PlusCircle className="w-4 h-4" />
            पैसे जोड़ें (Top-Up)
          </Button>

          <Link
            href="/contractor/escrow"
            className="flex-1 py-3 px-3 bg-slate-900 hover:bg-slate-800/80 border border-slate-800 text-slate-200 font-semibold flex items-center justify-center gap-2 rounded-xl text-sm transition-colors text-center"
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            एस्क्रो सूची (Escrows)
          </Link>
        </div>

        {/* Ledger Transactions Section */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-slate-400" />
              लेज़र लेन-देन (Ledger Activity)
            </h2>
            <span className="text-xs text-slate-400">
              {filteredEntries.length} entries
            </span>
          </div>

          {/* Filter Pills */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 text-xs">
            {['ALL', 'TOPUP', 'ESCROW', 'REFUND'].map((tab) => (
              <button
                key={tab}
                type="button"
                onClick={() => setFilterTab(tab)}
                className={`py-1.5 px-3 rounded-lg font-medium transition-all ${
                  filterTab === tab
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20'
                    : 'bg-slate-900 border border-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab === 'ALL' && 'सभी (All)'}
                {tab === 'TOPUP' && 'टॉप-अप'}
                {tab === 'ESCROW' && 'एस्क्रो होल्ड'}
                {tab === 'REFUND' && 'वापसी (Refund)'}
              </button>
            ))}
          </div>

          {/* List */}
          {filteredEntries.length === 0 ? (
            <Card className="text-center py-10 space-y-2 border-dashed border-slate-800">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-400">कोई लेन-देन नहीं मिला</p>
              <p className="text-xs text-slate-500">
                जब आप वॉलेट टॉप-अप करेंगे या काम लॉक करेंगे, यहाँ एंट्री दिखेगी।
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {filteredEntries.map((entry) => {
                const isCredit = entry.entryType === 'CREDIT';
                const isEscrowHold = entry.account === 'ESCROW_HOLD';

                return (
                  <Card
                    key={entry._id}
                    className="p-3.5 bg-slate-900/80 border-slate-800/80 hover:border-slate-700/80 transition-all flex items-center justify-between"
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                          isCredit
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : 'bg-amber-500/10 text-amber-400'
                        }`}
                      >
                        {isCredit ? (
                          <ArrowDownLeft className="w-4 h-4" />
                        ) : (
                          <ArrowUpRight className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">
                            {entry.description || entry.referenceType}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          खाता: <span className="font-mono text-slate-300">{entry.account}</span>
                        </p>
                        <p className="text-[10px] text-slate-500">
                          {new Date(entry.createdAt).toLocaleDateString('hi-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>

                    <div className="text-right">
                      <div
                        className={`text-sm font-bold tracking-tight font-mono ${
                          isCredit ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatRupees(entry.amountPaise)}
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold inline-block mt-1">
                        {entry.entryType}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Topup Modal */}
      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        onSuccess={(newBalance) => {
          setWallet((prev) => ({ ...prev, balancePaise: newBalance }));
          fetchWalletData();
        }}
        currentBalancePaise={wallet.balancePaise}
      />

      <BottomNav role="contractor" />
    </div>
  );
}
