'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  Users,
  IndianRupee,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  XCircle,
  AlertOctagon,
  RefreshCw,
  Phone,
  HardHat,
} from 'lucide-react';
import api from '../../../../lib/api';
import { useAuthStore } from '../../../../store/authStore';
import { getSocket } from '../../../../lib/socket';

export default function ContractorJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id;
  const { token } = useAuthStore();

  const [job, setJob] = useState(null);
  const [applicants, setApplicants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  const fetchJobDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [jobRes, appRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/jobs/${jobId}/applicants`),
      ]);
      setJob(jobRes.data);
      setApplicants(appRes.data || []);
    } catch (err) {
      setError(err.message || 'जानकारी लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (jobId) fetchJobDetails();
  }, [jobId, fetchJobDetails]);

  // Live real-time updates when workers accept or reject
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onApplicantAccepted = (payload) => {
      if (payload.jobId === jobId) {
        fetchJobDetails();
      }
    };

    const onApplicantRejected = (payload) => {
      if (payload.jobId === jobId) {
        fetchJobDetails();
      }
    };

    socket.on('applicant:accepted', onApplicantAccepted);
    socket.on('applicant:rejected', onApplicantRejected);

    return () => {
      socket.off('applicant:accepted', onApplicantAccepted);
      socket.off('applicant:rejected', onApplicantRejected);
    };
  }, [token, jobId, fetchJobDetails]);

  const handleCancelJob = async () => {
    if (!confirm('क्या आप वाकई यह काम रद्द (Cancel) करना चाहते हैं? सभी कारीगरों को कैंसिलेशन अलर्ट जाएगा।')) {
      return;
    }

    setActionLoading(true);
    try {
      await api.post(`/jobs/${jobId}/cancel`);
      alert('काम सफलतापूर्वक रद्द कर दिया गया।');
      router.push('/contractor/dashboard');
    } catch (err) {
      alert('Cancel error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !job) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-slate-400 text-sm">
        लोड हो रहा है...
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4">
        <div className="text-rose-400 text-sm">{error || 'काम नहीं मिला।'}</div>
        <Link href="/contractor/dashboard" className="text-xs text-blue-400 underline">
          डैशबोर्ड पर लौटें
        </Link>
      </div>
    );
  }

  const assignedCount = job.workersAssignedCount || 0;
  const needed = job.workersNeeded || 1;
  const isFilled = job.status === 'FILLED' || assignedCount >= needed;
  const wageRupees = Math.round((job.wagePerDayPaise || 0) / 100);

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 pb-20">
      <Link
        href="/contractor/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> डैशबोर्ड पर वापस जाएं
      </Link>

      {/* Main Job Overview Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded uppercase ${
                  job.status === 'OPEN'
                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                    : job.status === 'FILLED'
                    ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                    : 'bg-rose-500/20 text-rose-400'
                }`}
              >
                {job.status}
              </span>
              <span className="text-[10px] font-bold text-slate-400 uppercase">
                {job.skillRequired}
              </span>
            </div>

            <h1 className="text-xl font-black text-white mt-1.5">
              {job.title}
            </h1>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl font-black text-emerald-400 flex items-center justify-end">
              <IndianRupee className="w-5 h-5" />
              <span>{wageRupees}</span>
            </div>
            <span className="text-xs text-slate-400">/दिन</span>
          </div>
        </div>

        {/* Worker Fill Status Bar */}
        <div className="bg-slate-800/80 p-3.5 rounded-xl space-y-2">
          <div className="flex items-center justify-between text-xs font-bold">
            <span className="text-slate-200 flex items-center gap-1.5">
              <Users className="w-4 h-4 text-blue-400" />
              कारीगर भर्ती स्थिति:
            </span>
            <span className={isFilled ? 'text-emerald-400' : 'text-amber-400'}>
              {assignedCount} / {needed} मिल गए ({isFilled ? 'पूर्ण (Filled)' : 'चालू (Looking)'})
            </span>
          </div>

          <div className="w-full bg-slate-700 h-2.5 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                isFilled ? 'bg-emerald-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, (assignedCount / needed) * 100)}%` }}
            />
          </div>
        </div>

        <div className="text-xs text-slate-400 space-y-1">
          <div className="flex items-center gap-1.5">
            <MapPin className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span className="truncate">{job.addressText}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <Calendar className="w-3.5 h-3.5 text-blue-400 shrink-0" />
            <span>
              {new Date(job.startDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })} -{' '}
              {new Date(job.endDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })}
            </span>
          </div>
        </div>

        {/* View Attendance & Sign-off Button */}
        <Link
          href={`/contractor/jobs/${jobId}/attendance`}
          className="w-full min-h-[46px] bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-all active:scale-95"
        >
          <Clock className="w-4 h-4" />
          दैनिक हाज़िरी व साइन-ऑफ़ देखें (Daily Attendance & Sign-off)
        </Link>
      </div>

      {/* Live Applicants & Assigned Workers List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            कारीगर आवेदन व स्थिति (Applicants Pool)
            <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full">
              {applicants.length}
            </span>
          </h2>

          <button
            onClick={fetchJobDetails}
            className="p-1 text-slate-400 hover:text-white"
            title="Refresh List"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {applicants.length === 0 ? (
          <div className="p-6 bg-slate-900 border border-slate-800 rounded-xl text-center text-xs text-slate-400">
            अभी तक किसी कारीगर ने जवाब नहीं दिया है।
          </div>
        ) : (
          <div className="space-y-2">
            {applicants.map((app) => {
              const worker = app.worker;
              if (!worker) return null;
              const isAssigned = app.status === 'ASSIGNED';
              const distKm = app.distanceMeters !== null
                ? (app.distanceMeters / 1000).toFixed(1)
                : '0.0';

              return (
                <div
                  key={app._id}
                  className={`p-3.5 bg-slate-900 border rounded-xl flex items-center justify-between gap-3 ${
                    isAssigned
                      ? 'border-emerald-500/50 bg-emerald-500/5'
                      : 'border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                        isAssigned ? 'bg-emerald-600' : 'bg-slate-800'
                      }`}
                    >
                      <HardHat className="w-5 h-5" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h4 className="text-sm font-bold text-white truncate">
                          {worker.name}
                        </h4>
                        <span
                          className={`text-[9px] font-bold px-1.5 py-0.5 rounded uppercase ${
                            isAssigned
                              ? 'bg-emerald-500/20 text-emerald-400'
                              : app.status === 'REJECTED'
                              ? 'bg-rose-500/20 text-rose-400'
                              : 'bg-blue-500/20 text-blue-300'
                          }`}
                        >
                          {app.status === 'ASSIGNED' ? 'भर्ती पक्की' : app.status}
                        </span>
                      </div>

                      <div className="text-[11px] text-slate-400 flex items-center gap-2 mt-0.5">
                        <span className="font-mono flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-500" />
                          {worker.phone}
                        </span>
                        <span>•</span>
                        <span>{distKm} km दूर</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 text-right">
                    {isAssigned && (
                      <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        कन्फर्म
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Cancel Job Button */}
      {job.status !== 'CANCELLED' && (
        <div className="pt-4">
          <button
            onClick={handleCancelJob}
            disabled={actionLoading}
            className="w-full py-3 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-colors"
          >
            <AlertOctagon className="w-4 h-4" />
            {actionLoading ? 'रद्द हो रहा है...' : 'काम रद्द करें (Cancel Job)'}
          </button>
        </div>
      )}
    </div>
  );
}
