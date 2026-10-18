'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import {
  MapPin,
  Camera,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  QrCode,
  ArrowLeft,
  WifiOff,
  Crosshair,
  ShieldAlert,
  Clock,
  Sparkles,
} from 'lucide-react';
import api from '../../../../../lib/api';
import { useAuthStore } from '../../../../../store/authStore';
import { useGeolocation } from '../../../../../hooks/useGeolocation';
import { useCamera } from '../../../../../hooks/useCamera';
import { LocationSimulator } from '../../../../../components/ui/LocationSimulator';
import 'leaflet/dist/leaflet.css';

// Dynamic Leaflet Map components for SSR safety
const MapContainer = dynamic(
  () => import('react-leaflet').then((m) => m.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import('react-leaflet').then((m) => m.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import('react-leaflet').then((m) => m.Marker),
  { ssr: false }
);
const Circle = dynamic(
  () => import('react-leaflet').then((m) => m.Circle),
  { ssr: false }
);

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

export default function CheckInPage() {
  const params = useParams();
  const jobId = params?.id;
  const router = useRouter();
  const { user } = useAuthStore();

  const [job, setJob] = useState(null);
  const [loadingJob, setLoadingJob] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successData, setSuccessData] = useState(null);
  const [networkFailed, setNetworkFailed] = useState(false);

  // Method: 'gps_selfie' | 'gps_qr'
  const [method, setMethod] = useState('gps_selfie');
  const [qrCodeInput, setQrCodeInput] = useState('');

  // Geolocation & Dev simulator
  const geo = useGeolocation();
  const [isSimulated, setIsSimulated] = useState(false);
  const [simCoords, setSimCoords] = useState(null);

  // Effective coordinates: simulated if active, else real GPS
  const effectiveLat = isSimulated && simCoords ? simCoords.lat : geo.lat;
  const effectiveLng = isSimulated && simCoords ? simCoords.lng : geo.lng;
  const effectiveAccuracy = isSimulated && simCoords ? simCoords.accuracy : geo.accuracy;

  // Camera hook
  const camera = useCamera();

  // Leaflet custom icons
  const [icons, setIcons] = useState(null);
  useEffect(() => {
    import('leaflet').then((L) => {
      const siteIcon = L.divIcon({
        className: 'custom-site-pin',
        html: `<div style="background-color:#2563eb;color:white;padding:6px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      const workerIcon = L.divIcon({
        className: 'custom-worker-pin',
        html: `<div style="background-color:#10b981;color:white;padding:6px;border-radius:50%;border:2px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.4);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4M8 12h8"/></svg></div>`,
        iconSize: [32, 32],
        iconAnchor: [16, 16],
      });
      setIcons({ siteIcon, workerIcon });
    });
  }, []);

  // Fetch job details
  useEffect(() => {
    async function loadJob() {
      try {
        setLoadingJob(true);
        const res = await api.get(`/jobs/${jobId}`);
        setJob(res.data);
      } catch (err) {
        setErrorMessage(err.message || 'काम की जानकारी लोड करने में समस्या हुई।');
      } finally {
        setLoadingJob(false);
      }
    }
    if (jobId) loadJob();
  }, [jobId]);

  // Site coordinates: GeoJSON [lng, lat]
  const siteCoordinates = useMemo(() => {
    if (job?.location?.coordinates) {
      const [lng, lat] = job.location.coordinates;
      return { lat, lng };
    }
    return { lat: 18.5204, lng: 73.8567 };
  }, [job]);

  const geofenceRadius = job?.geofenceRadiusMeters || 100;

  // Calculate client-side distance (NOTE: Client check is only for UX; server is the source of truth!)
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
  const isAccuracyAcceptable = effectiveAccuracy !== null && effectiveAccuracy <= 50;

  // Check if check-in button should be enabled
  const canCheckIn =
    !submitting &&
    effectiveLat !== null &&
    effectiveLng !== null &&
    isInsideGeofence &&
    isAccuracyAcceptable &&
    ((method === 'gps_selfie' && camera.capturedPhoto) ||
      (method === 'gps_qr' && qrCodeInput.trim().length === 6));

  const handleCheckInSubmit = async () => {
    if (!canCheckIn) return;
    setSubmitting(true);
    setErrorMessage('');
    setNetworkFailed(false);

    try {
      const formData = new FormData();
      formData.append('lat', String(effectiveLat));
      formData.append('lng', String(effectiveLng));
      formData.append('accuracy', String(effectiveAccuracy || 10));
      formData.append('clientTimestamp', new Date().toISOString());
      formData.append('method', method);
      formData.append(
        'deviceInfo',
        JSON.stringify({
          userAgent: navigator.userAgent,
          platform: navigator.platform,
          screen: `${window.innerWidth}x${window.innerHeight}`,
        })
      );

      if (method === 'gps_selfie' && camera.capturedPhoto?.file) {
        formData.append('selfie', camera.capturedPhoto.file);
      } else if (method === 'gps_qr') {
        formData.append('code', qrCodeInput.trim());
      }

      const res = await api.post(`/jobs/${jobId}/attendance/check-in`, formData);
      setSuccessData(res.data);
    } catch (err) {
      if (!err.status) {
        setNetworkFailed(true);
      }
      setErrorMessage(err.message || 'चेक-इन विफल हुआ। कृपया दोबारा प्रयास करें।');
    } finally {
      setSubmitting(false);
    }
  };

  if (loadingJob) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center p-4">
        <div className="flex items-center gap-3 text-slate-300">
          <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
          <span>काम की जानकारी लोड हो रही है...</span>
        </div>
      </div>
    );
  }

  // Full-screen Success Confirmation
  if (successData) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center space-y-6">
        <div className="w-20 h-20 rounded-full bg-emerald-500/20 border-2 border-emerald-500 text-emerald-400 flex items-center justify-center shadow-lg shadow-emerald-500/20 animate-bounce">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black text-white">
            चेक-इन सफल! (Check-in Confirmed)
          </h1>
          <p className="text-sm text-emerald-400 font-bold">
            आपकी हाज़िरी और लोकेशन सुरक्षित दर्ज हो गई है।
          </p>
        </div>

        {/* Thumbnail preview */}
        {camera.capturedPhoto?.dataUrl && (
          <div className="w-36 h-36 rounded-2xl overflow-hidden border-2 border-slate-700 shadow-xl mx-auto">
            <img
              src={camera.capturedPhoto.dataUrl}
              alt="Selfie Proof"
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 w-full max-w-sm text-left text-xs space-y-2">
          <div className="flex justify-between text-slate-400">
            <span>समय (Time):</span>
            <span className="text-white font-bold">
              {new Date().toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>साइट से दूरी (Distance):</span>
            <span className="text-emerald-400 font-bold">
              {successData.checkInDistanceMeters || distanceMeters || 0} m
            </span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>प्रमाण का तरीका (Method):</span>
            <span className="text-white font-bold uppercase">{method}</span>
          </div>
        </div>

        <button
          onClick={() => router.push('/worker/dashboard')}
          className="w-full max-w-sm py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black rounded-xl shadow-lg transition active:scale-95"
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
          <h1 className="text-base font-black">हाज़िरी चेक-इन (Daily Check-in)</h1>
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

      {/* Connection Lost Banner */}
      {networkFailed && (
        <div className="p-3 bg-rose-500/20 border-2 border-rose-500/40 rounded-2xl flex items-center justify-between">
          <div className="flex items-center gap-2 text-rose-300 text-xs">
            <WifiOff className="w-4 h-4 shrink-0 text-rose-400" />
            <span>कमज़ोर नेटवर्क। आपकी खींची हुई सेल्फ़ी सुरक्षित है।</span>
          </div>
          <button
            onClick={handleCheckInSubmit}
            className="px-3 py-1 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-lg text-xs"
          >
            दोबारा भेजें
          </button>
        </div>
      )}

      {/* Error Message */}
      {errorMessage && (
        <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-start gap-2.5 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 1. Map with Site Geofence and Worker Position */}
      <div className="rounded-2xl overflow-hidden border border-slate-800 shadow-lg relative h-48 bg-slate-900">
        {typeof window !== 'undefined' && siteCoordinates.lat && (
          <MapContainer
            center={[siteCoordinates.lat, siteCoordinates.lng]}
            zoom={16}
            style={{ width: '100%', height: '100%' }}
            zoomControl={false}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            {/* Geofence Circle */}
            <Circle
              center={[siteCoordinates.lat, siteCoordinates.lng]}
              radius={geofenceRadius}
              pathOptions={{
                color: isInsideGeofence ? '#10b981' : '#ef4444',
                fillColor: isInsideGeofence ? '#10b981' : '#ef4444',
                fillOpacity: 0.15,
                weight: 2,
              }}
            />
            {/* Site Pin */}
            {icons && (
              <Marker
                position={[siteCoordinates.lat, siteCoordinates.lng]}
                icon={icons.siteIcon}
              />
            )}
            {/* Worker Pin */}
            {icons && effectiveLat && effectiveLng && (
              <Marker
                position={[effectiveLat, effectiveLng]}
                icon={icons.workerIcon}
              />
            )}
          </MapContainer>
        )}

        <div className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur px-2.5 py-1 rounded-lg border border-slate-700 text-[10px] text-slate-300 flex items-center gap-1.5 z-[1000]">
          <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
          <span>दायरा: {geofenceRadius}m</span>
        </div>
      </div>

      {/* 2. Large Distance & Accuracy Indicator */}
      <div
        className={`p-4 rounded-2xl border-2 flex items-center justify-between shadow-md transition-all ${
          isInsideGeofence
            ? 'bg-emerald-950/40 border-emerald-500/60 text-emerald-300'
            : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
        }`}
      >
        <div className="flex items-center gap-3">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold ${
              isInsideGeofence ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}
          >
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <div className="text-base font-black">
              {distanceMeters !== null
                ? `साइट से ${distanceMeters} m दूर`
                : 'दूरी की गणना हो रही है...'}
            </div>
            <p className="text-[11px] font-medium opacity-80">
              {isInsideGeofence
                ? '✅ आप कार्यस्थल के अंदर हैं (Inside Geofence)'
                : `❌ साइट से बाहर हैं (Allowed: ${geofenceRadius}m के अंदर आएं)`}
            </p>
          </div>
        </div>

        <div className="text-right text-[11px]">
          <span className="opacity-70">GPS सटीकता</span>
          <div
            className={`font-bold ${
              isAccuracyAcceptable ? 'text-emerald-400' : 'text-amber-400'
            }`}
          >
            {effectiveAccuracy !== null ? `±${effectiveAccuracy}m` : '--'}
          </div>
        </div>
      </div>

      {/* Accuracy Warning if > 50m */}
      {!isAccuracyAcceptable && effectiveAccuracy !== null && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl flex items-center gap-2 text-xs text-amber-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <span>GPS सिग्नल कमज़ोर है ({effectiveAccuracy}m). कृपया खुले आसमान के नीचे जाएँ।</span>
        </div>
      )}

      {/* 3. Verification Method: Selfie or QR Fallback */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            {method === 'gps_selfie' ? (
              <>
                <Camera className="w-4 h-4 text-emerald-400" />
                सेल्फ़ी उपस्थिति (Selfie Proof)
              </>
            ) : (
              <>
                <QrCode className="w-4 h-4 text-blue-400" />
                डेली कोड उपस्थिति (Daily Code Proof)
              </>
            )}
          </span>

          <button
            type="button"
            onClick={() => {
              setMethod(method === 'gps_selfie' ? 'gps_qr' : 'gps_selfie');
              setErrorMessage('');
            }}
            className="text-[11px] text-blue-400 hover:text-blue-300 underline font-semibold"
          >
            {method === 'gps_selfie'
              ? 'सेल्फी नहीं ले सकते? कोड से चेक-इन'
              : 'सेल्फ़ी से चेक-इन करें'}
          </button>
        </div>

        {/* Method A: GPS + Selfie */}
        {method === 'gps_selfie' && (
          <div className="space-y-3">
            {!camera.capturedPhoto ? (
              <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 aspect-[4/3] flex flex-col items-center justify-center">
                {camera.cameraActive ? (
                  <>
                    <video
                      ref={camera.videoRef}
                      playsInline
                      muted
                      autoPlay
                      className="w-full h-full object-cover -scale-x-100"
                    />
                    <div className="absolute bottom-3 left-0 right-0 flex justify-center">
                      <button
                        type="button"
                        onClick={camera.capturePhoto}
                        className="p-3 bg-white text-slate-900 rounded-full shadow-2xl hover:bg-slate-200 active:scale-90 transition border-4 border-emerald-500"
                        title="फोटो खींचें"
                      >
                        <Camera className="w-6 h-6" />
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="p-6 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-400">
                      <Camera className="w-6 h-6" />
                    </div>
                    <div>
                      <p className="text-xs text-slate-300 font-semibold">
                        साइट पर अपनी ताज़ा सेल्फ़ी लें
                      </p>
                      <p className="text-[11px] text-slate-500">
                        चेहरा साफ़ दिखना चाहिए (2G/3G के लिए ऑटो-कंप्रेस)
                      </p>
                    </div>

                    <div className="flex flex-col gap-2 pt-2">
                      <button
                        type="button"
                        onClick={camera.startCamera}
                        className="py-2.5 px-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 transition"
                      >
                        <Camera className="w-4 h-4" />
                        कैमरा खोलें (Open Camera)
                      </button>

                      {/* File upload fallback */}
                      <label className="py-2 px-4 bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold rounded-xl text-xs cursor-pointer text-center">
                        फ़ाइल से सेल्फ़ी चुनें
                        <input
                          type="file"
                          accept="image/*"
                          capture="user"
                          className="hidden"
                          onChange={(e) => {
                            if (e.target.files?.[0]) {
                              camera.handleFileUpload(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="relative rounded-2xl overflow-hidden border border-emerald-500/50 aspect-[4/3] bg-slate-950">
                <img
                  src={camera.capturedPhoto.dataUrl}
                  alt="Captured Selfie"
                  className="w-full h-full object-cover"
                />
                <div className="absolute top-2 right-2 bg-emerald-600 text-white text-[10px] font-black px-2 py-0.5 rounded-full shadow">
                  ✓ सेल्फ़ी तैयार
                </div>
                <div className="absolute bottom-2 left-2 right-2 flex justify-between">
                  <button
                    type="button"
                    onClick={camera.retake}
                    className="py-1.5 px-3 bg-slate-900/80 backdrop-blur border border-slate-700 text-white text-xs font-bold rounded-xl shadow"
                  >
                    दोबारा लें (Retake)
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Method B: GPS + Daily Code */}
        {method === 'gps_qr' && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-slate-400">
              ठेकेदार के फ़ोन स्क्रीन पर दिख रहा 6-अंकों का कोड दर्ज करें:
            </p>
            <input
              type="text"
              maxLength={6}
              value={qrCodeInput}
              onChange={(e) => setQrCodeInput(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="w-full text-center tracking-[0.5em] text-2xl font-black rounded-xl bg-slate-950 border border-slate-700 py-3 text-white focus:border-blue-500 focus:outline-none"
            />
            <p className="text-[11px] text-slate-500 text-center">
              *नोट: कोड के साथ भी GPS लोकेशन का साइट के अंदर होना आवश्यक है।
            </p>
          </div>
        )}
      </div>

      {/* 4. Big Green Check-in Button */}
      <button
        type="button"
        disabled={!canCheckIn}
        onClick={handleCheckInSubmit}
        className={`w-full min-h-[52px] rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-xl transition-all ${
          canCheckIn
            ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-600/30 active:scale-98'
            : 'bg-slate-800 text-slate-500 cursor-not-allowed border border-slate-700/50'
        }`}
      >
        {submitting ? (
          <>
            <RefreshCw className="w-5 h-5 animate-spin" />
            <span>हाज़िरी दर्ज हो रही है...</span>
          </>
        ) : (
          <>
            <CheckCircle2 className="w-5 h-5" />
            <span>चेक-इन करें (Check-in Karein)</span>
          </>
        )}
      </button>

      {/* Helper text explaining disabled state */}
      {!canCheckIn && (
        <p className="text-center text-[11px] text-slate-400">
          {!isInsideGeofence
            ? '❌ चेक-इन के लिए साइट के दायरे (100m) के अंदर आएँ।'
            : !isAccuracyAcceptable
            ? '❌ चेक-इन के लिए बेहतर GPS सटीकता (≤50m) आवश्यक है।'
            : method === 'gps_selfie' && !camera.capturedPhoto
            ? '📸 चेक-इन के लिए पहले सेल्फ़ी लें।'
            : method === 'gps_qr' && qrCodeInput.trim().length !== 6
            ? '🔢 6-अंकों का कोड दर्ज करें।'
            : ''}
        </p>
      )}
    </div>
  );
}
