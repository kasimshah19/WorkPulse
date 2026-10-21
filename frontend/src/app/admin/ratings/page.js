'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Star,
  ShieldAlert,
  ShieldCheck,
  Eye,
  EyeOff,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  Filter,
  MessageSquare,
  HardHat,
  Briefcase,
} from 'lucide-react';
import api from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

export default function AdminRatingsPage() {
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [filterReported, setFilterReported] = useState(false);
  const [filterHidden, setFilterHidden] = useState(false);

  // Hide modal state
  const [hideTarget, setHideTarget] = useState(null);
  const [hideReason, setHideReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  const fetchRatings = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filterReported) params.set('reported', 'true');
      if (filterHidden) params.set('hidden', 'true');

      const res = await api.get(`/admin/ratings?${params.toString()}`);
      setRatings(res.data?.ratings || res.data || []);
    } catch (err) {
      setError(err.message || 'रेटिंग्स लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, [filterReported, filterHidden]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  const handleHide = async () => {
    if (!hideTarget || hideReason.trim().length < 5) {
      alert('कृपया कम से कम 5 अक्षरों का कारण लिखें।');
      return;
    }
    setActionLoading(true);
    try {
      await api.post(`/admin/ratings/${hideTarget._id}/hide`, { reason: hideReason.trim() });
      setHideTarget(null);
      setHideReason('');
      fetchRatings();
    } catch (err) {
      alert('Hide failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnhide = async (id) => {
    if (!confirm('क्या आप वाकई यह रेटिंग पुनः दिखाना (Unhide) चाहते हैं?')) return;
    setActionLoading(true);
    try {
      await api.post(`/admin/ratings/${id}/unhide`);
      fetchRatings();
    } catch (err) {
      alert('Unhide failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="max-w-4xl mx-auto p-4 space-y-5 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Star className="w-6 h-6 text-amber-400" />
              <h1 className="text-xl font-black text-white">
                रेटिंग मॉडरेशन कतार (Rating Moderation)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              रिपोर्ट की गई या अनुचित रेटिंग्स को छिपाएं या पुनर्स्थापित करें।
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <Link
              href="/admin/incidents"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            >
              घटना कतार (Incidents)
            </Link>
            <Link
              href="/admin/safety"
              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl"
            >
              सुरक्षा आंकड़े (Stats)
            </Link>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-2xl p-3 flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFilterReported(!filterReported)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterReported
                  ? 'bg-rose-600 border-rose-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              🚩 रिपोर्ट की गई (Reported by User)
            </button>

            <button
              onClick={() => setFilterHidden(!filterHidden)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                filterHidden
                  ? 'bg-amber-600 border-amber-500 text-white'
                  : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              👁️‍🗨️ छिपाई गई (Hidden)
            </button>
          </div>

          <button
            onClick={fetchRatings}
            className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
            title="Refresh Ratings"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold">
            {error}
          </div>
        )}

        {/* Ratings List */}
        {loading && ratings.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            रेटिंग्स लोड हो रही हैं...
          </div>
        ) : ratings.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-black text-white">कोई रेटिंग नहीं मिली</h3>
            <p className="text-xs text-slate-400">फ़िल्टर बदलकर देखें।</p>
          </div>
        ) : (
          <div className="space-y-3">
            {ratings.map((r) => {
              const isHidden = r.isHidden;
              const isReported = r.reportedByRecipient;

              return (
                <div
                  key={r._id}
                  className={`p-4 rounded-2xl border space-y-3 transition-colors ${
                    isHidden
                      ? 'bg-slate-950/60 border-slate-800/80 opacity-70'
                      : isReported
                      ? 'bg-rose-950/20 border-rose-500/40'
                      : 'bg-slate-900 border-slate-800'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30">
                          {r.type}
                        </span>

                        <div className="flex items-center gap-1 text-amber-400">
                          <Star className="w-4 h-4 fill-amber-400" />
                          <span className="text-sm font-black text-white">{r.score}</span>
                          <span className="text-xs text-slate-500">/ 5</span>
                        </div>

                        {r.revealedAt ? (
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                            खुला (Revealed)
                          </span>
                        ) : (
                          <span className="text-[10px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                            गुप्त (Blind)
                          </span>
                        )}

                        {isHidden && (
                          <span className="text-[10px] font-bold bg-rose-600 text-white px-2 py-0.5 rounded">
                            छिपाई गई (HIDDEN)
                          </span>
                        )}

                        {isReported && (
                          <span className="text-[10px] font-black bg-rose-500/20 text-rose-300 border border-rose-500/40 px-2 py-0.5 rounded">
                            🚩 रिपोर्टेड
                          </span>
                        )}
                      </div>

                      <div className="text-xs text-slate-300 flex items-center gap-2 pt-1 font-mono">
                        <span>द्वारा: <strong>{r.fromUser?.name || 'User'}</strong></span>
                        <span>&rarr;</span>
                        <span>प्राप्तकर्ता: <strong>{r.toUser?.name || 'User'}</strong></span>
                        {r.job && <span>• काम: {r.job.title || r.job}</span>}
                      </div>
                    </div>

                    {/* Actions */}
                    <div>
                      {isHidden ? (
                        <button
                          onClick={() => handleUnhide(r._id)}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5" /> Unhide
                        </button>
                      ) : (
                        <button
                          onClick={() => {
                            setHideTarget(r);
                            setHideReason('');
                          }}
                          disabled={actionLoading}
                          className="px-3 py-1.5 bg-rose-600/20 hover:bg-rose-600/30 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center gap-1"
                        >
                          <EyeOff className="w-3.5 h-3.5" /> छिपाएं (Hide)
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Tags */}
                  {r.tags && r.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {r.tags.map((t) => {
                        const meta = RATING_TAG_CATALOG[t];
                        return (
                          <span
                            key={t}
                            className="text-[11px] font-bold px-2 py-0.5 rounded-lg bg-slate-800 text-slate-300 border border-slate-700"
                          >
                            {meta?.hi || t}
                          </span>
                        );
                      })}
                    </div>
                  )}

                  {/* Comment */}
                  {r.comment && (
                    <p className="text-xs text-slate-300 bg-slate-950 p-2.5 rounded-xl leading-relaxed italic border border-slate-800">
                      "{r.comment}"
                    </p>
                  )}

                  {/* Reported Reason or Hide Reason */}
                  {r.reportReason && (
                    <div className="text-[11px] bg-rose-500/10 border border-rose-500/30 p-2 rounded-lg text-rose-300">
                      <strong>यूज़र शिकायत:</strong> {r.reportReason}
                    </div>
                  )}

                  {r.hiddenReason && (
                    <div className="text-[11px] bg-slate-950 border border-slate-800 p-2 rounded-lg text-slate-400 font-mono">
                      <strong>एडमिन द्वारा छिपाने का कारण:</strong> {r.hiddenReason}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Hide Reason Modal */}
      {hideTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <h3 className="text-base font-black text-white">रेटिंग छिपाएं (Hide Rating)</h3>
            <p className="text-xs text-slate-400">
              छिपाने के बाद यह स्कोर और यूज़र की प्रोफाइल से तुरंत हट जाएगी और स्कोर दोबारा कैलकुलेट होगा।
            </p>

            <div>
              <label className="text-xs font-bold text-slate-300 block mb-1.5">
                कारण (Mandatory, Min 5 Characters):
              </label>
              <textarea
                rows={3}
                placeholder="गाली-गलौज, गलत जानकारी या दुर्भावनापूर्ण रेटिंग..."
                value={hideReason}
                onChange={(e) => setHideReason(e.target.value)}
                className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none"
              />
            </div>

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={() => setHideTarget(null)}
                className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
              >
                रद्द करें
              </button>
              <button
                type="button"
                onClick={handleHide}
                disabled={actionLoading || hideReason.trim().length < 5}
                className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 disabled:opacity-50 text-white rounded-xl text-xs font-black shadow"
              >
                {actionLoading ? 'छिप रहा है...' : 'कन्फर्म छिपाएं'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
