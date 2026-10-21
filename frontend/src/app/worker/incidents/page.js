'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, Plus, Clock, CheckCircle2, ShieldAlert, ArrowLeft, ChevronRight } from 'lucide-react';
import api from '../../../lib/api';

export default function WorkerIncidentsListPage() {
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');

  useEffect(() => {
    let url = '/incidents/my';
    if (filterStatus !== 'ALL') url += `?status=${filterStatus}`;

    api
      .get(url)
      .then((res) => {
        setIncidents(res.data?.incidents || res.incidents || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [filterStatus]);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
      {/* Header */}
      <div className="flex items-center justify-between py-3 border-b border-slate-800">
        <div className="flex items-center gap-3">
          <Link
            href="/worker/dashboard"
            className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-base font-black tracking-tight text-white">
              मेरी रिपोर्ट्स (My Incidents)
            </h1>
            <p className="text-[11px] text-slate-400">दर्ज की गई शिकायतें और सुरक्षा अलर्ट्स</p>
          </div>
        </div>

        <Link
          href="/worker/report"
          className="min-h-[40px] px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold flex items-center gap-1 shadow"
        >
          <Plus className="w-4 h-4" />
          <span>नई रिपोर्ट</span>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-2 my-4 text-xs font-bold">
        {['ALL', 'OPEN', 'ACKNOWLEDGED', 'RESOLVED'].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilterStatus(st)}
            className={`min-h-[38px] px-3 py-1.5 rounded-xl border transition-all ${
              filterStatus === st
                ? 'bg-blue-600 text-white border-blue-500'
                : 'bg-slate-900 text-slate-400 border-slate-800'
            }`}
          >
            {st === 'ALL' ? 'सभी' : st}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-slate-400 text-xs">लोड हो रहा है...</div>
      ) : incidents.length === 0 ? (
        <div className="text-center py-16 space-y-3 p-6 rounded-2xl bg-slate-900 border border-slate-800 text-slate-400">
          <ShieldAlert className="w-10 h-10 text-slate-600 mx-auto" />
          <p className="text-xs">कोई रिपोर्ट दर्ज नहीं है।</p>
        </div>
      ) : (
        <div className="space-y-3">
          {incidents.map((inc) => (
            <div
              key={inc._id}
              className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-2.5"
            >
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-rose-400" />
                  <span>{inc.type}</span>
                  <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                    {inc.severity}
                  </span>
                </span>

                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    inc.status === 'RESOLVED'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : inc.status === 'ACKNOWLEDGED'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'bg-rose-500/20 text-rose-400'
                  }`}
                >
                  {inc.status}
                </span>
              </div>

              <p className="text-xs text-slate-300 line-clamp-2">{inc.description || 'विवरण नहीं'}</p>

              <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-800/80">
                <span className="flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  <span>{new Date(inc.createdAt).toLocaleString('en-IN')}</span>
                </span>

                {inc.timeline && (
                  <span className="text-slate-400">
                    {inc.timeline.length} घटनाक्रम (Events)
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
