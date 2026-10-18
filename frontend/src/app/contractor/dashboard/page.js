'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  PlusCircle,
  Briefcase,
  Users,
  IndianRupee,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { getSocket } from '../../../lib/socket';

export default function ContractorDashboardPage() {
  const { user, token } = useAuthStore();

  const [jobs, setJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchMyJobs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jobs/my');
      setJobs(res.data || []);
    } catch (err) {
      setError(err.message || 'काम लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyJobs();
  }, [fetchMyJobs]);

  // Live Socket updates for applicant responses
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const handleApplicantAccepted = (payload) => {
      // payload: { jobId, workerId, workerName, assignedCount, workersNeeded }
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j._id === payload.jobId) {
            return {
              ...j,
              workersAssignedCount: payload.assignedCount,
              status: payload.assignedCount >= payload.workersNeeded ? 'FILLED' : j.status,
              applicantCounts: {
                ...j.applicantCounts,
                assigned: (j.applicantCounts?.assigned || 0) + 1,
              },
            };
          }
          return j;
        })
      );
    };

    const handleApplicantRejected = (payload) => {
      setJobs((prevJobs) =>
        prevJobs.map((j) => {
          if (j._id === payload.jobId) {
            return {
              ...j,
              applicantCounts: {
                ...j.applicantCounts,
                rejected: payload.rejectedCount,
              },
            };
          }
          return j;
        })
      );
    };

    socket.on('applicant:accepted', handleApplicantAccepted);
    socket.on('applicant:rejected', handleApplicantRejected);

    return () => {
      socket.off('applicant:accepted', handleApplicantAccepted);
      socket.off('applicant:rejected', handleApplicantRejected);
    };
  }, [token]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-20">
      {/* Header with Post Job CTA */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between shadow-lg">
        <div>
          <h2 className="text-base font-black text-white">
            ठेकेदार: {user?.name || 'Thekedaar'}
          </h2>
          <p className="text-xs text-slate-400 font-mono">
            {user?.phone}
          </p>
        </div>

        <Link
          href="/contractor/post-job"
          className="flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold shadow-md transition-transform active:scale-95"
        >
          <PlusCircle className="w-4 h-4" />
          नया काम (Post Job)
        </Link>
      </div>

      {/* Jobs List Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-white">
            मेरे पोस्ट किए गए काम (My Posted Jobs)
          </h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
            {jobs.length}
          </span>
        </div>

        <button
          onClick={fetchMyJobs}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading && jobs.length === 0 && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {!loading && jobs.length === 0 && !error && (
        <div className="p-8 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
          <Briefcase className="w-8 h-8 text-slate-600 mx-auto" />
          <h4 className="text-sm font-bold text-white">कोई काम पोस्ट नहीं किया गया</h4>
          <p className="text-xs text-slate-400">
            अपने प्रोजेक्ट के लिए कारीगर ढूंढने हेतु नया काम पोस्ट करें।
          </p>
          <Link
            href="/contractor/post-job"
            className="inline-block px-4 py-2 bg-blue-600 text-white font-bold text-xs rounded-xl"
          >
            नया काम डालें (Post Job Now)
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {jobs.map((job) => {
          const wageRupees = Math.round((job.wagePerDayPaise || 0) / 100);
          const assignedCount = job.workersAssignedCount || 0;
          const needed = job.workersNeeded || 1;
          const isFilled = job.status === 'FILLED' || assignedCount >= needed;

          return (
            <div
              key={job._id}
              className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3 shadow-md hover:border-slate-700 transition-all"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                        job.status === 'OPEN'
                          ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                          : job.status === 'FILLED'
                          ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                          : job.status === 'CANCELLED'
                          ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30'
                          : 'bg-slate-800 text-slate-400'
                      }`}
                    >
                      {job.status}
                    </span>

                    <span className="text-[10px] font-bold text-slate-400 uppercase">
                      {job.skillRequired}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-white mt-1.5">
                    {job.title}
                  </h3>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-black text-emerald-400 flex items-center justify-end">
                    <IndianRupee className="w-4 h-4" />
                    <span>{wageRupees}</span>
                    <span className="text-[10px] text-slate-400 font-normal">/दिन</span>
                  </div>
                </div>
              </div>

              {/* Live Worker Fill Progress Bar */}
              <div className="bg-slate-800/60 p-3 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-blue-400" />
                    कारीगर भर्ती (Hiring Progress):
                  </span>
                  <span className={isFilled ? 'text-emerald-400' : 'text-amber-400'}>
                    {assignedCount} / {needed} मिल गए ({isFilled ? 'पूर्ण' : 'बाकी'})
                  </span>
                </div>

                <div className="w-full bg-slate-700 h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isFilled ? 'bg-emerald-500' : 'bg-blue-500'
                    }`}
                    style={{ width: `${Math.min(100, (assignedCount / needed) * 100)}%` }}
                  />
                </div>

                <div className="flex items-center gap-3 text-[11px] text-slate-400 pt-1">
                  <span>अलर्ट भेजे गए: {job.applicantCounts?.notified || 0}</span>
                  <span>•</span>
                  <span>अस्वीकार: {job.applicantCounts?.rejected || 0}</span>
                </div>
              </div>

              <div className="pt-1">
                <Link
                  href={`/contractor/jobs/${job._id}`}
                  className="w-full min-h-[44px] bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs border border-slate-700 transition-transform active:scale-95"
                >
                  आवेदक व हाज़िरी देखें (Manage Job & Applicants)
                  <ArrowRight className="w-4 h-4" />
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
