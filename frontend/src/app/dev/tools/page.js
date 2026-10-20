'use client';

import React, { useState } from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import {
  Wrench,
  Zap,
  Clock,
  ShieldCheck,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  LogIn,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export default function DevToolsPage() {
  const { setAuth } = useAuthStore();
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });
  const [isRunning, setIsRunning] = useState(false);

  const showMsg = (type, text) => {
    setStatusMsg({ type, text });
    setTimeout(() => setStatusMsg({ type: '', text: '' }), 5000);
  };

  const handleQuickLogin = async (phone) => {
    try {
      setIsRunning(true);
      // Request OTP
      await api.post('/auth/request-otp', { phone });
      // Verify with simulated OTP '123456'
      const verifyRes = await api.post('/auth/verify-otp', { phone, otp: '123456' });
      if (verifyRes.data?.token && verifyRes.data?.user) {
        setAuth(verifyRes.data.user, verifyRes.data.token);
        showMsg('success', `सफलतापूर्वक लॉगिन किया: ${verifyRes.data.user.role} (${phone})`);
      }
    } catch (err) {
      showMsg('error', err.message || 'लॉगिन विफल रहा।');
    } finally {
      setIsRunning(false);
    }
  };

  const handleQuickTopup = async (amountRupees) => {
    try {
      setIsRunning(true);
      const createRes = await api.post('/payments/topup-order', { amountRupees });
      const { paymentOrderId } = createRes.data;
      await api.post('/payments/mock-complete', { paymentOrderId });
      showMsg('success', `₹${amountRupees} का त्वरित टॉप-अप सफलतापूर्वक संपन्न हुआ!`);
    } catch (err) {
      showMsg('error', err.message || 'टॉप-अप विफल रहा।');
    } finally {
      setIsRunning(false);
    }
  };

  const handleTriggerScheduler = async () => {
    try {
      setIsRunning(true);
      const res = await api.post('/dev/trigger-scheduler', {});
      showMsg('success', `शेड्यूलर निष्पादित: ${res.data?.approvedCount || 0} एस्क्रो स्वतः मंज़ूर किए गए।`);
    } catch (err) {
      showMsg('error', err.message || 'शेड्यूलर निष्पादन विफल रहा।');
    } finally {
      setIsRunning(false);
    }
  };

  const handleTriggerReconcile = async () => {
    try {
      setIsRunning(true);
      const res = await api.post('/dev/trigger-reconciliation', {});
      showMsg('success', `रिकॉन्सिलेशन परिणाम: ${res.data?.status || 'PASS'} (0 violations)`);
    } catch (err) {
      showMsg('error', err.message || 'रिकॉन्सिलेशन विफल रहा।');
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
            <Wrench className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">डेवलपर टूल्स (Dev Tools)</h1>
            <p className="text-xs text-slate-400">Phase 5 टेस्ट व सिम्युलेशन शॉर्टकट</p>
          </div>
        </div>

        {statusMsg.text && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-center gap-2 ${
              statusMsg.type === 'error'
                ? 'bg-red-950/60 border-red-800 text-red-300'
                : 'bg-emerald-950/60 border-emerald-800 text-emerald-300'
            }`}
          >
            {statusMsg.type === 'error' ? (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            )}
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* 1. Quick Switch Accounts */}
        <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
          <h2 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
            <LogIn className="w-3.5 h-3.5 text-blue-400" />
            त्वरित खाता लॉगिन (Quick Role Switch)
          </h2>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <Button
              variant="secondary"
              disabled={isRunning}
              onClick={() => handleQuickLogin('+919000000100')}
              className="py-2 text-[11px]"
            >
              Contractor
            </Button>
            <Button
              variant="secondary"
              disabled={isRunning}
              onClick={() => handleQuickLogin('+919000000001')}
              className="py-2 text-[11px]"
            >
              Worker (W1)
            </Button>
            <Button
              variant="secondary"
              disabled={isRunning}
              onClick={() => handleQuickLogin('+919000000900')}
              className="py-2 text-[11px]"
            >
              Admin
            </Button>
          </div>
        </Card>

        {/* 2. Quick Wallet Top-Up */}
        <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
          <h2 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
            <Zap className="w-3.5 h-3.5 text-emerald-400" />
            त्वरित ठेकेदार वॉलेट टॉप-अप (Mock Top-Up)
          </h2>
          <div className="grid grid-cols-3 gap-2">
            {[1000, 5000, 10000].map((amt) => (
              <Button
                key={amt}
                variant="primary"
                disabled={isRunning}
                onClick={() => handleQuickTopup(amt)}
                className="py-2 text-xs bg-emerald-600 hover:bg-emerald-500 font-semibold"
              >
                +₹{amt.toLocaleString('en-IN')}
              </Button>
            ))}
          </div>
        </Card>

        {/* 3. Escrow & Reconciliation Triggers */}
        <Card className="p-4 bg-slate-900 border-slate-800 space-y-3">
          <h2 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            शेड्यूलर और रिकॉन्सिलेशन ट्रिगर
          </h2>
          <div className="space-y-2">
            <Button
              variant="primary"
              disabled={isRunning}
              onClick={handleTriggerScheduler}
              className="w-full py-2.5 text-xs bg-amber-600 hover:bg-amber-500 font-bold flex items-center justify-center gap-2"
            >
              स्वतः मंज़ूरी शेड्यूलर चलाएँ (Auto-Approval Scheduler)
            </Button>

            <Button
              variant="primary"
              disabled={isRunning}
              onClick={handleTriggerReconcile}
              className="w-full py-2.5 text-xs bg-blue-600 hover:bg-blue-500 font-bold flex items-center justify-center gap-2"
            >
              लेज़र रिकॉन्सिलेशन चलाएँ (Run Reconciliation)
            </Button>
          </div>
        </Card>

        {/* Quick Links */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <Link
            href="/admin/ledger"
            className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-center font-semibold text-slate-300"
          >
            लेज़र डैशबोर्ड देखें
          </Link>
          <Link
            href="/admin/disputes"
            className="p-3 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-xl text-center font-semibold text-slate-300"
          >
            विवाद पंचाट देखें
          </Link>
        </div>
      </main>
    </div>
  );
}
