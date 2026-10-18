'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  ArrowLeft,
  Briefcase,
  IndianRupee,
  Calendar,
  MapPin,
  CheckCircle2,
  Clock,
  Phone,
} from 'lucide-react';
import api from '../../../lib/api';

export default function WorkerMyJobsPage() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const fetchApplications = async () => {
      try {
        const res = await api.get('/applications/my');
        setApplications(res.data || []);
      } catch (err) {
        setError(err.message || 'काम लोड करने में समस्या हुई।');
      } finally {
        setLoading(false);
      }
    };

    fetchApplications();
  }, []);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
      <Link
        href="/worker/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> वापस डैशबोर्ड पर जाएं
      </Link>

      <div className="space-y-1">
        <h1 className="text-xl font-black text-white">
          मेरे काम (My Jobs & Assignments)
        </h1>
        <p className="text-xs text-slate-400">
          वे सभी काम जिन्हें आपने स्वीकार या पूरा किया है
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-28 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && applications.length === 0 && (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">कोई स्वीकृत काम नहीं मिला</h4>
          <p className="text-xs text-slate-400">
            डैशबोर्ड पर जाकर नए उपलब्ध कामों में से किसी एक को स्वीकार करें।
          </p>
          <Link
            href="/worker/dashboard"
            className="inline-block px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
          >
            काम खोजें (Find Jobs)
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {applications.map((app) => {
          const job = app.job;
          if (!job) return null;
          const wageRupees = Math.round((job.wagePerDayPaise || 0) / 100);
          const isAssigned = app.status === 'ASSIGNED';

          return (
            <div
              key={app._id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-md"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        isAssigned
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {app.status === 'ASSIGNED' ? '✅ पक्का हुआ (Assigned)' : app.status}
                    </span>
                    <span className="text-[10px] text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded font-bold">
                      {job.skillRequired}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mt-1.5">
                    {job.title}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-sm font-black text-emerald-400 flex items-center justify-end">
                    <IndianRupee className="w-3.5 h-3.5" />
                    <span>{wageRupees}</span>
                    <span className="text-[10px] text-slate-400 font-normal">/दिन</span>
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-300 space-y-1 bg-slate-800/40 p-2.5 rounded-xl">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  <span className="truncate">{job.addressText}</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
                  <span>
                    {new Date(job.startDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })} -{' '}
                    {new Date(job.endDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })}
                  </span>
                </div>
                {job.contractor && (
                  <div className="flex items-center gap-1.5 text-slate-400 pt-1 border-t border-slate-700/50">
                    <Phone className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                    <span className="font-bold text-white">ठेकेदार: {job.contractor.name} ({job.contractor.phone})</span>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
