'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  Flame,
  Clock,
  TrendingDown,
  AlertTriangle,
  RefreshCw,
  HardHat,
  CheckCircle2,
  Activity,
  FileBarChart2,
  Users,
} from 'lucide-react';
import api from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';

export default function AdminSafetyStatsPage() {
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchStats = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/admin/safety/stats');
      setStats(res.data);
    } catch (err) {
      setError(err.message || 'सुरक्षा आंकड़े लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="max-w-4xl mx-auto p-4 space-y-6 pb-24">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <FileBarChart2 className="w-6 h-6 text-emerald-400" />
              <h1 className="text-xl font-black text-white">
                सुरक्षा मेट्रिक्स व एनालिटिक्स (Safety Intelligence)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              SOS रिस्पॉन्स समय, एस्केलेशन दर, और प्रति 100 कार्य-दिवस दुर्घटना दर।
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStats}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
              title="Refresh Stats"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold">
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="text-center py-16 text-slate-500 text-sm">
            सुरक्षा आंकड़े संकलित हो रहे हैं...
          </div>
        ) : !stats ? (
          <div className="text-center py-12 text-slate-500 text-sm">कोई डेटा उपलब्ध नहीं है।</div>
        ) : (
          <div className="space-y-6">
            {/* KPI Overview Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">कुल घटनाएं (Incidents)</span>
                <span className="text-2xl font-black text-white font-mono">
                  {stats.counts?.total || 0}
                </span>
                <span className="text-[11px] text-slate-500 block">
                  खुली: {stats.counts?.byStatus?.OPEN || 0}
                </span>
              </div>

              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-rose-300 block">SOS अलर्ट</span>
                <span className="text-2xl font-black text-rose-400 font-mono">
                  {stats.counts?.byType?.SOS || 0}
                </span>
                <span className="text-[11px] text-rose-300/70 block">
                  गंभीर: {stats.counts?.bySeverity?.CRITICAL || 0}
                </span>
              </div>

              <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-amber-300 block">चोट / दुर्घटना (Injury)</span>
                <span className="text-2xl font-black text-amber-400 font-mono">
                  {stats.counts?.byType?.INJURY || 0}
                </span>
                <span className="text-[11px] text-amber-300/70 block">
                  कार्यस्थल सुरक्षा
                </span>
              </div>

              <div className="p-4 bg-purple-500/10 border border-purple-500/30 rounded-2xl space-y-1">
                <span className="text-[10px] uppercase font-bold text-purple-300 block">शिकायतें (Harassment)</span>
                <span className="text-2xl font-black text-purple-400 font-mono">
                  {(stats.counts?.byType?.HARASSMENT || 0) + (stats.counts?.byType?.DISPUTE || 0)}
                </span>
                <span className="text-[11px] text-purple-300/70 block">
                  गोपनीय शिकायतें
                </span>
              </div>
            </div>

            {/* Timing & Rates */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Response Time Card */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Clock className="w-5 h-5 text-blue-400" />
                  <h3 className="text-sm font-black text-white">SOS रिस्पॉन्स समय (Response Times)</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-bold">मध्यिका समय (Median Ack)</span>
                    <span className="text-xl font-black text-blue-400 font-mono">
                      {stats.sosTiming?.medianAckSec !== null ? `${stats.sosTiming.medianAckSec} सेकंड` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">50% अलर्ट का पहला रिस्पॉन्स</span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-bold">P90 Ack समय</span>
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {stats.sosTiming?.p90AckSec !== null ? `${stats.sosTiming.p90AckSec} सेकंड` : 'N/A'}
                    </span>
                    <span className="text-[10px] text-slate-500 block">90% अलर्ट का अधिकतम समय</span>
                  </div>
                </div>

                <div className="text-xs text-slate-400">
                  कुल एकनॉलेज्ड SOS: <strong className="text-white font-mono">{stats.sosTiming?.totalSample || 0}</strong>
                </div>
              </div>

              {/* Rates & Benchmarks */}
              <div className="p-5 bg-slate-900 border border-slate-800 rounded-2xl space-y-4">
                <div className="flex items-center gap-2">
                  <Activity className="w-5 h-5 text-emerald-400" />
                  <h3 className="text-sm font-black text-white">एस्केलेशन व झूठे अलार्म (Escalation & False Alarm)</h3>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-bold">एस्केलेशन दर (Escalated)</span>
                    <span className="text-xl font-black text-rose-400 font-mono">
                      {stats.rates?.escalationRatePercent ?? 0}%
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {stats.rates?.escalatedCount || 0} में से {stats.rates?.sosTotal || 0} SOS
                    </span>
                  </div>

                  <div className="p-3 bg-slate-950 rounded-xl border border-slate-800">
                    <span className="text-[11px] text-slate-400 block font-bold">गलत अलार्म (False Alarm)</span>
                    <span className="text-xl font-black text-amber-400 font-mono">
                      {stats.rates?.falseAlarmRatePercent ?? 0}%
                    </span>
                    <span className="text-[10px] text-slate-500 block">
                      {stats.rates?.falseAlarmCount || 0} में से {stats.rates?.resolvedCount || 0} हल
                    </span>
                  </div>
                </div>

                {/* Per 100 worker days */}
                <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs space-y-0.5">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-blue-300">प्रति 100 कार्य-दिवस दुर्घटना दर:</span>
                    <span className="font-black text-white font-mono text-sm">
                      {stats.per100WorkerDays ?? 0}
                    </span>
                  </div>
                  <div className="text-[10px] text-blue-200/70 font-mono">
                    कुल कार्य-दिवस (Worker Days): {stats.totalWorkerDays || 0}
                  </div>
                </div>
              </div>
            </div>

            {/* Top Jobs by Incidents Table */}
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-black text-white flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-400" />
                उच्चतम घटना वाले कार्यस्थल (Top Jobs with Incidents)
              </h3>

              {(!stats.topJobs || stats.topJobs.length === 0) ? (
                <div className="text-xs text-slate-500 py-4 text-center">
                  अभी तक किसी भी काम पर एकाधिक घटनाएं दर्ज नहीं हैं।
                </div>
              ) : (
                <div className="space-y-2">
                  {stats.topJobs.map((j, idx) => (
                    <div
                      key={idx}
                      className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between text-xs"
                    >
                      <div className="space-y-0.5 min-w-0">
                        <div className="font-bold text-white truncate">{j.jobTitle || 'काम'}</div>
                        <div className="text-[11px] text-slate-400 truncate">ठेकेदार: {j.contractorName || 'N/A'}</div>
                      </div>

                      <div className="text-right shrink-0">
                        <span className="text-xs font-black text-rose-400 font-mono bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded">
                          {j.incidentCount} घटनाएं
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
