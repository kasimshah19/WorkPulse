'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Star,
  ShieldCheck,
  Banknote,
  Flag,
  CheckCircle2,
  Lock,
  ArrowLeft,
  Building,
  RefreshCw,
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import ScoreBadge from '../../../components/ui/ScoreBadge';
import TrustPanel from '../../../components/ui/TrustPanel';

export default function ContractorMyRatingsPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [received, setReceived] = useState([]);
  const [given, setGiven] = useState([]);
  const [reputation, setReputation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('RECEIVED');

  // Report modal state
  const [reportingId, setReportingId] = useState(null);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  useEffect(() => {
    if (!user) return;

    Promise.all([
      api.get('/ratings/received'),
      api.get('/ratings/mine/given'),
      api.get(`/users/${user._id || user.id}/reputation`),
    ])
      .then(([recRes, givRes, repRes]) => {
        setReceived(recRes.data?.ratings || recRes.ratings || []);
        setGiven(givRes.data?.ratings || givRes.ratings || []);
        setReputation(repRes.data || repRes);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [user]);

  const handleReportRating = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    setSubmittingReport(true);
    try {
      await api.post(`/ratings/${reportingId}/report`, {
        reason: reportReason.trim(),
      });
      setReceived((prev) =>
        prev.map((r) => (r._id === reportingId ? { ...r, reportedByRecipient: true } : r))
      );
      setReportingId(null);
      setReportReason('');
    } catch (err) {
      alert(err.message || 'रिपोर्ट दर्ज करने में विफल');
    } finally {
      setSubmittingReport(false);
    }
  };

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
            मेरी रेटिंग्स और प्रतिष्ठा (Reputation)
          </h1>
          <p className="text-[11px] text-slate-400">कारीगरों से प्राप्त रेटिंग और भुगतान विश्वास स्कोर</p>
        </div>
      </div>

      <div className="mt-4 space-y-4 max-w-md mx-auto">
        {/* Full Trust Panel */}
        {user && <TrustPanel userId={user._id || user.id} initialData={reputation} />}

        {/* Tab Controls */}
        <div className="flex gap-2 text-xs font-bold pt-2">
          <button
            type="button"
            onClick={() => setActiveTab('RECEIVED')}
            className={`flex-1 min-h-[44px] py-2 rounded-xl border transition-all ${
              activeTab === 'RECEIVED'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            प्राप्त रेटिंग्स ({received.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('GIVEN')}
            className={`flex-1 min-h-[44px] py-2 rounded-xl border transition-all ${
              activeTab === 'GIVEN'
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            कारीगरों को दी गई ({given.length})
          </button>
        </div>

        {loading ? (
          <div className="text-center py-10 text-slate-400 text-xs">लोड हो रहा है...</div>
        ) : activeTab === 'RECEIVED' ? (
          received.length === 0 ? (
            <div className="text-center py-12 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              अभी तक कोई खुली रेटिंग नहीं है।
            </div>
          ) : (
            <div className="space-y-3">
              {received.map((r) => (
                <div key={r._id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="text-xs font-bold text-white block">
                        {r.fromUser?.name || 'सत्यापित कारीगर'}
                      </span>
                      <span className="text-[11px] text-slate-400">
                        {r.type === 'CONTRACTOR_PAYMENT' ? 'भुगतान समीक्षा' : 'सुरक्षा समीक्षा'} • {r.job?.title}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 font-black text-sm">
                      <Star className="w-4 h-4 fill-amber-400" />
                      <span>{r.score}</span>
                    </div>
                  </div>

                  {r.tags?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.tags.map((t, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 rounded-md bg-slate-800 border border-slate-700 text-[11px] text-slate-300 font-medium"
                        >
                          {t}
                        </span>
                      ))}
                    </div>
                  )}

                  {r.comment && (
                    <p className="text-xs text-slate-300 italic pt-1">"{r.comment}"</p>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-slate-800/80 text-[11px]">
                    <span className="text-slate-500">
                      {new Date(r.revealedAt || r.createdAt).toLocaleDateString('en-IN')}
                    </span>

                    {r.reportedByRecipient ? (
                      <span className="text-amber-400 font-semibold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>जांच के लिए भेजी गई</span>
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReportingId(r._id)}
                        className="text-slate-400 hover:text-rose-400 font-semibold flex items-center gap-1"
                      >
                        <Flag className="w-3 h-3" />
                        <span>गलत लगी? रिपोर्ट करें</span>
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          /* GIVEN TAB */
          given.length === 0 ? (
            <div className="text-center py-12 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400 text-xs">
              आपने अभी तक किसी कारीगर को रेटिंग नहीं दी है।
            </div>
          ) : (
            <div className="space-y-3">
              {given.map((r) => {
                const isRevealed = r.status === 'REVEALED' || Boolean(r.revealedAt);
                return (
                  <div key={r._id} className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-white block">
                          {r.toUser?.name || 'कारीगर'}
                        </span>
                        <span className="text-[11px] text-slate-400">हुनर रेटिंग (WORKER_SKILL)</span>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          isRevealed
                            ? 'bg-emerald-500/20 text-emerald-400'
                            : 'bg-amber-500/20 text-amber-400'
                        }`}
                      >
                        {isRevealed ? 'खुली हुई (Revealed)' : 'दूसरे की प्रतीक्षा (Waiting)'}
                      </span>
                    </div>

                    <div className="flex items-center gap-1 text-amber-400 font-bold text-xs">
                      <span>आपने दिए:</span>
                      <span className="font-black text-amber-300">★ {r.score}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )
        )}
      </div>

      {/* Report Rating Modal */}
      {reportingId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4">
            <h3 className="font-bold text-sm text-white">रेटिंग पर आपत्ति दर्ज करें (Report Rating)</h3>
            <p className="text-xs text-slate-300">
              यदि कारीगर ने दुर्भावना या गलत कारणों से अनुचित रेटिंग दी है, तो कारण बताएं।
            </p>
            <textarea
              rows={3}
              required
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              placeholder="आपत्ति का कारण लिखें..."
              className="w-full p-2.5 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setReportingId(null)}
                className="py-2.5 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700"
              >
                रद्द करें
              </button>
              <button
                type="button"
                disabled={submittingReport || !reportReason.trim()}
                onClick={handleReportRating}
                className="py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow flex items-center justify-center gap-1"
              >
                {submittingReport && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                <span>सबमिट करें</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
