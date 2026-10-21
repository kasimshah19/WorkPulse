'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import {
  ArrowLeft,
  ShieldAlert,
  AlertTriangle,
  Clock,
  MapPin,
  CheckCircle2,
  Phone,
  HardHat,
  RefreshCw,
  Send,
  Camera,
  Flame,
  UserCheck,
  ShieldCheck,
  HelpCircle,
  FileText,
} from 'lucide-react';
import api from '../../../../lib/api';
import { Navbar } from '../../../../components/layout/Navbar';
import { useAuthStore } from '../../../../store/authStore';
import { getSocket } from '../../../../lib/socket';
import 'leaflet/dist/leaflet.css';

// Dynamic Leaflet map
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
const Polyline = dynamic(
  () => import('react-leaflet').then((m) => m.Polyline),
  { ssr: false }
);

export default function AdminIncidentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const incidentId = params.id;
  const { token } = useAuthStore();

  const [incident, setIncident] = useState(null);
  const [reporterContext, setReporterContext] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Note form state
  const [noteText, setNoteText] = useState('');
  const [noteLoading, setNoteLoading] = useState(false);

  // Resolve modal state
  const [showResolveModal, setShowResolveModal] = useState(false);
  const [resolutionType, setResolutionType] = useState('HELP_PROVIDED');
  const [resolveNotes, setResolveNotes] = useState('');

  // Leaflet custom icon
  const [customIcon, setCustomIcon] = useState(null);
  useEffect(() => {
    import('leaflet').then((L) => {
      const pin = L.divIcon({
        className: 'custom-sos-pin',
        html: `<div style="background-color:#e11d48;color:white;padding:6px;border-radius:50%;border:2px solid white;box-shadow:0 0 12px rgba(225,29,72,0.8);"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg></div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      });
      setCustomIcon(pin);
    });
  }, []);

  const fetchIncidentDetails = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get(`/admin/incidents/${incidentId}`);
      if (res.data) {
        setIncident(res.data.incident || res.data);
        if (res.data.reporterContext) {
          setReporterContext(res.data.reporterContext);
        }
      }
    } catch (err) {
      setError(err.message || 'घटना का विवरण लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, [incidentId]);

  useEffect(() => {
    if (incidentId) fetchIncidentDetails();
  }, [incidentId, fetchIncidentDetails]);

  // Real-time socket updates for location, acks, escalation and resolve
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onLocation = (payload) => {
      if (payload.incidentId === incidentId) {
        fetchIncidentDetails();
      }
    };

    const onAck = (payload) => {
      if (payload.incidentId === incidentId) {
        fetchIncidentDetails();
      }
    };

    const onEscalated = (payload) => {
      if (payload.incidentId === incidentId) {
        fetchIncidentDetails();
      }
    };

    const onResolved = (payload) => {
      if (payload.incidentId === incidentId) {
        fetchIncidentDetails();
      }
    };

    socket.on('sos:location', onLocation);
    socket.on('sos:acknowledged', onAck);
    socket.on('sos:escalated', onEscalated);
    socket.on('sos:resolved', onResolved);

    return () => {
      socket.off('sos:location', onLocation);
      socket.off('sos:acknowledged', onAck);
      socket.off('sos:escalated', onEscalated);
      socket.off('sos:resolved', onResolved);
    };
  }, [token, incidentId, fetchIncidentDetails]);

  const handleAcknowledge = async () => {
    setActionLoading(true);
    try {
      await api.post(`/incidents/${incidentId}/acknowledge`);
      fetchIncidentDetails();
    } catch (err) {
      alert('Acknowledge failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddNote = async (e) => {
    e.preventDefault();
    if (!noteText.trim()) return;
    setNoteLoading(true);
    try {
      await api.post(`/admin/incidents/${incidentId}/note`, { text: noteText.trim() });
      setNoteText('');
      fetchIncidentDetails();
    } catch (err) {
      alert('Note failed: ' + err.message);
    } finally {
      setNoteLoading(false);
    }
  };

  const handleResolve = async () => {
    setActionLoading(true);
    try {
      await api.post(`/admin/incidents/${incidentId}/resolve`, {
        resolutionType,
        notes: resolveNotes.trim() || undefined,
      });
      setShowResolveModal(false);
      fetchIncidentDetails();
    } catch (err) {
      alert('Resolve failed: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading && !incident) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <div className="max-w-2xl mx-auto p-12 text-center text-slate-500 text-sm">
          घटना लोड हो रही है...
        </div>
      </div>
    );
  }

  if (error || !incident) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100">
        <Navbar />
        <div className="max-w-md mx-auto p-8 text-center space-y-4">
          <div className="text-rose-400 text-sm">{error || 'घटना नहीं मिली।'}</div>
          <Link href="/admin/incidents" className="text-xs text-blue-400 underline">
            कतार (Queue) पर लौटें
          </Link>
        </div>
      </div>
    );
  }

  const isSos = incident.type === 'SOS';
  const isCritical = incident.severity === 'CRITICAL' || isSos;
  const isResolved = incident.status === 'RESOLVED';
  const isAck = incident.status === 'ACKNOWLEDGED';

  // Map Coordinates
  const lat = incident.location?.coordinates?.[1] || 18.5204;
  const lng = incident.location?.coordinates?.[0] || 73.8567;
  const trailPositions = (incident.locationTrail || [])
    .filter((pt) => pt.coordinates && pt.coordinates.length === 2)
    .map((pt) => [pt.coordinates[1], pt.coordinates[0]]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="max-w-4xl mx-auto p-4 space-y-5 pb-24">
        {/* Back navigation */}
        <Link
          href="/admin/incidents"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> कतार (Queue) पर वापस जाएं
        </Link>

        {/* Header Summary Card */}
        <div
          className={`p-5 rounded-2xl border space-y-4 shadow-xl ${
            isCritical && !isResolved
              ? 'bg-rose-950/30 border-rose-500/50'
              : 'bg-slate-900 border-slate-800'
          }`}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span
                  className={`text-xs font-black px-2.5 py-1 rounded-md uppercase ${
                    isSos
                      ? 'bg-rose-600 text-white animate-pulse'
                      : 'bg-blue-600 text-white'
                  }`}
                >
                  {incident.type}
                </span>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                    incident.severity === 'CRITICAL'
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                      : 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {incident.severity}
                </span>

                <span
                  className={`text-xs font-bold px-2.5 py-1 rounded-md border ${
                    isResolved
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                      : isAck
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                      : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                  }`}
                >
                  स्थिति: {incident.status}
                </span>

                {incident.escalationLevel > 0 && (
                  <span className="text-xs font-black bg-rose-700 text-white px-2.5 py-1 rounded-md flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5" />
                    ESCALATED LEVEL {incident.escalationLevel}
                  </span>
                )}
              </div>

              <h1 className="text-xl font-black text-white mt-2">
                {incident.description || (isSos ? '🚨 आपातकालीन SOS - तत्काल सहायता' : 'सुरक्षा घटना रिपोर्ट')}
              </h1>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              {!isResolved && !isAck && (
                <button
                  onClick={handleAcknowledge}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-bold shadow-md flex items-center gap-1.5"
                >
                  <UserCheck className="w-4 h-4" />
                  देख लिया (Acknowledge)
                </button>
              )}

              {!isResolved && (
                <button
                  onClick={() => setShowResolveModal(true)}
                  disabled={actionLoading}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow-md flex items-center gap-1.5"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  हल करें (Resolve)
                </button>
              )}
            </div>
          </div>

          {/* Reporter & Job Context Bar */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 text-xs">
            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">रिपोर्टर विवरण (Reporter)</span>
              <div className="font-bold text-white text-sm">{incident.reportedBy?.name || 'Worker'}</div>
              <div className="text-slate-400 font-mono flex items-center gap-2">
                <span>{incident.reportedBy?.phone}</span>
                {incident.reportedBy?.phone && (
                  <a href={`tel:${incident.reportedBy.phone}`} className="text-blue-400 hover:underline">
                    कॉल करें
                  </a>
                )}
              </div>
              {/* Context stats without automatic penalties */}
              {reporterContext && (
                <div className="text-[11px] text-amber-300/90 pt-1 border-t border-slate-800 flex items-center gap-2">
                  <span>पूर्व SOS: <strong>{reporterContext.previousSosCount || 0}</strong></span>
                  <span>•</span>
                  <span>False Alarms: <strong>{reporterContext.falseAlarmCount || 0}</strong></span>
                </div>
              )}
            </div>

            <div className="p-3 bg-slate-950/70 border border-slate-800 rounded-xl space-y-1">
              <span className="text-[10px] uppercase font-bold text-slate-400 block">संबंधित काम (Job & Site)</span>
              <div className="font-bold text-white text-sm">{incident.job?.title || 'कोई काम लिंक्ड नहीं'}</div>
              <div className="text-slate-400 truncate">{incident.job?.addressText || 'N/A'}</div>
              <div className="text-[11px] text-slate-400 font-mono pt-1">
                रिपोर्ट समय: {new Date(incident.createdAt).toLocaleString('hi-IN')}
              </div>
            </div>
          </div>
        </div>

        {/* Live Location Trail Map */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MapPin className="w-4 h-4 text-rose-500" />
              <h2 className="text-sm font-black text-white">
                लाइव लोकेशन व ट्रेल (Live Position & Trail)
              </h2>
            </div>
            {incident.locationFlag && (
              <span
                className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                  incident.locationFlag === 'OK'
                    ? 'bg-emerald-500/20 text-emerald-400'
                    : 'bg-amber-500/20 text-amber-400'
                }`}
              >
                लोकेशन स्थिति: {incident.locationFlag}
              </span>
            )}
          </div>

          <div className="h-64 rounded-xl overflow-hidden border border-slate-800 relative z-0">
            <MapContainer
              center={[lat, lng]}
              zoom={15}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={false}
            >
              <TileLayer
                attribution="&copy; OpenStreetMap contributors"
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              />
              {customIcon && (
                <Marker position={[lat, lng]} icon={customIcon} />
              )}
              {incident.locationTrail?.slice(-1)[0]?.accuracy && (
                <Circle
                  center={[lat, lng]}
                  radius={incident.locationTrail.slice(-1)[0].accuracy}
                  pathOptions={{ color: '#e11d48', fillColor: '#e11d48', fillOpacity: 0.15 }}
                />
              )}
              {trailPositions.length > 1 && (
                <Polyline positions={trailPositions} pathOptions={{ color: '#e11d48', dashArray: '5, 8' }} />
              )}
            </MapContainer>
          </div>

          <div className="flex items-center justify-between text-xs text-slate-400 font-mono">
            <span>Lat: {lat.toFixed(5)}, Lng: {lng.toFixed(5)}</span>
            <a
              href={`https://maps.google.com/?q=${lat},${lng}`}
              target="_blank"
              rel="noreferrer"
              className="text-blue-400 hover:underline font-bold"
            >
              Google Maps पर दिशा निर्देश &rarr;
            </a>
          </div>
        </div>

        {/* Responders Alerted List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <UserCheck className="w-4 h-4 text-blue-400" />
            अलर्ट किए गए उत्तरदाता (Alerted Responders)
          </h2>

          <div className="space-y-2">
            {(incident.alertedUsers || []).map((u, idx) => (
              <div
                key={idx}
                className="p-3 bg-slate-950 border border-slate-800 rounded-xl flex items-center justify-between gap-3 text-xs"
              >
                <div>
                  <div className="font-bold text-white flex items-center gap-2">
                    <span>{u.user?.name || (u.phone ? `इमरजेंसी नंबर (${u.phone})` : 'उत्तरदाता')}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400">
                      {u.channel}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono mt-0.5">
                    अलर्ट भेजा: {new Date(u.sentAt).toLocaleTimeString('hi-IN')}
                  </div>
                </div>

                <div className="text-right">
                  {u.ackAt ? (
                    <span className="text-xs font-bold text-emerald-400 flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      देख लिया ({new Date(u.ackAt).toLocaleTimeString('hi-IN')})
                    </span>
                  ) : (
                    <span className="text-xs text-amber-400 font-medium">
                      लंबित (Pending Ack)
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Immutable Timeline */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <Clock className="w-4 h-4 text-emerald-400" />
            अपरिवर्तनीय घटना टाइमलाइन (Immutable Incident Timeline)
          </h2>

          <div className="space-y-2.5 border-l-2 border-slate-800 ml-2 pl-4">
            {(incident.timeline || []).map((t, idx) => (
              <div key={idx} className="relative">
                <span className="absolute -left-[21px] top-1.5 w-2.5 h-2.5 rounded-full bg-blue-500 border-2 border-slate-900" />
                <div className="text-xs font-bold text-white">{t.event}</div>
                <div className="text-[11px] text-slate-400 font-mono">
                  {new Date(t.at).toLocaleString('hi-IN')} {t.by && `• द्वारा: ${t.by}`}
                </div>
                {t.data && Object.keys(t.data).length > 0 && (
                  <pre className="text-[10px] text-slate-400 bg-slate-950 p-2 rounded-lg mt-1 font-mono overflow-x-auto">
                    {JSON.stringify(t.data, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Admin Notes Form & List */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 space-y-3">
          <h2 className="text-sm font-black text-white flex items-center gap-2">
            <FileText className="w-4 h-4 text-purple-400" />
            एडमिन नोट्स (Internal Admin Notes)
          </h2>

          <form onSubmit={handleAddNote} className="flex gap-2">
            <input
              type="text"
              placeholder="इस घटना पर नोट जोड़ें..."
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              className="flex-1 bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
            />
            <button
              type="submit"
              disabled={noteLoading || !noteText.trim()}
              className="px-4 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              {noteLoading ? '...' : 'सेव करें'}
            </button>
          </form>
        </div>
      </main>

      {/* Resolve Incident Modal */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5 max-w-md w-full space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-black text-white">घटना हल करें (Resolve Incident)</h3>
              <button
                onClick={() => setShowResolveModal(false)}
                className="text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  समाधान का प्रकार (Resolution Type):
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { type: 'HELP_PROVIDED', label: 'मदद दी गई' },
                    { type: 'FALSE_ALARM', label: 'गलत अलार्म' },
                    { type: 'OTHER', label: 'अन्य' },
                  ].map((item) => (
                    <button
                      key={item.type}
                      type="button"
                      onClick={() => setResolutionType(item.type)}
                      className={`p-2.5 rounded-xl text-xs font-bold border transition-all ${
                        resolutionType === item.type
                          ? 'bg-blue-600 border-blue-500 text-white shadow'
                          : 'bg-slate-950 border-slate-800 text-slate-400 hover:text-white'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-300 block mb-1.5">
                  समाधान नोट्स (Resolution Notes):
                </label>
                <textarea
                  rows={3}
                  placeholder="क्या कार्रवाई की गई? विवरण लिखें..."
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowResolveModal(false)}
                  className="flex-1 py-2.5 bg-slate-800 text-slate-300 rounded-xl text-xs font-bold"
                >
                  रद्द करें
                </button>
                <button
                  type="button"
                  onClick={handleResolve}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black shadow"
                >
                  {actionLoading ? 'हल हो रहा है...' : 'कन्फर्म हल करें'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
