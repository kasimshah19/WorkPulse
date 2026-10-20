'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '../../../../../components/layout/Navbar';
import { Card } from '../../../../../components/ui/Card';
import { Button } from '../../../../../components/ui/Button';
import { TopupModal } from '../../../../../components/payments/TopupModal';
import api from '../../../../../lib/api';
import { formatRupees } from '../../../../../lib/utils';
import {
  ShieldCheck,
  Lock,
  Wallet,
  Users,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  PlusCircle,
} from 'lucide-react';
import Link from 'next/link';

export default function JobFundingPage() {
  const { id: jobId } = useParams();
  const router = useRouter();

  const [job, setJob] = useState(null);
  const [wallet, setWallet] = useState(null);
  const [quote, setQuote] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFunding, setIsFunding] = useState(false);
  const [error, setError] = useState('');
  const [isTopupOpen, setIsTopupOpen] = useState(false);
  const [fundedResult, setFundedResult] = useState(null);

  const loadData = useCallback(async () => {
    try {
      setIsLoading(true);
      setError('');

      const [jobRes, walletRes, quoteRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get('/wallet/me'),
        api.get(`/jobs/${jobId}/funding-quote`).catch(() => null),
      ]);

      if (jobRes.data) setJob(jobRes.data);
      if (walletRes.data) setWallet(walletRes.data);
      if (quoteRes?.data) setQuote(quoteRes.data);
    } catch (err) {
      setError(err.message || 'काम की जानकारी लोड नहीं हो सकी।');
    } finally {
      setIsLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleFundJob = async () => {
    setError('');
    setIsFunding(true);

    try {
      const res = await api.post(`/jobs/${jobId}/fund`, {});
      setFundedResult(res.data);
    } catch (err) {
      setError(err.message || 'फंडिंग विफल रही।');
    } finally {
      setIsFunding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col text-slate-100">
        <Navbar />
        <main className="flex-1 flex items-center justify-center p-4">
          <div className="flex flex-col items-center gap-3 text-slate-400">
            <RefreshCw className="w-8 h-8 animate-spin text-blue-500" />
            <p className="text-sm">एस्क्रो कोटेशन लोड हो रहा है...</p>
          </div>
        </main>
      </div>
    );
  }

  // Calculate required amount
  const wagePerDayPaise = job?.wagePerDayPaise || 0;
  const workersAssignedCount = quote?.workersCount || job?.workersNeeded || 1;
  const totalDays = quote?.totalDays || job?.totalDays || 1;
  const requiredPaise = quote?.requiredPaise || wagePerDayPaise * workersAssignedCount * totalDays;
  const balancePaise = wallet?.balancePaise || 0;
  const isShortfall = balancePaise < requiredPaise;
  const shortfallPaise = Math.max(0, requiredPaise - balancePaise);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-20 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-5">
        {/* Top Back Link */}
        <Link
          href={`/contractor/jobs/${jobId}`}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          काम के विवरण पर वापस (Back to Job)
        </Link>

        {/* Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white">काम के लिए एस्क्रो लॉक करें</h1>
            <p className="text-xs text-slate-400">Lock escrow for {job?.title || 'Job'}</p>
          </div>
        </div>

        {fundedResult ? (
          <Card className="text-center py-8 px-6 space-y-4 bg-emerald-950/30 border-emerald-800/40">
            <div className="w-14 h-14 mx-auto rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">एस्क्रो सफलता से लॉक हुआ!</h3>
              <p className="text-xs text-slate-300 mt-1">
                कुल {fundedResult.fundedCount || totalDays} दिनों की कमाई एस्क्रो में सुरक्षित कर दी गई है।
              </p>
              <p className="text-sm font-semibold text-emerald-400 mt-2 font-mono">
                {formatRupees(fundedResult.totalLockedPaise || requiredPaise)} सुरक्षित लॉक
              </p>
            </div>
            <div className="pt-2 space-y-2">
              <Link
                href={`/contractor/jobs/${jobId}/attendance`}
                className="w-full py-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-sm transition-colors"
              >
                हाज़िरी मॉनिटर देखें (Attendance)
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/contractor/escrow"
                className="w-full py-2.5 bg-slate-900 border border-slate-800 text-slate-300 hover:text-white rounded-xl font-semibold flex items-center justify-center gap-2 text-xs transition-colors"
              >
                सभी एस्क्रो लेन-देन देखें
              </Link>
            </div>
          </Card>
        ) : (
          <>
            {/* Funding Breakdown Card */}
            <Card className="p-4 bg-slate-900/90 border-slate-800 space-y-4">
              <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                आवश्यक राशि का विवरण (Funding Quote)
              </h2>

              <div className="space-y-2.5 text-xs text-slate-300">
                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Wallet className="w-3.5 h-3.5" />
                    दैनिक मज़दूरी (Daily Wage)
                  </span>
                  <span className="font-semibold text-white font-mono">
                    {formatRupees(wagePerDayPaise)} / दिन
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Users className="w-3.5 h-3.5" />
                    श्रमिक संख्या (Assigned Workers)
                  </span>
                  <span className="font-semibold text-white">
                    {workersAssignedCount} श्रमिक
                  </span>
                </div>

                <div className="flex justify-between items-center py-1 border-b border-slate-800/60">
                  <span className="flex items-center gap-1.5 text-slate-400">
                    <Calendar className="w-3.5 h-3.5" />
                    काम के कुल दिन (Total Days)
                  </span>
                  <span className="font-semibold text-white">
                    {totalDays} दिन
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2 text-sm font-bold">
                  <span className="text-white">कुल आवश्यक एस्क्रो (Total Required)</span>
                  <span className="text-blue-400 text-lg font-mono">
                    {formatRupees(requiredPaise)}
                  </span>
                </div>
              </div>
            </Card>

            {/* Wallet Balance Comparison Card */}
            <Card
              className={`p-4 border ${
                isShortfall
                  ? 'bg-red-950/30 border-red-900/50'
                  : 'bg-emerald-950/20 border-emerald-900/40'
              } space-y-3`}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-slate-400" />
                  आपका उपलब्ध वॉलेट बैलेंस
                </span>
                <span className="text-sm font-bold text-white font-mono">
                  {formatRupees(balancePaise)}
                </span>
              </div>

              {isShortfall ? (
                <div className="p-3 bg-red-950/60 border border-red-800/60 rounded-xl space-y-2">
                  <div className="flex items-start gap-2 text-xs text-red-300">
                    <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-bold">बैलेंस कम है (Insufficient Balance)</p>
                      <p className="text-[11px] text-red-200/80 mt-0.5">
                        इस काम को लॉक करने के लिए आपको{' '}
                        <span className="font-bold text-red-100 font-mono">
                          {formatRupees(shortfallPaise)}
                        </span>{' '}
                        का और टॉप-अप करना होगा।
                      </p>
                    </div>
                  </div>

                  <Button
                    variant="primary"
                    onClick={() => setIsTopupOpen(true)}
                    className="w-full py-2 bg-red-600 hover:bg-red-500 font-semibold text-xs flex items-center justify-center gap-2 rounded-lg"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    वॉलेट में {formatRupees(shortfallPaise)} जोड़ें
                  </Button>
                </div>
              ) : (
                <div className="p-2.5 bg-emerald-950/50 border border-emerald-800/60 rounded-xl flex items-center gap-2 text-xs text-emerald-300">
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                  <span>पर्याप्त बैलेंस उपलब्ध है। आप तुरंत एस्क्रो लॉक कर सकते हैं।</span>
                </div>
              )}
            </Card>

            {error && (
              <div className="p-3 bg-red-950/60 border border-red-800 rounded-xl text-xs text-red-300 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-red-400 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Lock Funds CTA */}
            <Button
              variant="primary"
              disabled={isFunding || isShortfall}
              onClick={handleFundJob}
              className="w-full py-3.5 bg-blue-600 hover:bg-blue-500 font-bold text-sm flex items-center justify-center gap-2 rounded-xl shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50"
            >
              {isFunding ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  एस्क्रो में लॉक हो रहा है...
                </>
              ) : (
                <>
                  <Lock className="w-4 h-4" />
                  {formatRupees(requiredPaise)} एस्क्रो में लॉक करें
                </>
              )}
            </Button>
          </>
        )}
      </main>

      <TopupModal
        isOpen={isTopupOpen}
        onClose={() => setIsTopupOpen(false)}
        onSuccess={(newBalance) => {
          setWallet((prev) => ({ ...prev, balancePaise: newBalance }));
          loadData();
        }}
        currentBalancePaise={wallet?.balancePaise || 0}
      />
    </div>
  );
}
