'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  Briefcase,
  IndianRupee,
  MapPin,
  Calendar,
  Clock,
  ArrowRight,
  RefreshCw,
  SlidersHorizontal,
  CheckCircle2,
  AlertCircle,
  LogIn,
  LogOut,
  History,
  ShieldCheck,
  XCircle,
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';
import { useSocketStore } from '../../../store/socketStore';
import { getSocket } from '../../../lib/socket';

export default function WorkerDashboardPage() {
  const { user, updateUser, token } = useAuthStore();
  const { isConnected } = useSocketStore();

  const [todayCards, setTodayCards] = useState([]);
  const [nearbyJobs, setNearbyJobs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isAvailable, setIsAvailable] = useState(user?.isAvailable ?? true);

  useEffect(() => {
    if (user && user.role !== 'worker') {
      window.location.href = '/contractor/dashboard';
      return;
    }
  }, [user]);

  // Fetch today's assigned jobs and attendance status
  const fetchTodayWork = useCallback(async () => {
    if (!token) return;
    try {
      const res = await api.get('/attendance/today');
      setTodayCards(res.data || []);
    } catch (err) {
      console.warn('Failed to load today attendance:', err);
    }
  }, [token]);

  const fetchNearbyJobs = useCallback(async () => {
    if (user && user.role !== 'worker') return;
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/jobs/nearby?radiusKm=10');
      setNearbyJobs(res.data || []);
    } catch (err) {
      if (err.code === 'LOCATION_REQUIRED') {
        setError('लोकेशन सेट नहीं है। कृपया प्रोफाइल में जाकर अपनी लोकेशन सेट करें।');
      } else {
        setError(err.message || 'काम लोड करने में समस्या हुई।');
      }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (user && user.role === 'worker') {
      fetchNearbyJobs();
      fetchTodayWork();
    }
  }, [fetchNearbyJobs, fetchTodayWork, user]);

  // Sockets for real-time jobs and attendance/sign-off status
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const handleNewJob = (newJobData) => {
      setNearbyJobs((prev) => {
        const exists = prev.some((j) => j._id === newJobData.jobId);
        if (exists) return prev;
        return [
          {
            _id: newJobData.jobId,
            title: newJobData.title,
            skillRequired: newJobData.skillRequired,
            wagePerDayPaise: newJobData.wagePerDayPaise,
            distanceMeters: newJobData.distanceMeters,
            startDate: newJobData.startDate,
            endDate: newJobData.endDate,
            addressText: newJobData.addressText,
            isLiveBroadcast: true,
          },
          ...prev,
        ];
      });
    };

    const handleSignoffDone = () => {
      fetchTodayWork();
    };

    const handleAttendanceChange = () => {
      fetchTodayWork();
    };

    socket.on('job:new', handleNewJob);
    socket.on('signoff:done', handleSignoffDone);
    socket.on('attendance:checkedIn', handleAttendanceChange);
    socket.on('attendance:checkedOut', handleAttendanceChange);

    return () => {
      socket.off('job:new', handleNewJob);
      socket.off('signoff:done', handleSignoffDone);
      socket.off('attendance:checkedIn', handleAttendanceChange);
      socket.off('attendance:checkedOut', handleAttendanceChange);
    };
  }, [token, fetchTodayWork]);

  const handleToggleAvailability = async () => {
    const nextState = !isAvailable;
    setIsAvailable(nextState);
    try {
      await api.patch('/users/me/availability', { isAvailable: nextState });
      updateUser({ isAvailable: nextState });
    } catch (err) {
      setIsAvailable(!nextState);
      alert('Availability update failed: ' + err.message);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-24">
      {/* Header Profile Summary & Availability Toggle */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between shadow-lg">
        <div>
          <h2 className="text-base font-black text-white">
            नमस्ते, {user?.name?.split(' ')[0] || 'कारीगर'}
          </h2>
          <p className="text-xs text-slate-400">
            हुनर: {user?.skills?.join(', ') || 'सेट नहीं है'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link
            href="/worker/profile-setup"
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            title="Edit Profile & Location"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </Link>

          <button
            onClick={handleToggleAvailability}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-colors ${
              isAvailable
                ? 'bg-emerald-600/20 text-emerald-400 border border-emerald-500/30'
                : 'bg-slate-800 text-slate-400 border border-slate-700'
            }`}
          >
            {isAvailable ? 'काम चालू (Available)' : 'छुट्टी (Unavailable)'}
          </button>
        </div>
      </div>

      {/* Navigation Quick Links */}
      <div className="grid grid-cols-2 gap-2">
        <Link
          href="/worker/my-jobs"
          className="p-3 bg-blue-600/10 border border-blue-500/20 rounded-xl flex items-center gap-2 text-blue-400 font-bold text-xs"
        >
          <Briefcase className="w-4 h-4 text-blue-500" />
          मेरे काम (My Jobs)
        </Link>
        <Link
          href="/worker/attendance"
          className="p-3 bg-emerald-600/10 border border-emerald-500/20 rounded-xl flex items-center gap-2 text-emerald-400 font-bold text-xs"
        >
          <History className="w-4 h-4 text-emerald-500" />
          हाज़िरी इतिहास (History)
        </Link>
      </div>

      {/* Prominent "आज का काम" (Today's Assigned Work) Card */}
      {todayCards.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-white flex items-center gap-2">
              <Calendar className="w-4 h-4 text-emerald-400" />
              आज का काम (Today's Work)
            </h3>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              {todayCards.length} काम
            </span>
          </div>

          {todayCards.map((card) => {
            const { job, attendanceState, attendance } = card;
            const wage = Math.round((job.wagePerDayPaise || 0) / 100);

            return (
              <div
                key={job._id}
                className="p-4 bg-gradient-to-br from-slate-900 to-slate-850 border-2 border-emerald-500/40 rounded-2xl shadow-xl space-y-3"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded">
                      {job.skillRequired}
                    </span>
                    <h4 className="text-base font-bold text-white mt-1">
                      {job.title}
                    </h4>
                    <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                      {job.addressText || 'कार्यस्थल (Site Location)'}
                    </p>
                  </div>

                  <div className="text-right">
                    <div className="text-sm font-black text-emerald-400 flex items-center justify-end">
                      <IndianRupee className="w-3.5 h-3.5" />
                      <span>{wage}</span>
                      <span className="text-[10px] text-slate-400 font-normal">/दिन</span>
                    </div>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1 mt-1 justify-end">
                      <Clock className="w-3 h-3" />
                      {job.workingHours?.start} - {job.workingHours?.end}
                    </span>
                  </div>
                </div>

                {/* Large Status Chip */}
                <div className="pt-1">
                  {attendanceState === 'NOT_STARTED' && (
                    <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center justify-between">
                      <div className="flex items-center gap-2 text-amber-400 font-bold text-xs">
                        <AlertCircle className="w-4 h-4" />
                        <span>शुरू नहीं हुआ (Not Started)</span>
                      </div>
                      <Link
                        href={`/worker/jobs/${job._id}/check-in`}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md active:scale-95 transition"
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        चेक-इन करें (Check-in)
                      </Link>
                    </div>
                  )}

                  {attendanceState === 'CHECKED_IN' && (
                    <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>साइट पर काम चालू (Checked-In)</span>
                        </div>
                        <span className="text-[10px] text-slate-400 ml-6">
                          चेक-इन: {attendance?.checkInAt ? new Date(attendance.checkInAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      <Link
                        href={`/worker/jobs/${job._id}/check-out`}
                        className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white font-bold rounded-xl text-xs flex items-center gap-1 shadow-md active:scale-95 transition"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        चेक-आउट करें (Check-out)
                      </Link>
                    </div>
                  )}

                  {attendanceState === 'CHECKED_OUT' && (
                    <div className="p-3 bg-slate-800/80 border border-slate-700 rounded-xl space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-slate-300 flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          काम समाप्त (Checked Out: {attendance?.hoursWorked || 0} घंटे)
                        </span>
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-full ${
                            attendance?.contractorSignoff?.status === 'APPROVED'
                              ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                              : attendance?.contractorSignoff?.status === 'DISPUTED'
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                          }`}
                        >
                          {attendance?.contractorSignoff?.status === 'APPROVED'
                            ? '✅ मंज़ूर (Approved)'
                            : attendance?.contractorSignoff?.status === 'DISPUTED'
                            ? '⚠️ विवादित (Disputed)'
                            : '⏳ साइन-ऑफ़ इंतज़ार (Signoff Pending)'}
                        </span>
                      </div>
                    </div>
                  )}

                  {attendanceState === 'MISSED' && (
                    <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl flex items-center gap-2 text-rose-300 text-xs font-bold">
                      <XCircle className="w-4 h-4 text-rose-400" />
                      <span>अनुपस्थित (Absent / Missed) - समय समाप्त</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Nearby Jobs Section Header */}
      <div className="flex items-center justify-between pt-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-black text-white">
            नजदीकी काम (Jobs Near You)
          </h3>
          <span className="text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded-full font-bold">
            {nearbyJobs.length}
          </span>
        </div>

        <button
          onClick={() => {
            fetchNearbyJobs();
            fetchTodayWork();
          }}
          className="p-1.5 text-slate-400 hover:text-white rounded-lg"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Error / Location Prompt */}
      {error && (
        <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-3 text-rose-300 text-xs">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-2">
            <p className="font-semibold">{error}</p>
            <Link
              href="/worker/profile-setup"
              className="inline-block px-3 py-1.5 bg-rose-600 text-white font-bold rounded-lg text-xs"
            >
              लोकेशन सेट करें (Set Location)
            </Link>
          </div>
        </div>
      )}

      {/* Loading Skeleton */}
      {loading && nearbyJobs.length === 0 && (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-32 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse" />
          ))}
        </div>
      )}

      {/* Empty State */}
      {!loading && nearbyJobs.length === 0 && !error && (
        <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
            <Briefcase className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-bold text-white">
              अभी आपके पास कोई नया काम उपलब्ध नहीं है
            </h4>
            <p className="text-xs text-slate-400 mt-1">
              जैसे ही कोई ठेकेदार नया काम डालेगा, आपको तुरंत सूचना मिलेगी।
            </p>
          </div>
        </div>
      )}

      {/* Nearby Jobs Cards List */}
      <div className="space-y-3">
        {nearbyJobs.map((job) => {
          const wageRupees = Math.round((job.wagePerDayPaise || 0) / 100);
          const distKm =
            job.distanceMeters !== undefined
              ? (job.distanceMeters / 1000).toFixed(1)
              : '0.0';

          return (
            <div
              key={job._id}
              className={`p-4 bg-slate-900 border rounded-2xl space-y-3 shadow-md hover:border-slate-700 transition-all ${
                job.isLiveBroadcast ? 'border-amber-400/80 ring-1 ring-amber-400/30' : 'border-slate-800'
              }`}
            >
              {job.isLiveBroadcast && (
                <div className="flex items-center gap-1.5 text-[10px] font-black uppercase text-amber-300 bg-amber-400/20 px-2 py-0.5 rounded-md w-fit animate-pulse">
                  <span>⚡ अभी पोस्ट हुआ (Live Alert)</span>
                </div>
              )}

              <div className="flex items-start justify-between gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-blue-400 bg-blue-500/10 px-2 py-0.5 rounded">
                    {job.skillRequired}
                  </span>
                  <h4 className="text-base font-bold text-white mt-1">
                    {job.title}
                  </h4>
                </div>

                <div className="text-right shrink-0">
                  <div className="text-base font-black text-emerald-400 flex items-center justify-end">
                    <IndianRupee className="w-4 h-4" />
                    <span>{wageRupees}</span>
                    <span className="text-[10px] text-slate-400 font-normal">/दिन</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-4 text-xs text-slate-400 border-t border-slate-800/80 pt-2.5">
                <span className="flex items-center gap-1 text-slate-300">
                  <MapPin className="w-3.5 h-3.5 text-emerald-400" />
                  {distKm} km दूर
                </span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Calendar className="w-3.5 h-3.5 text-blue-400" />
                  {new Date(job.startDate).toLocaleDateString('hi-IN', { day: 'numeric', month: 'short' })}
                </span>
              </div>

              <div className="pt-1">
                <Link
                  href={`/worker/jobs/${job._id}`}
                  className="w-full min-h-[46px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-xs shadow-md transition-transform active:scale-95"
                >
                  विवरण देखें और स्वीकार करें (View & Accept)
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
