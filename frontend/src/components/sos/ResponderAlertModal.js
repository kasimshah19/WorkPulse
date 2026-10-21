'use client';

import React, { useState, useEffect } from 'react';
import {
  Siren,
  PhoneCall,
  Navigation,
  CheckCircle2,
  ShieldAlert,
  X,
  Clock,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useAuthStore } from '../../store/authStore';
import { getSocket } from '../../lib/socket';
import api from '../../lib/api';

export function ResponderAlertModal() {
  const { user, token } = useAuthStore();
  const [alerts, setAlerts] = useState([]);
  const [activeAlertIndex, setActiveAlertIndex] = useState(0);
  const [acknowledging, setAcknowledging] = useState(false);
  const [resolving, setResolving] = useState(false);

  useEffect(() => {
    if (!token || !user) return;
    const socket = getSocket(token);

    const onSosAlert = (data) => {
      // Vibrate pattern: 500ms on, 200ms off, 500ms on
      if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
        try {
          window.navigator.vibrate([500, 200, 500, 200, 500]);
        } catch (_e) {}
      }

      // Audio beep (Note: browser may block autoplay until user has interacted with document)
      try {
        const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + 0.4);
      } catch (_e) {}

      setAlerts((prev) => {
        // If already exists, update with latest details / escalation ribbon
        const idx = prev.findIndex((a) => a.incidentId === data.incidentId);
        if (idx !== -1) {
          const updated = [...prev];
          updated[idx] = { ...updated[idx], ...data, isEscalation: true };
          return updated;
        }
        return [data, ...prev];
      });
    };

    const onSosResolved = (data) => {
      setAlerts((prev) => prev.filter((a) => a.incidentId !== data.incidentId));
    };

    const onSosLocation = (data) => {
      setAlerts((prev) =>
        prev.map((a) => {
          if (a.incidentId === data.incidentId) {
            return {
              ...a,
              location: { lat: data.lat, lng: data.lng },
              accuracy: data.accuracy,
            };
          }
          return a;
        })
      );
    };

    socket.on('sos:alert', onSosAlert);
    socket.on('sos:resolved', onSosResolved);
    socket.on('sos:location', onSosLocation);

    return () => {
      socket.off('sos:alert', onSosAlert);
      socket.off('sos:resolved', onSosResolved);
      socket.off('sos:location', onSosLocation);
    };
  }, [token, user]);

  if (alerts.length === 0) return null;

  const current = alerts[activeAlertIndex] || alerts[0];
  const mapsUrl =
    current.location?.lat && current.location?.lng
      ? `https://maps.google.com/?q=${current.location.lat},${current.location.lng}`
      : null;

  const handleAcknowledge = async () => {
    setAcknowledging(true);
    try {
      await api.post(`/incidents/${current.incidentId}/acknowledge`);
      setAlerts((prev) =>
        prev.map((a, idx) => (idx === activeAlertIndex ? { ...a, isAcknowledged: true } : a))
      );
    } catch (err) {
      alert(err.message || 'Error acknowledging alert');
    } finally {
      setAcknowledging(false);
    }
  };

  const handleResolve = async (type = 'HELP_PROVIDED') => {
    setResolving(true);
    try {
      await api.post(`/incidents/${current.incidentId}/resolve`, {
        resolutionType: type,
        notes: `Resolved by ${user.role}`,
      });
      setAlerts((prev) => prev.filter((a) => a.incidentId !== current.incidentId));
    } catch (err) {
      alert(err.message || 'Error resolving alert');
    } finally {
      setResolving(false);
    }
  };

  const canResolve = ['contractor', 'admin'].includes(user?.role);

  return (
    <div className="fixed inset-0 z-50 bg-rose-950/95 backdrop-blur-md flex flex-col justify-between p-4 overflow-y-auto animate-fadeIn text-white">
      <div className="max-w-md mx-auto w-full space-y-4 pt-2">
        {/* Stacked indicator if multiple alerts */}
        {alerts.length > 1 && (
          <div className="flex items-center justify-between bg-rose-900/80 px-3 py-1.5 rounded-xl border border-rose-700 text-xs font-bold">
            <span>{alerts.length} सक्रिय आपातकालीन अलर्ट (Active SOS Alerts)</span>
            <div className="flex gap-1">
              {alerts.map((_, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setActiveAlertIndex(i)}
                  className={`w-6 h-6 rounded-full text-xs font-bold ${
                    activeAlertIndex === i ? 'bg-white text-rose-900' : 'bg-rose-800 text-rose-300'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Escalation Ribbon */}
        {current.isEscalation && (
          <div className="bg-amber-500 text-slate-950 px-3 py-1.5 rounded-xl text-center font-black text-xs uppercase tracking-wider shadow-lg animate-bounce">
            ⚠️ ESCALATED: 60+ सेकंड में किसी ने रिस्पॉन्ड नहीं किया!
          </div>
        )}

        {/* Main Header */}
        <div className="p-4 rounded-2xl bg-rose-900/90 border-2 border-rose-500 text-center space-y-2">
          <div className="w-16 h-16 rounded-full bg-white text-rose-600 mx-auto flex items-center justify-center shadow-lg animate-pulse">
            <Siren className="w-9 h-9" />
          </div>
          <h2 className="text-xl font-black tracking-tight text-white">
            आपातकालीन SOS अलर्ट (Emergency SOS)
          </h2>
          <p className="text-xs text-rose-200">
            साइट पर किसी साथी को तुरंत आपकी मदद की ज़रूरत है।
          </p>
        </div>

        {/* Reporter Info Card */}
        <div className="p-4 rounded-2xl bg-slate-900 border border-slate-800 space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div>
              <span className="text-[11px] text-slate-400 block font-medium">अलर्ट भेजने वाला (Reporter):</span>
              <span className="text-base font-bold text-white">
                {current.reporter?.name || current.reporter?.firstName || 'वर्कर'}
              </span>
            </div>

            {current.reporter?.phone && (
              <a
                href={`tel:${current.reporter.phone}`}
                className="min-h-[44px] px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center gap-1.5 shadow"
              >
                <PhoneCall className="w-4 h-4" />
                <span>कॉल करें (Call)</span>
              </a>
            )}
          </div>

          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">काम (Job):</span>
              <span className="font-semibold text-slate-200">{current.jobTitle || 'सक्रिय साइट'}</span>
            </div>

            <div className="flex items-center justify-between text-slate-300">
              <span className="text-slate-400">अलर्ट समय:</span>
              <span className="font-semibold text-slate-200">
                {current.createdAt ? new Date(current.createdAt).toLocaleTimeString('en-IN') : 'अभी'}
              </span>
            </div>

            {current.location && (
              <div className="pt-2">
                <span className="text-slate-400 block text-[11px] mb-1">स्थान (GPS Location):</span>
                <div className="p-2 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-between">
                  <span className="font-mono text-slate-300 text-xs">
                    {current.location.lat?.toFixed(5)}, {current.location.lng?.toFixed(5)}
                  </span>
                  {mapsUrl && (
                    <a
                      href={mapsUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-2.5 py-1 rounded-lg bg-blue-600 text-white text-xs font-bold flex items-center gap-1 hover:bg-blue-500"
                    >
                      <Navigation className="w-3.5 h-3.5" />
                      <span>दिशाएँ (Directions)</span>
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="max-w-md mx-auto w-full pt-4 space-y-2">
        <button
          type="button"
          disabled={acknowledging || current.isAcknowledged}
          onClick={handleAcknowledge}
          className={`w-full min-h-[56px] py-4 rounded-2xl font-black text-sm flex items-center justify-center gap-2 shadow-lg transition-all ${
            current.isAcknowledged
              ? 'bg-slate-800 text-slate-400 border border-slate-700 cursor-default'
              : 'bg-white text-rose-950 hover:bg-slate-100 active:scale-95'
          }`}
        >
          {acknowledging ? (
            <RefreshCw className="w-5 h-5 animate-spin text-rose-600" />
          ) : (
            <CheckCircle2 className="w-5 h-5 text-emerald-600" />
          )}
          <span>
            {current.isAcknowledged ? 'आपने स्वीकार कर लिया (Acknowledged)' : 'मैंने देख लिया, मदद कर रहा हूँ (Acknowledge)'}
          </span>
        </button>

        {canResolve && (
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolve('HELP_PROVIDED')}
              className="py-3 rounded-xl bg-emerald-600 text-white font-bold text-xs flex items-center justify-center gap-1 shadow"
            >
              <span>मदद पूरी हुई (Resolved)</span>
            </button>
            <button
              type="button"
              disabled={resolving}
              onClick={() => handleResolve('FALSE_ALARM')}
              className="py-3 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700"
            >
              <span>गलती से दबा (False Alarm)</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

export default ResponderAlertModal;
