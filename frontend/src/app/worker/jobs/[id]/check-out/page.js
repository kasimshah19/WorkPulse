'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  LogOut,
  Clock,
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  RefreshCw,
  Hourglass,
  Calendar,
} from 'lucide-react';
import api from '../../../../../lib/api';
import { useAuthStore } from '../../../../../store/authStore';
import { useGeolocation } from '../../../../../hooks/useGeolocation';
import { useCamera } from '../../../../../hooks/useCamera';
import { LocationSimulator } from '../../../../../components/ui/LocationSimulator';

function haversineMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export default function CheckOutPage() {
  const params = useParams();
  const jobId = params?.id;
  const router = useRouter();
  const { user } = useAuthStore();

  const [job, setJob] = useState(null);
  const [attendance, setAttendance] = useState(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);

  // Live timer for hours worked
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Geolocation & Dev simulator
  const geo = useGeolocation();
  const [isSimulated, setIsSimulated] = useState(false);
  const [simCoords, setSimCoords] = useState(null);

  const effectiveLat = isSimulated && simCoords ? simCoords.lat : geo.lat;
  const effectiveLng = isSimulated && simCoords ? simCoords.lng : geo.lng;
  const effectiveAccuracy = isSimulated && simCoords ? simCoords.accuracy : geo.accuracy;

  // Optional selfie for checkout
  const camera = useCamera();

  // Load today's attendance & job
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        const [jobRes, todayRes] = await Promise.all([
          api.get(`/jobs/${jobId}`),
          api.get('/attendance/today'),
        ]);

        setJob(jobRes.data);

        const currentAtt = todayRes.data?.find(
          (item) => String(item.job?._id) === String(jobId)
        );

        if (currentAtt?.attendance) {
          setAttendance(currentAtt.attendance);
        } else {
          setErrorMessage('आज का कोई सक्रिय चेक-इन नहीं मिला।');
        }
      } catch (err) {
        setErrorMessage(err.message || 'डेटा लोड करने में समस्या हुई।');
      } finally {
        setLoading(false);
      }
    }
    if (jobId) init();
  }, [jobId]);

  // Live timer tick
  useEffect(() => {
    if (!attendance?.checkInAt) return;
    const checkInTime = new Date(attendance.checkInAt).getTime();

    const updateTimer = () => {
      const now = Date.now();
      const diffSec = Math.max(0, Math.floor((now - checkInTime) / 1000));
      setElapsedSeconds(diffSec);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [attendance]);

  const formattedElapsedTime = useMemo(() => {
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes
      .toString()
      .padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  }, [elapsedSeconds]);

  const decimalHours = useMemo(() => {
    return (elapsedSeconds / 3600).toFixed(2);
  }, [elapsedSeconds]);

  // Site coordinates & distance
  const siteCoordinates = useMemo(() => {
    if (job?.location?.coordinates) {
      const [lng, lat] = job.location.coordinates;
      return { lat, lng };
    }
    return { lat: 18.5204, lng: 73.8567 };
  }, [job]);

  const geofenceRadius = job?.geofenceRadiusMeters || 100;

  const distanceMeters = useMemo(() => {
    if (effectiveLat && effectiveLng && siteCoordinates.lat && siteCoordinates.lng) {
      return haversineMeters(
        siteCoordinates.lat,
        siteCoordinates.lng,
        effectiveLat,
        effectiveLng
      );
    }
    return null;
  }, [effectiveLat, effectiveLng, siteCoordinates]);

  const isInsideGeofence = distanceMeters !== null && distanceMeters <= geofenceRadius;

  const handleCheckOutSubmit = async () => {
    if (!effectiveLat || !effectiveLng) {
      setErrorMessage('GPS लोकेशन प्राप्त नहीं हुई है।');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const formData = new FormData();
      formData.append('lat', String(effectiveLat));
      formData.append('lng', String(effectiveLng));
      formData.append('accuracy', String(effectiveAccuracy || 10));
      formData.append('clientTimestamp', new Date().toISOString());

      if (camera.capturedPhoto?.file) {
        formData.append('selfie', camera.capturedPhoto.file);
      }

      const res = await api.post(`/jobs/${jobId}/attendance/check-out`, formData);
      setSuccessData(res.data);
    } catch (err) {
      setErrorMessage(err.message || 'चेक-आउट विफल हुआ। कृपया दोबारा प्रयास करें।');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-300">
          <RefreshCw className="w-5 h-5 animate-spin text-amber-400" />
          <span>हाज़िरी विवरण लोड हो रहा है...</span>
        </div>
      </div>
    );
  }

  // Full-screen Success State
  if (successData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-amber-500/20 border-2 border-amber-500 text-amber-400 flex items-center justify-center shadow-lg shadow-amber-500/20">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">
            चेक-आउट सफल! (Checked Out)
          </h1>
          <p className="text-sm text-slate-300">
            आज कुल काम: <b className="text-emerald-400 font-bold">{successData.hoursWorked || decimalHours} घंटे</b>
          </p>
        </div>

        <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl w-full max-w-sm text-amber-300 text-xs font-semibold flex items-center justify-center gap-2">
          <Hourglass className="w-4 h-4 text-amber-400 shrink-0" />
          <span>ठेकेदार के हस्ताक्षर का इंतज़ार (Waiting for contractor sign-off)</span>
        </div>

        <button
          onClick={() => router.push('/worker/dashboard')}
          className="w-full max-w-sm py-3.5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded-xl shadow-lg transition active:scale-95"
        >
          डैशबोर्ड पर जाएँ (Go to Dashboard)
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-24 text-white">
      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.back()}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-base font-black">हाज़िरी चेक-आउट (Check-out)</h1>
          <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{job?.title}</p>
        </div>
        <div className="w-9" />
      </div>

      {/* DEV Location Simulator Panel */}
      <LocationSimulator
        siteLat={siteCoordinates.lat}
        siteLng={siteCoordinates.lng}
        active={isSimulated}
        onToggleActive={(active) => setIsSimulated(active)}
        onLocationChange={(coords) => setSimCoords(coords)}
      />

      {errorMessage && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Live Running Timer Card */}
      <div className="p-6 bg-gradient-to-br from-slate-900 to-slate-850 border border-slate-800 rounded-3xl text-center space-y-3 shadow-xl">
        <div className="flex items-center justify-center gap-1.5 text-xs font-bold text-amber-400 uppercase tracking-widest">
          <Clock className="w-4 h-4 animate-pulse" />
          <span>काम का समय (Hours Worked)</span>
        </div>

        <div className="text-5xl font-black tracking-tight text-white font-mono">
          {formattedElapsedTime}
        </div>

        <p className="text-xs text-slate-400">
          चेक-इन समय:{' '}
          <span className="text-white font-bold">
            {attendance?.checkInAt
              ? new Date(attendance.checkInAt).toLocaleTimeString('hi-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--:--'}
          </span>{' '}
          ({decimalHours} घंटे)
        </p>
      </div>

      {/* 2. Distance Indicator */}
      <div
        className={`p-4 rounded-2xl border-2 flex items-center justify-between shadow-md ${
          isInsideGeofence
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center ${
              isInsideGeofence ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-sm font-black">
              {distanceMeters !== null
                ? `साइट से ${distanceMeters} m दूर`
                : 'दूरी की गणना हो रही है...'}
            </div>
            <p className="text-[11px] font-medium opacity-80">
              {isInsideGeofence ? 'साइट के दायरे के अंदर' : 'साइट के दायरे से बाहर'}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px]">
          <span className="opacity-70">सटीकता</span>
          <div className="font-bold text-white">±{effectiveAccuracy || 10}m</div>
        </div>
      </div>

      {/* 3. Optional Checkout Selfie */}
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <Camera className="w-4 h-4 text-slate-400" />
            चेक-आउट फ़ोटो (वैकल्पिक / Optional)
          </span>
          {camera.capturedPhoto && (
            <button
              onClick={camera.retake}
              className="text-[11px] text-blue-400 underline font-semibold"
            >
              दोबारा लें
            </button>
          )}
        </div>

        {camera.capturedPhoto ? (
          <div className="w-28 h-28 rounded-xl overflow-hidden border border-slate-700 mx-auto">
            <img
              src={camera.capturedPhoto.dataUrl}
              alt="Checkout Selfie"
              className="w-full h-full object-cover"
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={camera.startCamera}
            className="w-full py-2.5 px-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-2"
          >
            <Camera className="w-4 h-4" />
            चेक-आउट सेल्फ़ी जोड़ें (Add Selfie)
          </button>
        )}

        {camera.cameraActive && !camera.capturedPhoto && (
          <div className="rounded-xl overflow-hidden border border-slate-700 aspect-[4/3] bg-black relative">
            <video
              ref={camera.videoRef}
              playsInline
              muted
              autoPlay
              className="w-full h-full object-cover -scale-x-100"
            />
            <button
              onClick={camera.capturePhoto}
              className="absolute bottom-2 left-1/2 -translate-x-1/2 p-2.5 bg-white text-slate-900 rounded-full shadow border-2 border-amber-500"
            >
              <Camera className="w-5 h-5" />
            </button>
          </div>
        )}
      </div>

      {/* 4. Big Check-out Button */}
      <button
        type="button"
        disabled={submitting || !effectiveLat}
        onClick={handleCheckOutSubmit}
        className={`w-full min-h-[52px] rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
          !submitting && effectiveLat
            ? 'bg-amber-600 hover:bg-amber-500 text-white shadow-amber-600/30 active:scale-98'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed'
        }`}
      >
        {submitting ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>चेक-आउट दर्ज हो रहा है...</span>
          </>
        ) : (
          <>
            <LogOut className="w-5 h-5" />
            <span>चेक-आउट करें (Check-out Karein)</span>
          </>
        )}
      </button>
    </div>
  );
}
