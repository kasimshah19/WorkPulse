'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  IndianRupee,
  MapPin,
  Calendar,
  Clock,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HardHat,
  Phone,
} from 'lucide-react';
import api from '../../../../lib/api';
import { JobMapPin } from '../../../../components/ui/JobMapPin';
import { ScoreBadge } from '../../../../components/ui/ScoreBadge';
import { TrustPanel } from '../../../../components/ui/TrustPanel';

export default function WorkerJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id;

  const [job, setJob] = useState(null);
  const [contractorRep, setContractorRep] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');
  const [isFilledConflict, setIsFilledConflict] = useState(false);
  const [isAssigned, setIsAssigned] = useState(false);

  useEffect(() => {
    const fetchJob = async () => {
      try {
        const res = await api.get(`/jobs/${jobId}`);
        setJob(res.data);

        // Fetch contractor reputation if contractor populated
        const contractorId = res.data?.contractor?._id || res.data?.contractor;
        if (contractorId) {
          try {
            const repRes = await api.get(`/users/${contractorId}/reputation`);
            setContractorRep(repRes.data);
          } catch {
            // ignore reputation fetch error
          }
        }
      } catch (err) {
        setError(err.message || 'काम की जानकारी नहीं मिल सकी।');
      } finally {
        setLoading(false);
      }
    };

    if (jobId) fetchJob();
  }, [jobId]);

  const handleAccept = async () => {
    setActionLoading(true);
    setError('');
    try {
      const res = await api.post(`/jobs/${jobId}/accept`);
      if (res.data?.application?.status === 'ASSIGNED' || res.data?.message?.includes('assigned')) {
        setIsAssigned(true);
      }
    } catch (err) {
      if (err.code === 'JOB_FILLED' || err.status === 409) {
        setIsFilledConflict(true);
      } else {
        setError(err.message || 'काम स्वीकार करने में समस्या हुई।');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!confirm('क्या आप वाकई यह काम अस्वीकार करना चाहते हैं?')) return;
    setActionLoading(true);
    try {
      await api.post(`/jobs/${jobId}/reject`);
      router.push('/worker/dashboard');
    } catch (err) {
      alert('Reject error: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-md mx-auto p-8 text-center text-slate-400 text-sm">
        लोड हो रहा है...
      </div>
    );
  }

  // Friendly 409 JOB_FILLED state
  if (isFilledConflict) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center mx-auto">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-black text-white">
            काम भर चुका है! (Job Filled)
          </h2>
          <p className="text-sm text-slate-300">
            माफ़ कीजिए, इस काम के लिए आवश्यक कारीगर पूरे हो चुके हैं। दूसरे किसी कारीगर ने इसे पहले स्वीकार कर लिया।
          </p>
        </div>
        <Link
          href="/worker/dashboard"
          className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm"
        >
          अन्य काम देखें (Explore Other Jobs)
        </Link>
      </div>
    );
  }

  // Confirmed Assigned state
  if (isAssigned) {
    return (
      <div className="max-w-md mx-auto p-6 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce-short">
          <CheckCircle2 className="w-10 h-10" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">
            काम पक्का हुआ! (Job Assigned)
          </h2>
          <p className="text-sm text-slate-300">
            बधाई हो! आपको <span className="text-emerald-400 font-bold">{job?.title}</span> के लिए चुन लिया गया है।
          </p>
          <p className="text-xs text-slate-400">
            ठेकेदार: {job?.contractor?.name} • {job?.contractor?.phone}
          </p>
        </div>
        <Link
          href="/worker/my-jobs"
          className="inline-block px-6 py-3 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-sm"
        >
          मेरे काम की सूची (Go to My Jobs)
        </Link>
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="max-w-md mx-auto p-6 text-center space-y-4">
        <div className="text-rose-400 text-sm">{error || 'काम नहीं मिला।'}</div>
        <Link href="/worker/dashboard" className="text-xs text-blue-400 underline">
          डैशबोर्ड पर लौटें
        </Link>
      </div>
    );
  }

  const wageRupees = Math.round((job.wagePerDayPaise || 0) / 100);
  const lat = job.location?.coordinates?.[1] || 18.5204;
  const lng = job.location?.coordinates?.[0] || 73.8567;

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 pb-24">
      <Link
        href="/worker/dashboard"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
      >
        <ArrowLeft className="w-4 h-4" /> वापस डैशबोर्ड पर जाएं
      </Link>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="text-xs font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2.5 py-0.5 rounded">
              {job.skillRequired}
            </span>
            <h1 className="text-xl font-black text-white mt-1.5">
              {job.title}
            </h1>
          </div>

          <div className="text-right shrink-0">
            <div className="text-xl font-black text-emerald-400 flex items-center justify-end">
              <IndianRupee className="w-5 h-5" />
              <span>{wageRupees}</span>
            </div>
            <span className="text-xs text-slate-400 font-medium">प्रति दिन (Per Day)</span>
          </div>
        </div>

        {job.description && (
          <p className="text-xs text-slate-300 bg-slate-800/50 p-3 rounded-xl leading-relaxed">
            {job.description}
          </p>
        )}

        {/* Schedule & Timing Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Calendar className="w-3.5 h-3.5 text-blue-400" /> कार्य अवधि (Dates)
            </span>
            <span className="font-bold text-white block">
              {new Date(job.startDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })} -{' '}
              {new Date(job.endDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })}
            </span>
            <span className="text-[10px] text-blue-300">({job.totalDays || 1} दिन का काम)</span>
          </div>

          <div className="p-3 bg-slate-800/60 rounded-xl space-y-1">
            <span className="text-slate-400 flex items-center gap-1 text-[11px]">
              <Clock className="w-3.5 h-3.5 text-amber-400" /> काम का समय (Hours)
            </span>
            <span className="font-bold text-white block">
              {job.workingHours?.start || '09:00'} - {job.workingHours?.end || '18:00'}
            </span>
            <span className="text-[10px] text-emerald-300 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" /> एस्क्रो सुरक्षित
            </span>
          </div>
        </div>

        {/* Contractor Trust & Reputation Card */}
        {contractorRep && (
          <div className="p-4 bg-slate-800/60 border border-slate-700/60 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-[10px] uppercase font-bold text-slate-400 block">ठेकेदार (Contractor)</span>
                <h3 className="text-sm font-black text-white">{contractorRep.name}</h3>
              </div>
              <ScoreBadge
                score={contractorRep.summary?.score || 0}
                count={contractorRep.summary?.count || 0}
                badge={contractorRep.summary?.badge}
                size="md"
              />
            </div>

            <TrustPanel reputation={contractorRep} role="contractor" />
          </div>
        )}

        {/* Mini Site Map Pin */}
        <div className="space-y-2 pt-2">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
            <MapPin className="w-4 h-4 text-emerald-400" />
            साइट लोकेशन: {job.addressText}
          </div>

          <JobMapPin
            lat={lat}
            lng={lng}
            geofenceRadiusMeters={job.geofenceRadiusMeters || 100}
          />
        </div>
      </div>

      {/* Big Tactile Action Buttons (Min 48px Touch Targets) */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30">
        <div className="max-w-md mx-auto grid grid-cols-2 gap-3">
          <button
            onClick={handleReject}
            disabled={actionLoading}
            className="min-h-[50px] bg-slate-800 hover:bg-slate-700 text-rose-400 font-bold rounded-xl flex items-center justify-center gap-2 text-sm border border-slate-700 transition-transform active:scale-95"
          >
            <XCircle className="w-5 h-5 text-rose-500" />
            अस्वीकार (Reject)
          </button>

          <button
            onClick={handleAccept}
            disabled={actionLoading}
            className="min-h-[50px] bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg shadow-emerald-600/30 transition-transform active:scale-95"
          >
            <CheckCircle2 className="w-5 h-5" />
            {actionLoading ? 'स्वीकार हो रहा है...' : 'स्वीकार करें (Accept)'}
          </button>
        </div>
      </div>
    </div>
  );
}
