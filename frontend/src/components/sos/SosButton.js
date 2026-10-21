'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  AlertTriangle,
  Siren,
  PhoneCall,
  MessageSquare,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import api from '../../lib/api';
import { useSocketStore } from '../../store/socketStore';
import { getSocket } from '../../lib/socket';
import { useAuthStore } from '../../store/authStore';

function generateClientUuid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `sos-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

const HOLD_DURATION_MS = 2000;
const CANCEL_COUNTDOWN_SEC = 5;

export function SosButton() {
  const { user, token } = useAuthStore();
  const [holding, setHolding] = useState(false);
  const [holdProgress, setHoldProgress] = useState(0); // 0 to 100
  const [countdownActive, setCountdownActive] = useState(false);
  const [countdownLeft, setCountdownLeft] = useState(CANCEL_COUNTDOWN_SEC);
  const [notifyContractor, setNotifyContractor] = useState(true);

  // Active SOS incident state
  const [activeIncident, setActiveIncident] = useState(null);
  const [sending, setSending] = useState(false);
  const [offlinePending, setOfflinePending] = useState(false);
  const [acknowledgedBy, setAcknowledgedBy] = useState([]);
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolving, setResolving] = useState(false);

  const holdTimerRef = useRef(null);
  const progressIntervalRef = useRef(null);
  const countdownIntervalRef = useRef(null);
  const locationWatchIdRef = useRef(null);
  const wakeLockRef = useRef(null);
  const currentKeyRef = useRef(null);

  // Check on mount if user already has an active open SOS
  useEffect(() => {
    if (!token || user?.role !== 'worker') return;

    api
      .get('/incidents/my?status=OPEN')
      .then((res) => {
        const incidents = res.data?.incidents || res.incidents || [];
        const openSos = incidents.find((i) => i.type === 'SOS');
        if (openSos) {
          setActiveIncident(openSos);
        }
      })
      .catch((_err) => {});
  }, [token, user]);

  // Wake Lock API to keep phone screen awake during active emergency
  useEffect(() => {
    if (activeIncident && 'wakeLock' in navigator) {
      navigator.wakeLock
        .request('screen')
        .then((lock) => {
          wakeLockRef.current = lock;
        })
        .catch(() => {});
    }

    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, [activeIncident]);

  // Socket listener for acknowledgment and live events
  useEffect(() => {
    if (!token || !activeIncident) return;
    const socket = getSocket(token);

    const onAck = (payload) => {
      if (payload.incidentId === activeIncident._id) {
        setAcknowledgedBy((prev) => [
          ...prev,
          { name: payload.byName, role: payload.byRole, at: payload.at },
        ]);
        if (navigator.vibrate) {
          try {
            navigator.vibrate([100, 50, 100]);
          } catch (_e) {}
        }
      }
    };

    const onResolved = (payload) => {
      if (payload.incidentId === activeIncident._id) {
        setActiveIncident(null);
        if (locationWatchIdRef.current !== null) {
          navigator.geolocation.clearWatch(locationWatchIdRef.current);
          locationWatchIdRef.current = null;
        }
      }
    };

    socket.on('sos:acknowledged', onAck);
    socket.on('sos:resolved', onResolved);

    return () => {
      socket.off('sos:acknowledged', onAck);
      socket.off('sos:resolved', onResolved);
    };
  }, [token, activeIncident]);

  // Continuous location tracking during active SOS (every 15s)
  useEffect(() => {
    if (!activeIncident || !navigator.geolocation) return;

    let lastSent = Date.now();
    locationWatchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const now = Date.now();
        if (now - lastSent >= 15000) {
          lastSent = now;
          api
            .post(`/incidents/${activeIncident._id}/location`, {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
            })
            .catch(() => {});
        }
      },
      () => {},
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 10000 }
    );

    return () => {
      if (locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    };
  }, [activeIncident]);

  // Press & Hold handling
  const startHold = () => {
    if (activeIncident || countdownActive) return;
    setHolding(true);
    setHoldProgress(0);

    if (navigator.vibrate) {
      try {
        navigator.vibrate(50);
      } catch (_e) {}
    }

    const startTime = Date.now();
    progressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, (elapsed / HOLD_DURATION_MS) * 100);
      setHoldProgress(pct);

      if (elapsed >= HOLD_DURATION_MS) {
        clearInterval(progressIntervalRef.current);
        setHolding(false);
        setHoldProgress(0);
        triggerCountdown();
      }
    }, 50);
  };

  const cancelHold = () => {
    if (progressIntervalRef.current) clearInterval(progressIntervalRef.current);
    setHolding(false);
    setHoldProgress(0);
  };

  const triggerCountdown = () => {
    if (navigator.vibrate) {
      try {
        navigator.vibrate([200, 100, 200]);
      } catch (_e) {}
    }
    setCountdownActive(true);
    setCountdownLeft(CANCEL_COUNTDOWN_SEC);

    countdownIntervalRef.current = setInterval(() => {
      setCountdownLeft((prev) => {
        if (prev <= 1) {
          clearInterval(countdownIntervalRef.current);
          dispatchSos();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const cancelCountdown = () => {
    if (countdownIntervalRef.current) clearInterval(countdownIntervalRef.current);
    setCountdownActive(false);
    setCountdownLeft(CANCEL_COUNTDOWN_SEC);
  };

  // Dispatch SOS alert with offline tolerance
  const dispatchSos = async () => {
    setCountdownActive(false);
    setSending(true);

    const idempotencyKey = currentKeyRef.current || generateClientUuid();
    currentKeyRef.current = idempotencyKey;

    let coords = null;
    let accuracy = null;
    let locationAgeSec = null;

    // Get location with 4s timeout (never fail if GPS denied)
    try {
      const pos = await new Promise((resolve, reject) => {
        if (!navigator.geolocation) return reject(new Error('No GPS'));
        const timer = setTimeout(() => reject(new Error('Timeout')), 4000);
        navigator.geolocation.getCurrentPosition(
          (p) => {
            clearTimeout(timer);
            resolve(p);
          },
          (err) => {
            clearTimeout(timer);
            reject(err);
          },
          { enableHighAccuracy: true, timeout: 4000, maximumAge: 15000 }
        );
      });
      coords = [pos.coords.longitude, pos.coords.latitude];
      accuracy = pos.coords.accuracy;
      locationAgeSec = Math.round((Date.now() - pos.timestamp) / 1000);
    } catch (_err) {
      // Fallback: will use server-side last known user location or set locationFlag MISSING
    }

    const payload = {
      idempotencyKey,
      notifyContractor,
      lat: coords ? coords[1] : null,
      lng: coords ? coords[0] : null,
      accuracy,
      locationAgeSec,
      clientTimestamp: new Date().toISOString(),
    };

    // Save to localStorage for offline retry
    try {
      localStorage.setItem('workpulse_pending_sos', JSON.stringify(payload));
    } catch (_e) {}

    try {
      const res = await api.post('/incidents/sos', payload);
      const incident = res.data?.incident || res.incident;
      setActiveIncident(incident);
      localStorage.removeItem('workpulse_pending_sos');
      setOfflinePending(false);
    } catch (err) {
      // Network failure -> prompt fallback card and trigger offline background retry
      setOfflinePending(true);
      window.addEventListener(
        'online',
        () => {
          dispatchSos();
        },
        { once: true }
      );
    } finally {
      setSending(false);
    }
  };

  // Resolve with SELF_SAFE
  const handleResolveSelfSafe = async () => {
    if (!activeIncident) return;
    setResolving(true);
    try {
      await api.post(`/incidents/${activeIncident._id}/resolve`, {
        resolutionType: 'SELF_SAFE',
        notes: 'Worker marked self safe from app',
      });
      setActiveIncident(null);
      setShowResolveModal(false);
      if (locationWatchIdRef.current !== null) {
        navigator.geolocation.clearWatch(locationWatchIdRef.current);
        locationWatchIdRef.current = null;
      }
    } catch (err) {
      alert(err.message || 'Error resolving incident');
    } finally {
      setResolving(false);
    }
  };

  // Only render for worker users
  if (user?.role !== 'worker') return null;

  return (
    <>
      {/* Persistent Floating SOS Button (mounted above BottomNav) */}
      {!activeIncident && !countdownActive && (
        <div className="fixed bottom-20 right-4 z-40 select-none">
          <button
            type="button"
            id="sos-button"
            aria-label="Emergency SOS (Hold 2 seconds)"
            onMouseDown={startHold}
            onMouseUp={cancelHold}
            onMouseLeave={cancelHold}
            onTouchStart={startHold}
            onTouchEnd={cancelHold}
            onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && startHold()}
            onKeyUp={cancelHold}
            className="relative w-18 h-18 min-w-[70px] min-h-[70px] rounded-full bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-xl shadow-rose-900/50 flex flex-col items-center justify-center border-4 border-rose-400 focus:outline-none focus:ring-4 focus:ring-rose-400 transform transition-transform active:scale-95"
          >
            {/* SVG Circular Progress Ring */}
            <svg className="absolute -top-1.5 -left-1.5 w-[76px] h-[76px] transform -rotate-90 pointer-events-none">
              <circle cx="38" cy="38" r="34" stroke="currentColor" strokeWidth="4" className="text-rose-900/30 fill-none" />
              {holding && (
                <circle
                  cx="38"
                  cy="38"
                  r="34"
                  stroke="currentColor"
                  strokeWidth="4"
                  strokeDasharray={213}
                  strokeDashoffset={213 - (213 * holdProgress) / 100}
                  className="text-white fill-none transition-all duration-75"
                />
              )}
            </svg>

            <Siren className="w-8 h-8 animate-pulse text-white" />
            <span className="text-[11px] font-black uppercase tracking-wider text-white">SOS</span>
          </button>
        </div>
      )}

      {/* 5-Second Cancel Countdown Fullscreen Overlay */}
      {countdownActive && (
        <div className="fixed inset-0 z-50 bg-rose-950/95 backdrop-blur-md flex flex-col items-center justify-between p-6 text-white text-center animate-fadeIn">
          <div className="w-full max-w-sm mt-8 space-y-3">
            <div className="w-20 h-20 rounded-full bg-rose-600 border-4 border-rose-400 mx-auto flex items-center justify-center animate-ping">
              <Siren className="w-10 h-10 text-white" />
            </div>
            <h2 className="text-2xl font-black tracking-tight">SOS भेजा जा रहा है...</h2>
            <p className="text-sm text-rose-200">
              ठेकेदार, साथी कारीगरों, परिवार और एडमिन को लाइव लोकेशन के साथ अलर्ट जा रहा है।
            </p>

            <div className="py-6">
              <span className="text-7xl font-black text-rose-100 font-mono">{countdownLeft}</span>
              <span className="block text-xs uppercase tracking-widest text-rose-300 mt-1">सेकंड बाकी (Seconds Left)</span>
            </div>

            {/* Privacy toggle: Notify contractor */}
            <label className="flex items-center justify-center gap-2 p-3 bg-rose-900/60 rounded-xl border border-rose-800 cursor-pointer text-xs font-semibold">
              <input
                type="checkbox"
                checked={notifyContractor}
                onChange={(e) => setNotifyContractor(e.target.checked)}
                className="w-4 h-4 rounded text-rose-600 focus:ring-0"
              />
              <span>ठेकेदार को भी अलर्ट भेजें (Notify Contractor)</span>
            </label>
          </div>

          <div className="w-full max-w-sm pb-6">
            <button
              type="button"
              onClick={cancelCountdown}
              className="w-full min-h-[56px] py-4 rounded-2xl bg-white text-rose-950 font-black text-base shadow-2xl active:scale-95 transition-all flex items-center justify-center gap-2 border-2 border-rose-200"
            >
              <XCircle className="w-6 h-6 text-rose-600" />
              <span>रोक दें / रद्द करें (Cancel SOS)</span>
            </button>
          </div>
        </div>
      )}

      {/* Active SOS Status / Rescue Screen */}
      {activeIncident && (
        <div className="fixed inset-0 z-50 bg-slate-950 text-white flex flex-col justify-between p-4 overflow-y-auto">
          <div className="space-y-4 max-w-md mx-auto w-full pt-2">
            {/* Live Emergency Banner */}
            <div className="p-4 rounded-2xl bg-rose-950/80 border-2 border-rose-600 text-center space-y-2">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600 text-white font-bold text-xs uppercase tracking-wider animate-pulse">
                <Siren className="w-4 h-4" />
                <span>आपातकालीन अलर्ट सक्रिय (SOS Active)</span>
              </div>
              <h2 className="text-lg font-black text-white">मदद भेजी जा रही है</h2>
              <p className="text-xs text-rose-200">
                आपकी लाइव लोकेशन शेयर हो रही है। कृपया सुरक्षित जगह पर रहें।
              </p>
            </div>

            {/* Live Alert Checklist */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <span className="text-xs font-bold text-slate-300 block">अलर्ट डिलीवरी स्थिति (Alert Status):</span>

              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>ठेकेदार को अलर्ट (Contractor Alert)</span>
                  </span>
                  <span className="text-emerald-400 font-semibold">{activeIncident.notifyContractor ? 'भेजा गया' : 'बंद रखा गया'}</span>
                </div>

                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>साथी कारीगरों को अलर्ट (Coworkers)</span>
                  </span>
                  <span className="text-emerald-400 font-semibold">भेजा गया</span>
                </div>

                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>इमरजेंसी कॉन्टैक्ट को SMS</span>
                  </span>
                  <span className="text-emerald-400 font-semibold">भेजा गया</span>
                </div>

                <div className="flex items-center justify-between text-slate-200">
                  <span className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    <span>एडमिन मॉनिटरिंग रूम</span>
                  </span>
                  <span className="text-emerald-400 font-semibold">अलर्टेड</span>
                </div>
              </div>
            </div>

            {/* Acknowledged Responders Live Updates */}
            {acknowledgedBy.length > 0 && (
              <div className="p-4 rounded-2xl bg-emerald-950/60 border border-emerald-600/60 space-y-2 animate-fadeIn">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  <span>मदद आ रही है (Acknowledged):</span>
                </span>
                {acknowledgedBy.map((ack, idx) => (
                  <p key={idx} className="text-xs text-emerald-100 font-medium">
                    👉 <strong className="text-white">{ack.name}</strong> ({ack.role}) ने देख लिया है और मदद के लिए आगे बढ़ रहे हैं।
                  </p>
                ))}
              </div>
            )}

            {/* Live Location Sharing Pulse */}
            <div className="flex items-center justify-center gap-2 py-2 text-xs text-slate-400">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping" />
              <MapPin className="w-3.5 h-3.5 text-emerald-400" />
              <span>लाइव लोकेशन साझा हो रही है (अपडेट हर 15 सेकंड)</span>
            </div>

            {/* Offline Fallback Call Card */}
            <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
              <div className="text-xs text-slate-300 font-semibold text-center">
                यदि नेटवर्क कमजोर है तो तुरंत सीधे कॉल करें:
              </div>
              <div className="grid grid-cols-2 gap-2">
                <a
                  href="tel:112"
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-blue-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow hover:bg-blue-500"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>112 पुलिस (Police)</span>
                </a>
                <a
                  href="tel:108"
                  className="min-h-[48px] px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs flex items-center justify-center gap-2 shadow hover:bg-rose-500"
                >
                  <PhoneCall className="w-4 h-4" />
                  <span>108 एम्बुलेंस (Ambulance)</span>
                </a>
              </div>
              <p className="text-[10px] text-slate-500 text-center">
                * वर्कपल्स ऐप 112 या आपातकालीन सरकारी सेवाओं का विकल्प नहीं है।
              </p>
            </div>
          </div>

          {/* Bottom Actions: Safe Resolution Button */}
          <div className="max-w-md mx-auto w-full pt-4 pb-2">
            <button
              type="button"
              onClick={() => setShowResolveModal(true)}
              className="w-full min-h-[56px] py-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white font-black text-base shadow-lg shadow-emerald-950 flex items-center justify-center gap-2"
            >
              <ShieldCheck className="w-6 h-6" />
              <span>मैं ठीक हूँ (I am Safe - Resolve SOS)</span>
            </button>
          </div>

          {/* Confirm Resolve Modal */}
          {showResolveModal && (
            <div className="fixed inset-0 z-60 bg-black/80 backdrop-blur flex items-center justify-center p-4">
              <div className="bg-slate-900 border border-slate-700 rounded-2xl p-5 max-w-sm w-full space-y-4 text-center">
                <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto" />
                <h3 className="font-bold text-base text-white">क्या आप पूरी तरह सुरक्षित हैं?</h3>
                <p className="text-xs text-slate-300">
                  इस पर टैप करने से ठेकेदार और साथियों को सूचना मिल जाएगी कि आप ठीक हैं और अलर्ट समाप्त हो जाएगा।
                </p>
                <div className="grid grid-cols-2 gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowResolveModal(false)}
                    className="py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700"
                  >
                    नहीं, अभी नहीं
                  </button>
                  <button
                    type="button"
                    disabled={resolving}
                    onClick={handleResolveSelfSafe}
                    className="py-3 rounded-xl bg-emerald-600 text-white font-black text-xs shadow flex items-center justify-center gap-1.5"
                  >
                    {resolving && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                    <span>हाँ, मैं ठीक हूँ</span>
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </>
  );
}

export default SosButton;
