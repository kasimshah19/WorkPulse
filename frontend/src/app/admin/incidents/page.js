'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
  ShieldAlert,
  AlertTriangle,
  Clock,
  MapPin,
  RefreshCw,
  Search,
  Filter,
  CheckCircle2,
  Phone,
  ArrowRight,
  HardHat,
  Flame,
} from 'lucide-react';
import api from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { useAuthStore } from '../../../store/authStore';
import { getSocket } from '../../../lib/socket';

export default function AdminIncidentsPage() {
  const { token } = useAuthStore();
  const [incidents, setIncidents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [severityFilter, setSeverityFilter] = useState('ALL');

  const fetchIncidents = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (statusFilter !== 'ALL') params.set('status', statusFilter);
      if (typeFilter !== 'ALL') params.set('type', typeFilter);
      if (severityFilter !== 'ALL') params.set('severity', severityFilter);

      const res = await api.get(`/admin/incidents?${params.toString()}`);
      setIncidents(res.data || []);
    } catch (err) {
      setError(err.message || 'सुरक्षा घटनाएं लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter, severityFilter]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  // Real-time socket listener for new incidents and SOS alerts
  useEffect(() => {
    if (!token) return;
    const socket = getSocket(token);

    const onSosAlert = () => {
      fetchIncidents();
    };

    const onIncidentNew = () => {
      fetchIncidents();
    };

    socket.on('sos:alert', onSosAlert);
    socket.on('incident:new', onIncidentNew);
    socket.on('sos:acknowledged', onSosAlert);
    socket.on('sos:resolved', onSosAlert);

    return () => {
      socket.off('sos:alert', onSosAlert);
      socket.off('incident:new', onIncidentNew);
      socket.off('sos:acknowledged', onSosAlert);
      socket.off('sos:resolved', onSosAlert);
    };
  }, [token, fetchIncidents]);

  const openCount = incidents.filter((i) => i.status === 'OPEN').length;
  const criticalCount = incidents.filter((i) => i.severity === 'CRITICAL' || i.type === 'SOS').length;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />

      <main className="max-w-4xl mx-auto p-4 space-y-5 pb-24">
        {/* Header with Navigation */}
        <div className="flex items-center justify-between flex-wrap gap-3 border-b border-slate-800 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-6 h-6 text-rose-500" />
              <h1 className="text-xl font-black text-white">
                आपातकालीन व सुरक्षा कतार (Incident Queue)
              </h1>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              SOS अलर्ट, दुर्घटनाएं और कार्यस्थल शिकायतें (SOS & CRITICAL First)
            </p>
          </div>

          <div className="flex items-center gap-2 text-xs font-bold">
            <Link
              href="/admin/ratings"
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl"
            >
              रेटिंग नियंत्रण (Ratings)
            </Link>
            <Link
              href="/admin/safety"
              className="px-3 py-1.5 bg-blue-600/20 text-blue-400 border border-blue-500/30 rounded-xl"
            >
              सुरक्षा आंकड़े (Stats)
            </Link>
          </div>
        </div>

        {/* Live Status Counters */}
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3.5 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-rose-600 text-white flex items-center justify-center font-black">
              {criticalCount}
            </div>
            <div>
              <span className="text-[11px] text-rose-300 font-bold block">गंभीर / SOS अलर्ट</span>
              <span className="text-xs text-rose-400/80">तत्काल ध्यान दें</span>
            </div>
          </div>

          <div className="p-3.5 bg-amber-500/10 border border-amber-500/30 rounded-2xl flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-600 text-white flex items-center justify-center font-black">
              {openCount}
            </div>
            <div>
              <span className="text-[11px] text-amber-300 font-bold block">खुली घटनाएं (Open)</span>
              <span className="text-xs text-amber-400/80">Pending Action</span>
            </div>
          </div>

          <div className="p-3.5 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
            <div>
              <span className="text-[11px] text-slate-400 font-bold block">कुल रिकॉर्ड</span>
              <span className="text-lg font-black text-white">{incidents.length}</span>
            </div>
            <button
              onClick={fetchIncidents}
              className="p-2 bg-slate-800 hover:bg-slate-700 rounded-xl text-slate-300"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Filter Controls */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3.5 space-y-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
            <Filter className="w-3.5 h-3.5" /> फ़िल्टर (Filters):
          </div>

          <div className="flex flex-wrap gap-2 text-xs">
            {/* Status filters */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
              {['OPEN', 'ACKNOWLEDGED', 'RESOLVED', 'ALL'].map((st) => (
                <button
                  key={st}
                  onClick={() => setStatusFilter(st)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    statusFilter === st
                      ? 'bg-blue-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>

            {/* Type filters */}
            <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800 gap-1">
              {['ALL', 'SOS', 'INJURY', 'HARASSMENT', 'DISPUTE', 'OTHER'].map((tp) => (
                <button
                  key={tp}
                  onClick={() => setTypeFilter(tp)}
                  className={`px-2.5 py-1 rounded-lg font-bold transition-all ${
                    typeFilter === tp
                      ? 'bg-rose-600 text-white shadow'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {tp}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-bold">
            {error}
          </div>
        )}

        {/* Incident Cards Queue */}
        {loading && incidents.length === 0 ? (
          <div className="text-center py-12 text-slate-500 text-sm">
            सुरक्षा घटनाएं लोड हो रही हैं...
          </div>
        ) : incidents.length === 0 ? (
          <div className="p-12 text-center bg-slate-900 border border-slate-800 rounded-2xl space-y-2">
            <CheckCircle2 className="w-10 h-10 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-black text-white">कोई घटना लंबित नहीं है</h3>
            <p className="text-xs text-slate-400">सभी अलर्ट सुलझ चुके हैं या कोई रिकॉर्ड नहीं मिला।</p>
          </div>
        ) : (
          <div className="space-y-3">
            {incidents.map((inc) => {
              const isSos = inc.type === 'SOS';
              const isCritical = inc.severity === 'CRITICAL' || isSos;
              const isOpen = inc.status === 'OPEN';
              const isAck = inc.status === 'ACKNOWLEDGED';

              return (
                <Link
                  key={inc._id}
                  href={`/admin/incidents/${inc._id}`}
                  className={`block p-4 rounded-2xl border transition-all hover:scale-[1.01] ${
                    isCritical && isOpen
                      ? 'bg-rose-950/40 border-rose-500/60 shadow-lg shadow-rose-950/50'
                      : isAck
                      ? 'bg-amber-950/20 border-amber-500/40'
                      : 'bg-slate-900 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span
                          className={`text-[10px] font-black px-2 py-0.5 rounded-md uppercase tracking-wider ${
                            isSos
                              ? 'bg-rose-600 text-white animate-pulse'
                              : inc.type === 'INJURY'
                              ? 'bg-amber-600 text-white'
                              : inc.type === 'HARASSMENT'
                              ? 'bg-purple-600 text-white'
                              : 'bg-blue-600 text-white'
                          }`}
                        >
                          {inc.type}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${
                            inc.severity === 'CRITICAL'
                              ? 'bg-rose-500/20 text-rose-300 border-rose-500/40'
                              : inc.severity === 'HIGH'
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                              : 'bg-slate-800 text-slate-300 border-slate-700'
                          }`}
                        >
                          {inc.severity}
                        </span>

                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            isOpen
                              ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
                              : isAck
                              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                              : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                          }`}
                        >
                          {inc.status}
                        </span>

                        {inc.escalationLevel > 0 && (
                          <span className="text-[10px] font-black bg-rose-700 text-white px-2 py-0.5 rounded-md flex items-center gap-1">
                            <Flame className="w-3 h-3" />
                            ESCALATED L{inc.escalationLevel}
                          </span>
                        )}

                        {inc.visibility === 'ADMIN_ONLY' && (
                          <span className="text-[9px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 px-1.5 py-0.5 rounded">
                            गोपनीय (ADMIN ONLY)
                          </span>
                        )}
                      </div>

                      <h3 className="text-sm font-bold text-white truncate">
                        {inc.description || (isSos ? '🚨 आपातकालीन SOS - तुरंत मदद चाहिए!' : 'सुरक्षा घटना रिपोर्ट')}
                      </h3>

                      <div className="flex items-center gap-3 text-xs text-slate-400 font-mono flex-wrap">
                        <span>रिपोर्टर: <strong className="text-slate-200">{inc.reportedBy?.name || 'Worker'}</strong> ({inc.reportedBy?.phone})</span>
                        {inc.job && <span>• काम: {inc.job.title || inc.job}</span>}
                        {inc.locationFlag && inc.locationFlag !== 'OK' && (
                          <span className="text-amber-400 font-sans text-[11px]">
                            • लोकेशन स्थिति: {inc.locationFlag}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-2">
                      <span className="text-xs text-slate-400 block font-mono">
                        {new Date(inc.createdAt).toLocaleTimeString('hi-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>

                      <div className="inline-flex items-center gap-1 text-xs font-bold text-blue-400">
                        विवरण देखें <ArrowRight className="w-3.5 h-3.5" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
