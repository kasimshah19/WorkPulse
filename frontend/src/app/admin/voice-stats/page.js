'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Mic,
  Activity,
  Layers,
  CheckCircle,
  AlertCircle,
  Clock,
  RefreshCw,
  Globe,
  ArrowLeft,
  Percent,
} from 'lucide-react';
import api from '../../../lib/api';

export default function AdminVoiceStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/voice/stats');
      setStats(res.data);
    } catch (err) {
      setError(err.message || 'Failed to load voice statistics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  return (
    <div className="max-w-4xl mx-auto p-4 space-y-6">
      {/* Top Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/disputes"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              <Mic className="w-5 h-5 text-blue-400" />
              Voice Onboarding Analytics & Impact Metrics
            </h1>
            <p className="text-xs text-slate-400">
              Voice vs Icon fallback metrics, precision & recall over confirmed sessions
            </p>
          </div>
        </div>

        <button
          onClick={loadStats}
          disabled={loading}
          className="p-2.5 rounded-xl bg-slate-900 border border-slate-800 text-slate-300 hover:text-white flex items-center gap-1.5 text-xs font-bold"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading && !stats ? (
        <div className="text-center py-12 text-slate-400 text-xs">
          Loading analytics from voicesessions collection...
        </div>
      ) : stats ? (
        <div className="space-y-6">
          {/* Top 4 KPI Metric Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {/* Card 1: Voice Share */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Voice Share</span>
                <Mic className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-black text-blue-400">
                {stats.voiceVsIcon.voiceSharePercent}%
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {stats.voiceVsIcon.voiceSessions} / {stats.totalSessions} sessions
              </p>
            </div>

            {/* Card 2: Icon Fallback Share */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Icon Fallback</span>
                <Layers className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-black text-amber-400">
                {stats.voiceVsIcon.iconSharePercent}%
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                {stats.voiceVsIcon.iconSessions} / {stats.totalSessions} sessions
              </p>
            </div>

            {/* Card 3: Extraction Precision */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Precision</span>
                <CheckCircle className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-black text-emerald-400">
                {(stats.accuracy.precision * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                sample: {stats.accuracy.evaluatedSessions} confirmed
              </p>
            </div>

            {/* Card 4: Extraction Recall */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
              <div className="flex items-center justify-between text-slate-400 text-xs font-bold">
                <span>Recall</span>
                <Percent className="w-4 h-4 text-purple-400" />
              </div>
              <div className="text-2xl font-black text-purple-400">
                {(stats.accuracy.recall * 100).toFixed(1)}%
              </div>
              <p className="text-[11px] text-slate-400 font-mono">
                sample: {stats.accuracy.evaluatedSessions} confirmed
              </p>
            </div>
          </div>

          {/* Middle Row: Latencies & Quality */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* STT Latencies */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-400" />
                STT Latency by Provider
              </h3>
              <div className="space-y-2">
                {Object.keys(stats.latencies).length === 0 ? (
                  <p className="text-xs text-slate-500 italic">No audio sessions recorded yet.</p>
                ) : (
                  Object.entries(stats.latencies).map(([prov, data]) => (
                    <div
                      key={prov}
                      className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between text-xs"
                    >
                      <span className="font-mono font-bold text-slate-300 uppercase">
                        {prov}
                      </span>
                      <div className="text-right">
                        <span className="font-bold text-white">{data.avgMs} ms avg</span>
                        <span className="text-slate-400 text-[10px] block font-mono">
                          ({data.sampleSize} requests)
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Quality & Error Rates */}
            <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Activity className="w-4 h-4 text-amber-400" />
                Reliability & Fallback Rate
              </h3>
              <div className="space-y-2 text-xs">
                <div className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">Total Fallback Rate (Icon + Abandoned)</span>
                  <span className="font-bold text-amber-300">
                    {stats.fallbackRate.fallbackRatePercent}% ({stats.fallbackRate.fallbackCount}/{stats.fallbackRate.totalSessions})
                  </span>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">No Speech Detected Rate</span>
                  <span className="font-bold text-slate-300">
                    {stats.quality.noSpeechRatePercent}% ({stats.quality.noSpeechCount})
                  </span>
                </div>
                <div className="p-3 bg-slate-800/50 rounded-xl flex items-center justify-between">
                  <span className="text-slate-300">STT Service Error Rate</span>
                  <span className="font-bold text-slate-300">
                    {stats.quality.errorRatePercent}% ({stats.quality.errorCount})
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Language Breakdown Table */}
          <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              <Globe className="w-4 h-4 text-emerald-400" />
              Language Breakdown (Sample Sizes & Accuracy)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-slate-800 text-slate-400">
                    <th className="pb-2 font-bold">Language</th>
                    <th className="pb-2 font-bold">Total Attempts</th>
                    <th className="pb-2 font-bold">Confirmed</th>
                    <th className="pb-2 font-bold">Precision</th>
                    <th className="pb-2 font-bold">Recall</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 font-mono">
                  {Object.entries(stats.languages).map(([code, lData]) => {
                    const label =
                      code === 'hi'
                        ? 'Hindi (हिंदी)'
                        : code === 'mr'
                        ? 'Marathi (मराठी)'
                        : code === 'en'
                        ? 'English'
                        : code;
                    return (
                      <tr key={code} className="hover:bg-slate-800/20">
                        <td className="py-2.5 font-sans font-bold text-white">
                          {label}
                        </td>
                        <td className="py-2.5 text-slate-300">{lData.total}</td>
                        <td className="py-2.5 text-slate-300">{lData.confirmed}</td>
                        <td className="py-2.5 text-emerald-400 font-bold">
                          {lData.confirmed > 0 ? (lData.avgPrecision * 100).toFixed(1) + '%' : '-'}
                        </td>
                        <td className="py-2.5 text-purple-400 font-bold">
                          {lData.confirmed > 0 ? (lData.avgRecall * 100).toFixed(1) + '%' : '-'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
