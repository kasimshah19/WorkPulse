'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { QRCodeSVG } from 'qrcode.react';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Camera,
  QrCode,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  RefreshCw,
  Phone,
  UserCheck,
  UserX,
  X,
  ShieldCheck,
  HelpCircle,
  Zap,
} from 'lucide-react';
import api from '../../../../../lib/api';
import { useAuthStore } from '../../../../../store/authStore';
import { getSocket } from '../../../../../lib/socket';
import 'leaflet/dist/leaflet.css';

// Dynamic Leaflet Map components for detail sheet
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

function getTodayIST() {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());

  const year = parts.find((p) => p.type === 'year')?.value;
  const month = parts.find((p) => p.type === 'month')?.value;
  const day = parts.find((p) => p.type === 'day')?.value;
  return `${year}-${month}-${day}`;
}

export default function ContractorJobAttendancePage() {
  const params = useParams();
  const jobId = params?.id;
  const router = useRouter();
  const { token, user } = useAuthStore();

  const [date, setDate] = useState(getTodayIST());
  const [job, setJob] = useState(null);
  const [attendanceData, setAttendanceData] = useState([]);
  const [codeInfo, setCodeInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  // Selected row for detail sheet
  const [selectedRow, setSelectedRow] = useState(null);
  const [detailSelfieBlob, setDetailSelfieBlob] = useState(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);

  // Signoff form state
  const [signoffLoading, setSignoffLoading] = useState(false);
  const [disputeReason, setDisputeReason] = useState('');
  const [showDisputeInput, setShowDisputeInput] = useState(false);
  const [signoffError, setSignoffError] = useState('');

  // Cache thumbnail blob URLs: { [attendanceId]: blobUrl }
  const [thumbBlobs, setThumbBlobs] = useState({});

  // Leaflet custom icons
  const [icons, setIcons] = useState(null);
  useEffect(() => {
    import('leaflet').then((L) => {
      const siteIcon = L.divIcon({
        className: 'custom-site-pin',
        html: `<div style="background-color:#2563eb;color:white;padding:5px;border-radius:50%;border:2px solid white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      const checkInIcon = L.divIcon({
        className: 'custom-in-pin',
        html: `<div style="background-color:#10b981;color:white;padding:5px;border-radius:50%;border:2px solid white;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><path d="m12 8 4 4-4 4M8 12h8"/></svg></div>`,
        iconSize: [26, 26],
        iconAnchor: [13, 13],
      });
      setIcons({ siteIcon, checkInIcon });
    });
  }, []);

  const loadAttendance = useCallback(async () => {
    if (!jobId) return;
    try {
      setLoading(true);
      setError('');
      const [jobRes, attRes, codeRes] = await Promise.all([
        api.get(`/jobs/${jobId}`),
        api.get(`/jobs/${jobId}/attendance?date=${date}`),
        api.get(`/jobs/${jobId}/attendance/code`).catch(() => ({ data: null })),
      ]);

      setJob(jobRes.data);
      setAttendanceData(attRes.data || []);
      if (codeRes.data) {
        setCodeInfo(codeRes.data);
      }
    } catch (err) {
      setError(err.message || 'हाज़िरी लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, [jobId, date]);

  useEffect(() => {
    loadAttendance();
  }, [loadAttendance]);

  // Load thumbnail blob URLs securely for any row with a selfie
  useEffect(() => {
    let active = true;
    attendanceData.forEach((row) => {
      const att = row.attendance;
      if (att && att.selfieUrl && !thumbBlobs[att._id]) {
        api
          .get(`/attendance/${att._id}/selfie`, { responseType: 'blob' })
          .then((res) => {
            if (active) {
              const url = URL.createObjectURL(res.data || res);
              setThumbBlobs((prev) => ({ ...prev, [att._id]: url }));
            }
          })
          .catch(() => {});
      }
    });

    return () => {
      active = false;
    };
  }, [attendanceData, thumbBlobs]);

  // Sockets: real-time updates for check-in / check-out / missed
  useEffect(() => {
    if (!token || !jobId) return;
    const socket = getSocket(token);

    socket.emit('job:join', { jobId });

    const handleCheckedIn = (payload) => {
      setToastMessage(`📢 ${payload.workerName || 'कारीगर'} ने चेक-इन किया (${payload.distanceMeters}m)`);
      setTimeout(() => setToastMessage(''), 4000);
      loadAttendance();
    };

    const handleCheckedOut = (payload) => {
      setToastMessage(`📢 ${payload.workerName || 'कारीगर'} ने चेक-आउट किया (${payload.hoursWorked || 0} घंटे)`);
      setTimeout(() => setToastMessage(''), 4000);
      loadAttendance();
    };

    const handleMissed = (payload) => {
      setToastMessage(`⚠️ ${payload.workerName || 'कारीगर'} अनुपस्थित (Missed) मार्क हुआ`);
      setTimeout(() => setToastMessage(''), 4000);
      loadAttendance();
    };

    socket.on('attendance:checkedIn', handleCheckedIn);
    socket.on('attendance:checkedOut', handleCheckedOut);
    socket.on('attendance:missed', handleMissed);

    return () => {
      socket.off('attendance:checkedIn', handleCheckedIn);
      socket.off('attendance:checkedOut', handleCheckedOut);
      socket.off('attendance:missed', handleMissed);
    };
  }, [token, jobId, loadAttendance]);

  // When opening detail sheet, load larger selfie
  useEffect(() => {
    if (!selectedRow?.attendance?.selfieUrl) {
      setDetailSelfieBlob(null);
      return;
    }
    const attId = selectedRow.attendance._id;
    if (thumbBlobs[attId]) {
      setDetailSelfieBlob(thumbBlobs[attId]);
      return;
    }

    let isMounted = true;
    setLoadingSelfie(true);
    api
      .get(`/attendance/${attId}/selfie`, { responseType: 'blob' })
      .then((res) => {
        if (isMounted) {
          const url = URL.createObjectURL(res.data || res);
          setDetailSelfieBlob(url);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoadingSelfie(false);
      });

    return () => {
      isMounted = false;
    };
  }, [selectedRow, thumbBlobs]);

  // Contractor Sign-off Handler
  const handleSignoffDecision = async (decision) => {
    if (!selectedRow?.attendance?._id) return;
    if (decision === 'DISPUTED' && disputeReason.trim().length < 5) {
      setSignoffError('विवाद के लिए कम से कम 5 अक्षरों का कारण लिखें।');
      return;
    }

    setSignoffLoading(true);
    setSignoffError('');

    try {
      await api.post(`/attendance/${selectedRow.attendance._id}/signoff`, {
        decision,
        reason: decision === 'DISPUTED' ? disputeReason.trim() : undefined,
      });

      setSelectedRow(null);
      setShowDisputeInput(false);
      setDisputeReason('');
      setToastMessage(`हाज़िरी ${decision === 'APPROVED' ? 'मंज़ूर' : 'विवादित'} दर्ज की गई।`);
      setTimeout(() => setToastMessage(''), 3000);
      loadAttendance();
    } catch (err) {
      setSignoffError(err.message || 'साइन-ऑफ़ में समस्या हुई।');
    } finally {
      setSignoffLoading(false);
    }
  };

  const siteCoordinates = useMemo(() => {
    if (job?.location?.coordinates) {
      const [lng, lat] = job.location.coordinates;
      return { lat, lng };
    }
    return { lat: 18.5204, lng: 73.8567 };
  }, [job]);

  return (
    <div className="max-w-md mx-auto p-4 space-y-4 pb-24 text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 bg-emerald-600 text-white font-bold text-xs px-4 py-2.5 rounded-2xl shadow-2xl animate-in slide-in-from-top flex items-center gap-2">
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => router.push(`/contractor/jobs/${jobId}`)}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <h1 className="text-base font-black">दैनिक हाज़िरी (Live Attendance)</h1>
          <p className="text-[11px] text-slate-400 truncate max-w-[200px]">{job?.title}</p>
        </div>
        <button
          onClick={loadAttendance}
          className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
          title="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Date Picker Row */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
        <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
          <Calendar className="w-4 h-4 text-emerald-400" />
          तारीख चुनें (Date):
        </span>
        <input
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="bg-slate-950 border border-slate-700 rounded-xl px-2.5 py-1 text-xs text-white font-bold focus:outline-none"
        />
      </div>

      {/* "आज का कोड" (Daily Code & QR) Card */}
      {codeInfo && date === getTodayIST() && (
        <div className="p-4 bg-gradient-to-br from-blue-950/60 to-slate-900 border border-blue-500/30 rounded-2xl space-y-3 shadow-lg">
          <div className="flex items-center justify-between">
            <div>
              <span className="text-[10px] font-black uppercase text-blue-400 tracking-wider">
                आज का हाज़िरी कोड (Daily Code & QR)
              </span>
              <div className="text-2xl font-black text-white tracking-[0.2em] mt-0.5">
                {codeInfo.code}
              </div>
            </div>
            <div className="p-2 bg-white rounded-xl shadow-md">
              <QRCodeSVG
                value={codeInfo.qrPayload || `workpulse:attendance:${jobId}:${codeInfo.code}`}
                size={68}
              />
            </div>
          </div>
          <p className="text-[11px] text-slate-400 leading-snug">
            जिन कारीगरों के पास कैमरा नहीं है या सेल्फ़ी नहीं ले सकते, उन्हें यह QR कोड या 6-अंकीय कोड दिखाएँ।
          </p>
        </div>
      )}

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-xs text-rose-300">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{error}</span>
        </div>
      )}

      {/* Assigned Workers Attendance List */}
      <div className="space-y-3">
        <div className="flex items-center justify-between text-xs text-slate-400 px-1">
          <span>असाइन किए गए कारीगर ({attendanceData.length})</span>
          <span>{date}</span>
        </div>

        {attendanceData.length === 0 && !loading && (
          <div className="p-6 text-center bg-slate-900/60 border border-slate-800 rounded-2xl text-xs text-slate-400">
            इस काम के लिए कोई कारीगर असाइन नहीं है।
          </div>
        )}

        {attendanceData.map((row) => {
          const { worker, status: rowStatus, attendance } = row;
          const isAbsent = rowStatus === 'NOT_STARTED' || !attendance;
          const thumbUrl = attendance?._id ? thumbBlobs[attendance._id] : null;

          return (
            <div
              key={worker._id}
              onClick={() => setSelectedRow(row)}
              className="p-3.5 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl flex items-center justify-between gap-3 cursor-pointer shadow-md transition active:scale-98"
            >
              {/* Photo Thumbnail or Placeholder */}
              <div className="w-12 h-12 rounded-xl bg-slate-950 border border-slate-800 overflow-hidden shrink-0 flex items-center justify-center">
                {thumbUrl ? (
                  <img
                    src={thumbUrl}
                    alt={worker.name}
                    className="w-full h-full object-cover"
                  />
                ) : attendance?.method === 'gps_qr' ? (
                  <QrCode className="w-6 h-6 text-blue-400" />
                ) : isAbsent ? (
                  <UserX className="w-5 h-5 text-slate-600" />
                ) : (
                  <Camera className="w-5 h-5 text-slate-600" />
                )}
              </div>

              {/* Worker Info & Check-in / Out Time */}
              <div className="flex-1 min-w-0 space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <h4 className="text-xs font-bold text-white truncate">{worker.name}</h4>
                  {attendance?.flags?.map((f) => (
                    <span
                      key={f}
                      className="text-[9px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/30 px-1 rounded"
                    >
                      {f}
                    </span>
                  ))}
                  {attendance?.autoCheckout && (
                    <span className="text-[9px] font-black bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1 rounded flex items-center gap-0.5">
                      <Zap className="w-2.5 h-2.5" />
                      Auto
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-slate-400">
                  {isAbsent ? (
                    <span className="text-slate-500 font-medium">अभी तक नहीं आया (Absent)</span>
                  ) : (
                    <>
                      In:{' '}
                      <b className="text-slate-300">
                        {attendance.checkInAt
                          ? new Date(attendance.checkInAt).toLocaleTimeString('hi-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : '--'}
                      </b>
                      {attendance.checkOutAt && (
                        <>
                          {' '}
                          | Out:{' '}
                          <b className="text-slate-300">
                            {new Date(attendance.checkOutAt).toLocaleTimeString('hi-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </b>
                        </>
                      )}
                      {' • '}
                      <span className="text-emerald-400 font-bold">
                        {attendance.checkInDistanceMeters !== null
                          ? `${attendance.checkInDistanceMeters}m`
                          : ''}
                      </span>
                    </>
                  )}
                </p>

                <p className="text-[10px] text-slate-500 flex items-center gap-2">
                  <span>फ़ोन: {worker.phone}</span>
                  {attendance?.hoursWorked > 0 && (
                    <span className="text-emerald-400 font-bold">
                      {attendance.hoursWorked} घंटे
                    </span>
                  )}
                </p>
              </div>

              {/* Status Chip */}
              <div className="text-right shrink-0">
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isAbsent
                      ? 'bg-slate-800 text-slate-400 border border-slate-700'
                      : attendance.status === 'CHECKED_IN'
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                      : attendance.contractorSignoff?.status === 'APPROVED'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                      : attendance.contractorSignoff?.status === 'DISPUTED'
                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                      : 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                  }`}
                >
                  {isAbsent
                    ? 'अनुपस्थित'
                    : attendance.status === 'CHECKED_IN'
                    ? 'साइट पर'
                    : attendance.contractorSignoff?.status === 'APPROVED'
                    ? '✅ मंज़ूर'
                    : attendance.contractorSignoff?.status === 'DISPUTED'
                    ? '⚠️ विवादित'
                    : 'साइन-ऑफ़ बाकी'}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Row Detail Sheet */}
      {selectedRow && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-3">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-4 space-y-3.5 shadow-2xl max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-black text-white">{selectedRow.worker.name}</h3>
                <p className="text-[11px] text-slate-400">फ़ोन: {selectedRow.worker.phone}</p>
              </div>
              <button
                onClick={() => {
                  setSelectedRow(null);
                  setShowDisputeInput(false);
                }}
                className="p-1 bg-slate-800 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {selectedRow.attendance ? (
              <>
                {/* Large Selfie View */}
                {selectedRow.attendance.selfieUrl && (
                  <div className="text-center space-y-1">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      चेक-इन सेल्फ़ी प्रमाण (Selfie Proof)
                    </span>
                    <div className="w-40 h-40 mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 bg-black flex items-center justify-center">
                      {loadingSelfie ? (
                        <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                      ) : detailSelfieBlob ? (
                        <img
                          src={detailSelfieBlob}
                          alt="Selfie"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <span className="text-[10px] text-slate-500">सेल्फ़ी लोड नहीं हुई</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Small Map Showing Site Pin, Worker Check-in Point & Geofence Circle */}
                {selectedRow.attendance.checkInLocation?.coordinates && (
                  <div className="rounded-xl overflow-hidden border border-slate-800 h-32 relative bg-slate-950">
                    {typeof window !== 'undefined' && siteCoordinates.lat && (
                      <MapContainer
                        center={[siteCoordinates.lat, siteCoordinates.lng]}
                        zoom={16}
                        style={{ width: '100%', height: '100%' }}
                        zoomControl={false}
                      >
                        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                        <Circle
                          center={[siteCoordinates.lat, siteCoordinates.lng]}
                          radius={job?.geofenceRadiusMeters || 100}
                          pathOptions={{ color: '#10b981', fillColor: '#10b981', fillOpacity: 0.15 }}
                        />
                        {icons && (
                          <Marker
                            position={[siteCoordinates.lat, siteCoordinates.lng]}
                            icon={icons.siteIcon}
                          />
                        )}
                        {icons && (
                          <Marker
                            position={[
                              selectedRow.attendance.checkInLocation.coordinates[1],
                              selectedRow.attendance.checkInLocation.coordinates[0],
                            ]}
                            icon={icons.checkInIcon}
                          />
                        )}
                      </MapContainer>
                    )}
                  </div>
                )}

                {/* Timeline & Metadata */}
                <div className="bg-slate-950 rounded-2xl p-3 space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-400">
                    <span>चेक-इन समय:</span>
                    <span className="text-white font-semibold">
                      {selectedRow.attendance.checkInAt
                        ? new Date(selectedRow.attendance.checkInAt).toLocaleTimeString('hi-IN')
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>चेक-आउट समय:</span>
                    <span className="text-white font-semibold">
                      {selectedRow.attendance.checkOutAt
                        ? new Date(selectedRow.attendance.checkOutAt).toLocaleTimeString('hi-IN')
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>कुल समय (Hours):</span>
                    <span className="text-emerald-400 font-bold">
                      {selectedRow.attendance.hoursWorked || 0} घंटे
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>साइट से दूरी:</span>
                    <span className="text-white">
                      {selectedRow.attendance.checkInDistanceMeters !== null
                        ? `${selectedRow.attendance.checkInDistanceMeters} m`
                        : '--'}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>प्रमाण विधि:</span>
                    <span className="text-white uppercase font-bold">
                      {selectedRow.attendance.method}
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>साइन-ऑफ़ स्थिति:</span>
                    <span className="text-amber-400 font-bold">
                      {selectedRow.attendance.contractorSignoff?.status}
                    </span>
                  </div>
                </div>

                {signoffError && (
                  <div className="text-[11px] text-rose-400 bg-rose-500/10 p-2 rounded-xl">
                    {signoffError}
                  </div>
                )}

                {/* Approve / Dispute Action Buttons (Only when CHECKED_OUT and PENDING) */}
                {selectedRow.attendance.status === 'CHECKED_OUT' &&
                  selectedRow.attendance.contractorSignoff?.status === 'PENDING' && (
                    <div className="space-y-2 pt-1">
                      {showDisputeInput ? (
                        <div className="space-y-2 bg-rose-950/30 p-2.5 rounded-xl border border-rose-500/30">
                          <label className="text-[11px] text-rose-300 font-bold">
                            विवाद का कारण लिखें (Reason for dispute - min 5 chars):
                          </label>
                          <textarea
                            value={disputeReason}
                            onChange={(e) => setDisputeReason(e.target.value)}
                            placeholder="जैसे: काम पूरा नहीं हुआ, समय से पहले चले गए..."
                            className="w-full bg-slate-900 border border-rose-500/40 rounded-xl p-2 text-xs text-white focus:outline-none"
                            rows={2}
                          />
                          <div className="flex gap-2">
                            <button
                              onClick={() => handleSignoffDecision('DISPUTED')}
                              disabled={signoffLoading}
                              className="flex-1 py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs"
                            >
                              विवाद दर्ज करें (Confirm Dispute)
                            </button>
                            <button
                              onClick={() => setShowDisputeInput(false)}
                              className="py-2 px-3 bg-slate-800 text-slate-300 rounded-xl text-xs"
                            >
                              रद्द करें
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleSignoffDecision('APPROVED')}
                            disabled={signoffLoading}
                            className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                            मंज़ूर करें (Approve - Sahi hai)
                          </button>
                          <button
                            onClick={() => setShowDisputeInput(true)}
                            disabled={signoffLoading}
                            className="py-2.5 px-4 bg-rose-600 hover:bg-rose-500 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-1.5 shadow"
                          >
                            <AlertTriangle className="w-4 h-4" />
                            विवाद (Dispute)
                          </button>
                        </div>
                      )}
                    </div>
                  )}
              </>
            ) : (
              <div className="p-4 bg-slate-950 rounded-2xl text-center space-y-2">
                <UserX className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-xs text-slate-400">
                  कारीगर ने आज इस काम पर चेक-इन नहीं किया है।
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
