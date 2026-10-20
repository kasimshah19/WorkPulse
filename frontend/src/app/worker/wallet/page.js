'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import api from '../../../lib/api';
import { getSocket } from '../../../lib/socket';
import { useAuthStore } from '../../../store/authStore';
import { formatRupees, parseRupeesToPaise } from '../../../lib/utils';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  CheckCircle2,
  AlertCircle,
  Clock,
  RefreshCw,
  Edit2,
  Save,
  X,
  CreditCard,
  Building,
  Sparkles,
} from 'lucide-react';

const WITHDRAW_PRESETS = [200, 500, 1000];

export default function WorkerWalletPage() {
  const { user, updateUser } = useAuthStore();
  const [wallet, setWallet] = useState({ balancePaise: 0, lockedPaise: 0 });
  const [ledgerEntries, setLedgerEntries] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // UPI State
  const [isEditingUPI, setIsEditingUPI] = useState(false);
  const [upiInput, setUpiInput] = useState(user?.upiId || '');
  const [isSavingUPI, setIsSavingUPI] = useState(false);
  const [upiMessage, setUpiMessage] = useState({ type: '', text: '' });

  // Withdrawal Modal State
  const [isWithdrawOpen, setIsWithdrawOpen] = useState(false);
  const [withdrawAmountRupees, setWithdrawAmountRupees] = useState('500');
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawError, setWithdrawError] = useState('');
  const [withdrawSuccess, setWithdrawSuccess] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [walletRes, ledgerRes] = await Promise.all([
        api.get('/wallet/me'),
        api.get('/wallet/ledger?limit=30'),
      ]);

      if (walletRes.data) setWallet(walletRes.data);
      if (ledgerRes.data) setLedgerEntries(ledgerRes.data);
    } catch (err) {
      console.error('Failed to load wallet data:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    if (user?.upiId) setUpiInput(user.upiId);

    const socket = getSocket();
    if (socket && user?._id) {
      socket.emit('join:user', user._id);

      const handleBalanceUpdate = (data) => {
        setWallet((prev) => ({
          ...prev,
          balancePaise: data.balancePaise !== undefined ? data.balancePaise : prev.balancePaise,
        }));
        loadData();
      };

      socket.on('wallet:balance', handleBalanceUpdate);
      socket.on('payment:released', loadData);
      socket.on('payout:status', loadData);

      return () => {
        socket.off('wallet:balance', handleBalanceUpdate);
        socket.off('payment:released', loadData);
        socket.off('payout:status', loadData);
      };
    }
  }, [loadData, user]);

  const handleSaveUPI = async () => {
    setUpiMessage({ type: '', text: '' });
    const trimmed = upiInput.trim();
    if (!trimmed || !/^[\w.-]+@[\w.-]+$/.test(trimmed)) {
      setUpiMessage({ type: 'error', text: 'कृपया सही UPI ID दर्ज करें (उदा. name@okhdfcbank)' });
      return;
    }

    try {
      setIsSavingUPI(true);
      const res = await api.patch('/users/me/upi', { upiId: trimmed });
      updateUser({ upiId: trimmed });
      setIsEditingUPI(false);
      setUpiMessage({ type: 'success', text: 'UPI ID सफलता से सेव हो गई!' });
      setTimeout(() => setUpiMessage({ type: '', text: '' }), 4000);
    } catch (err) {
      setUpiMessage({ type: 'error', text: err.message || 'UPI ID सेव नहीं हो सकी।' });
    } finally {
      setIsSavingUPI(false);
    }
  };

  const handleWithdraw = async () => {
    setWithdrawError('');
    setIsWithdrawing(true);
    setWithdrawSuccess(null);

    const paise = parseRupeesToPaise(withdrawAmountRupees || '0');
    if (paise < 10000) {
      setWithdrawError('न्यूनतम निकासी ₹100 है (Minimum withdrawal is ₹100).');
      setIsWithdrawing(false);
      return;
    }

    if (paise > wallet.balancePaise) {
      setWithdrawError('वॉलेट में पर्याप्त बैलेंस नहीं है।');
      setIsWithdrawing(false);
      return;
    }

    try {
      const idempotencyKey = `WITHDRAW:${user?._id}:${Date.now()}`;
      const res = await api.post('/wallet/withdraw', {
        amountPaise: paise,
        idempotencyKey,
      });

      setWithdrawSuccess({
        amountPaise: paise,
        providerRef: res.data?.providerRef,
      });

      loadData();
    } catch (err) {
      setWithdrawError(err.message || 'निकासी विफल रही।');
    } finally {
      setIsWithdrawing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-24 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Wallet className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">मेरी कमाई और बटुआ (Wallet)</h1>
              <p className="text-xs text-slate-400">सुरक्षित दैनिक भुगतान</p>
            </div>
          </div>

          <button
            onClick={loadData}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-amber-400' : ''}`} />
          </button>
        </div>

        {/* Balance Card */}
        <Card className="p-5 bg-gradient-to-br from-amber-950/60 via-slate-900 to-slate-900 border-amber-900/40 space-y-4">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-300">
            <span className="flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-amber-400" />
              उपलब्ध कमाई (Available Balance)
            </span>
            <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-mono text-[10px]">
              INR
            </span>
          </div>

          <div>
            <p className="text-3xl font-black text-white tracking-tight">
              {formatRupees(wallet.balancePaise)}
            </p>
            <p className="text-[11px] text-slate-400 mt-1 font-mono">
              {wallet.balancePaise.toLocaleString('en-IN')} paise
            </p>
          </div>

          <Button
            variant="primary"
            onClick={() => {
              setWithdrawAmountRupees(String(Math.floor(wallet.balancePaise / 100)));
              setIsWithdrawOpen(true);
            }}
            disabled={wallet.balancePaise < 10000}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold flex items-center justify-center gap-2 rounded-xl text-sm transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50"
          >
            <CreditCard className="w-4 h-4 text-slate-950" />
            पैसे निकालें (Withdraw to UPI)
          </Button>
        </Card>

        {/* UPI Configuration Card */}
        <Card className="p-4 bg-slate-900/90 border-slate-800 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building className="w-4 h-4 text-blue-400" />
              <span className="text-xs font-bold text-white">बैंक खाता / UPI ID</span>
            </div>
            {!isEditingUPI && (
              <button
                type="button"
                onClick={() => setIsEditingUPI(true)}
                className="text-xs text-blue-400 hover:text-blue-300 font-semibold flex items-center gap-1"
              >
                <Edit2 className="w-3.5 h-3.5" />
                बदलें (Edit)
              </button>
            )}
          </div>

          {isEditingUPI ? (
            <div className="space-y-2">
              <input
                type="text"
                value={upiInput}
                onChange={(e) => setUpiInput(e.target.value)}
                placeholder="उदा. 9876543210@paytm या name@okhdfcbank"
                className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
              />
              <div className="flex gap-2">
                <Button
                  variant="primary"
                  onClick={handleSaveUPI}
                  disabled={isSavingUPI}
                  className="flex-1 py-1.5 text-xs bg-blue-600 hover:bg-blue-500 rounded-lg flex items-center justify-center gap-1 font-semibold"
                >
                  <Save className="w-3.5 h-3.5" />
                  {isSavingUPI ? 'सेव हो रहा है...' : 'सेव करें'}
                </Button>
                <button
                  type="button"
                  onClick={() => {
                    setIsEditingUPI(false);
                    setUpiInput(user?.upiId || '');
                  }}
                  className="px-3 py-1.5 bg-slate-800 text-slate-300 hover:text-white rounded-lg text-xs"
                >
                  रद्द करें
                </button>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-slate-950/80 rounded-xl border border-slate-800/80 flex items-center justify-between">
              <div>
                <p className="text-xs font-mono font-semibold text-white">
                  {user?.upiId || 'कोई UPI ID सेट नहीं है'}
                </p>
                <p className="text-[10px] text-slate-400 mt-0.5">
                  {user?.upiId ? 'निकासी सीधे इसी खाते में भेजी जाएगी' : 'कृपया निकासी से पहले UPI ID जोड़ें'}
                </p>
              </div>
              {user?.upiId && (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              )}
            </div>
          )}

          {upiMessage.text && (
            <p
              className={`text-[11px] ${
                upiMessage.type === 'error' ? 'text-red-400' : 'text-emerald-400'
              }`}
            >
              {upiMessage.text}
            </p>
          )}
        </Card>

        {/* Earning & Transaction History */}
        <div className="space-y-3 pt-2">
          <h2 className="text-sm font-bold text-white flex items-center gap-1.5">
            <Clock className="w-4 h-4 text-slate-400" />
            हाल की कमाई और लेन-देन (History)
          </h2>

          {ledgerEntries.length === 0 ? (
            <Card className="text-center py-10 space-y-2 border-dashed border-slate-800">
              <Clock className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-sm font-medium text-slate-400">अभी कोई लेन-देन नहीं है</p>
              <p className="text-xs text-slate-500">
                जब ठेकेदार आपका काम मंज़ूर करेगा, यहाँ भुगतान की एंट्री दिखेगी।
              </p>
            </Card>
          ) : (
            <div className="space-y-2">
              {ledgerEntries.map((entry) => {
                const isCredit = entry.entryType === 'CREDIT';

                return (
                  <Card
                    key={entry._id}
                    className="p-3.5 bg-slate-900/80 border-slate-800/80 flex items-center justify-between"
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
                        <span className="text-xs font-bold text-white">
                          {entry.description || entry.referenceType}
                        </span>
                        <p className="text-[10px] text-slate-400 mt-0.5">
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
                        className={`text-sm font-bold font-mono ${
                          isCredit ? 'text-emerald-400' : 'text-slate-300'
                        }`}
                      >
                        {isCredit ? '+' : '-'}
                        {formatRupees(entry.amountPaise)}
                      </div>
                      <span className="text-[9px] uppercase px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 font-semibold inline-block mt-1">
                        {isCredit ? 'क्रेडिट' : 'निकासी'}
                      </span>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      </main>

      {/* Withdrawal Modal */}
      {isWithdrawOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white">पैसे निकालें (Withdraw)</h3>
              <button
                onClick={() => setIsWithdrawOpen(false)}
                className="text-slate-400 hover:text-white p-1"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {withdrawSuccess ? (
              <div className="text-center py-6 space-y-3">
                <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
                <h4 className="text-lg font-bold text-white">निकासी अनुरोध सफल!</h4>
                <p className="text-xs text-slate-300">
                  {formatRupees(withdrawSuccess.amountPaise)} आपके UPI खाते ({user?.upiId}) में भेज दिए गए हैं।
                </p>
                <p className="text-[11px] font-mono text-slate-400">
                  UTR: {withdrawSuccess.providerRef}
                </p>
                <Button
                  variant="primary"
                  className="w-full mt-3 py-2.5"
                  onClick={() => {
                    setIsWithdrawOpen(false);
                    setWithdrawSuccess(null);
                  }}
                >
                  ठीक है (Done)
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs">
                  <span className="text-slate-400">UPI ID:</span>{' '}
                  <span className="font-mono text-white font-semibold">{user?.upiId}</span>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-2 block">
                    त्वरित राशि चुनें (Rupees)
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {WITHDRAW_PRESETS.map((p) => (
                      <button
                        key={p}
                        type="button"
                        onClick={() => setWithdrawAmountRupees(String(p))}
                        className={`py-2 rounded-xl text-xs font-semibold border ${
                          withdrawAmountRupees === String(p)
                            ? 'bg-amber-500/20 border-amber-500 text-amber-300'
                            : 'bg-slate-800 border-slate-700 text-slate-300'
                        }`}
                      >
                        ₹{p}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() =>
                        setWithdrawAmountRupees(String(Math.floor(wallet.balancePaise / 100)))
                      }
                      className="py-2 rounded-xl text-xs font-bold border bg-slate-800 border-slate-700 text-amber-400"
                    >
                      सभी (All)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-semibold text-slate-300 mb-1.5 block">
                    निकासी राशि (₹)
                  </label>
                  <input
                    type="number"
                    min="100"
                    step="1"
                    value={withdrawAmountRupees}
                    onChange={(e) => setWithdrawAmountRupees(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-white font-bold text-lg focus:outline-none focus:border-amber-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">न्यूनतम निकासी: ₹100</p>
                </div>

                {withdrawError && (
                  <div className="p-2.5 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
                    <span>{withdrawError}</span>
                  </div>
                )}

                <Button
                  variant="primary"
                  onClick={handleWithdraw}
                  disabled={isWithdrawing || !user?.upiId}
                  className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl"
                >
                  {isWithdrawing ? 'निकासी संसाधित हो रही है...' : `₹${withdrawAmountRupees || 0} निकालें`}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}

      <BottomNav role="worker" />
    </div>
  );
}
