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
  const [attendanceCounts, setAttendanceCounts] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (user && user.role !== 'contractor') {
      window.location.href = '/worker/dashboard';
      return;
    }
  }, [user]);

  const fetchAttendanceSummaries = useCallback(async (jobList) => {
    const today = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date());

    const activeJobs = jobList.filter((j) => ['FILLED', 'IN_PROGRESS'].includes(j.status));
    const counts = {};

    await Promise.all(
      activeJobs.map(async (j) => {
        try {
          const res = await api.get(`/jobs/${j._id}/attendance?date=${today}`);
          const list = res.data || [];
          const checkedIn = list.filter((r) => r.attendance && ['CHECKED_IN', 'CHECKED_OUT'].includes(r.attendance.status)).length;
          counts[j._id] = { checkedIn, total: list.length || j.workersAssignedCount || 0 };
        } catch {
          // ignore error
        }
      })
    );

    setAttendanceCounts(counts);
  }, []);

  const fetchMyJobs = useCallback(async () => {
    if (user && user.role !== 'contractor') return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jobs/my');
      const jobList = res.data || [];
      setJobs(jobList);
      fetchAttendanceSummaries(jobList);
    } catch (err) {
      setError(err.message || 'काम लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, [user, fetchAttendanceSummaries]);

  useEffect(() => {
    if (user && user.role === 'contractor') {
      fetchMyJobs();
    }
  }, [fetchMyJobs, user]);

  // Live Socket updates for applicant responses and attendance check-in
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const handleApplicantAccepted = (payload) => {
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

    const handleAttendanceCheckedIn = (payload) => {
      if (payload.jobId) {
        setAttendanceCounts((prev) => {
          const existing = prev[payload.jobId] || { checkedIn: 0, total: 1 };
          return {
            ...prev,
            [payload.jobId]: {
              ...existing,
              checkedIn: existing.checkedIn + 1,
            },
          };
        });
      }
    };

    socket.on('applicant:accepted', handleApplicantAccepted);
    socket.on('attendance:checkedIn', handleAttendanceCheckedIn);

    return () => {
      socket.off('applicant:accepted', handleApplicantAccepted);
      socket.off('attendance:checkedIn', handleAttendanceCheckedIn);
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

                    {attendanceCounts[job._id] && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                        आज: {attendanceCounts[job._id].checkedIn}/{attendanceCounts[job._id].total} आ चुके हैं
                      </span>
                    )}
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
