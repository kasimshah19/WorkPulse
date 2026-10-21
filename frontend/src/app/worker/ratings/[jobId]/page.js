'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Star,
  ShieldCheck,
  Banknote,
  ArrowLeft,
  CheckCircle2,
  Lock,
  RefreshCw,
  AlertTriangle,
} from 'lucide-react';
import api from '../../../../lib/api';
import StarInput from '../../../../components/ui/StarInput';
import TagChips from '../../../../components/ui/TagChips';

export default function WorkerRatingScreen() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId;

  const [job, setJob] = useState(null);
  const [loading, setLoading] = useState(true);
  const [eligibility, setEligibility] = useState(null);

  // Payment Rating State
  const [paymentScore, setPaymentScore] = useState(0);
  const [paymentTags, setPaymentTags] = useState([]);
  const [paymentComment, setPaymentComment] = useState('');
  const [paymentSubmitting, setPaymentSubmitting] = useState(false);
  const [paymentDone, setPaymentDone] = useState(false);
  const [paymentError, setPaymentError] = useState(null);

  // Safety Rating State
  const [safetyScore, setSafetyScore] = useState(0);
  const [safetyTags, setSafetyTags] = useState([]);
  const [safetyComment, setSafetyComment] = useState('');
  const [safetySubmitting, setSafetySubmitting] = useState(false);
  const [safetyDone, setSafetyDone] = useState(false);
  const [safetyError, setSafetyError] = useState(null);

  useEffect(() => {
    if (!jobId) return;

    // Load Job details and pending status
    api
      .get(`/jobs/${jobId}`)
      .then((res) => {
        const j = res.data?.job || res.job;
        setJob(j);
      })
      .catch(() => {});

    // Load existing given ratings for this job
    api
      .get(`/ratings/mine/given?jobId=${jobId}`)
      .then((res) => {
        const given = res.data?.ratings || res.ratings || [];
        given.forEach((r) => {
          if (r.type === 'CONTRACTOR_PAYMENT') setPaymentDone(true);
          if (r.type === 'CONTRACTOR_SAFETY') setSafetyDone(true);
        });
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (paymentScore === 0) {
      setPaymentError('कृपया स्टार रेटिंग चुनें (Please select star rating)');
      return;
    }

    setPaymentSubmitting(true);
    setPaymentError(null);

    try {
      const contractorId = job.contractor?._id || job.contractor;
      await api.post('/ratings', {
        jobId,
        toUserId: contractorId,
        type: 'CONTRACTOR_PAYMENT',
        score: paymentScore,
        tags: paymentTags,
        comment: paymentComment.trim(),
      });
      setPaymentDone(true);
    } catch (err) {
      setPaymentError(err.message || 'रेटिंग दर्ज करने में विफल');
    } finally {
      setPaymentSubmitting(false);
    }
  };

  const handleSafetySubmit = async (e) => {
    e.preventDefault();
    if (safetyScore === 0) {
      setSafetyError('कृपया स्टार रेटिंग चुनें (Please select star rating)');
      return;
    }

    setSafetySubmitting(true);
    setSafetyError(null);

    try {
      const contractorId = job.contractor?._id || job.contractor;
      await api.post('/ratings', {
        jobId,
        toUserId: contractorId,
        type: 'CONTRACTOR_SAFETY',
        score: safetyScore,
        tags: safetyTags,
        comment: safetyComment.trim(),
      });
      setSafetyDone(true);
    } catch (err) {
      setSafetyError(err.message || 'रेटिंग दर्ज करने में विफल');
    } finally {
      setSafetySubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-xs">लोड हो रहा है...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 border-b border-slate-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-black tracking-tight text-white">
            ठेकेदार को रेटिंग दें (Rate Contractor)
          </h1>
          <p className="text-[11px] text-slate-400">{job?.title || 'काम की समीक्षा'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-6 max-w-md mx-auto">
        {/* Double-Blind Information Banner */}
        <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-800/60 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200">
            <strong className="block text-white font-bold mb-0.5">डबल-ब्लाइंड रेटिंग (Double-Blind Privacy):</strong>
            <span>
              आपकी रेटिंग ठेकेदार को तब तक नहीं दिखेगी जब तक वह भी आपकी रेटिंग न दे दे, या रेटिंग विंडो बंद न हो जाए। बिना किसी डर के सच्ची रेटिंग दें।
            </span>
          </div>
        </div>

        {/* Block 1: CONTRACTOR_PAYMENT */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Banknote className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">पैसा कैसा मिला? (Payment Review)</h2>
              <p className="text-[11px] text-slate-400">समय पर भुगतान, कटौती और पूरा पैसा</p>
            </div>
          </div>

          {paymentDone ? (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-emerald-300">भुगतान रेटिंग दर्ज हो गई है!</p>
              <p className="text-[11px] text-slate-400">
                ठेकेदार द्वारा आपकी रेटिंग देने के बाद दोनों की रेटिंग एक साथ खुलेगी।
              </p>
            </div>
          ) : (
            <form onSubmit={handlePaymentSubmit} className="space-y-4">
              {paymentError && (
                <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs">
                  {paymentError}
                </div>
              )}

              <StarInput value={paymentScore} onChange={setPaymentScore} />

              <TagChips
                type="CONTRACTOR_PAYMENT"
                selectedTags={paymentTags}
                onChange={setPaymentTags}
              />

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">
                  संक्षिप्त टिप्पणी (वैकल्पिक, अधिकतम 300 अक्षर):
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={paymentComment}
                  onChange={(e) => setPaymentComment(e.target.value)}
                  placeholder="उदा: पूरा पैसा समय पर दिया, कोई परेशानी नहीं हुई"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={paymentSubmitting || paymentScore === 0}
                className="w-full min-h-[48px] py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-bold text-xs shadow flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                {paymentSubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>भुगतान रेटिंग सबमिट करें (Submit Payment Rating)</span>
              </button>
            </form>
          )}
        </div>

        {/* Block 2: CONTRACTOR_SAFETY */}
        <div className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl">
          <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
            <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="font-bold text-sm text-white">साइट सुरक्षा और व्यवहार (Safety & Behavior)</h2>
              <p className="text-[11px] text-slate-400">सुरक्षा सामान, सम्मानजनक व्यवहार और स्थल सुरक्षा</p>
            </div>
          </div>

          {safetyDone ? (
            <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 text-center space-y-2">
              <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
              <p className="text-xs font-bold text-emerald-300">सुरक्षा रेटिंग दर्ज हो गई है!</p>
              <p className="text-[11px] text-slate-400">
                ठेकेदार द्वारा आपकी रेटिंग देने के बाद दोनों की रेटिंग एक साथ खुलेगी।
              </p>
            </div>
          ) : (
            <form onSubmit={handleSafetySubmit} className="space-y-4">
              {safetyError && (
                <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs">
                  {safetyError}
                </div>
              )}

              <StarInput value={safetyScore} onChange={setSafetyScore} />

              <TagChips
                type="CONTRACTOR_SAFETY"
                selectedTags={safetyTags}
                onChange={setSafetyTags}
              />

              <div className="space-y-1">
                <label className="text-[11px] font-semibold text-slate-400">
                  संक्षिप्त टिप्पणी (वैकल्पिक, अधिकतम 300 अक्षर):
                </label>
                <input
                  type="text"
                  maxLength={300}
                  value={safetyComment}
                  onChange={(e) => setSafetyComment(e.target.value)}
                  placeholder="उदा: हेलमेट और दस्ताने दिए, व्यवहार बहुत अच्छा था"
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                />
              </div>

              <button
                type="submit"
                disabled={safetySubmitting || safetyScore === 0}
                className="w-full min-h-[48px] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
              >
                {safetySubmitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                <span>सुरक्षा रेटिंग सबमिट करें (Submit Safety Rating)</span>
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
