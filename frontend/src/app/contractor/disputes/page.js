'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import api from '../../../lib/api';
import { formatRupees } from '../../../lib/utils';
import {
  AlertTriangle,
  Scale,
  Clock,
  CheckCircle2,
  FileText,
  PlusCircle,
  RefreshCw,
  ChevronRight,
  ChevronDown,
  User,
  Calendar,
  Send,
  ArrowLeft,
} from 'lucide-react';

const STATUS_CONFIG = {
  OPEN: { label: 'खुला (Open)', color: 'bg-amber-500/20 text-amber-300 border-amber-500/30' },
  UNDER_REVIEW: { label: 'जांच जारी (In Review)', color: 'bg-blue-500/20 text-blue-300 border-blue-500/30' },
  RESOLVED_FOR_WORKER: { label: 'कारीगर के पक्ष में (Worker Won)', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' },
  RESOLVED_FOR_CONTRACTOR: { label: 'ठेकेदार के पक्ष में (Refunded)', color: 'bg-purple-500/20 text-purple-300 border-purple-500/30' },
  SPLIT: { label: 'बंटवारा (Split Settlement)', color: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/30' },
  CLOSED: { label: 'बंद (Closed)', color: 'bg-slate-800 text-slate-400 border-slate-700' },
};

export default function ContractorDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('ALL');
  const [expandedId, setExpandedId] = useState(null);
  const [noteInputs, setNoteInputs] = useState({});
  const [submittingNote, setSubmittingNote] = useState(null);
  const [error, setError] = useState('');

  const fetchDisputes = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/disputes/my');
      setDisputes(res.data || []);
    } catch (err) {
      setError(err.message || 'विवाद लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDisputes();
  }, [fetchDisputes]);

  const handleAddNote = async (disputeId) => {
    const note = (noteInputs[disputeId] || '').trim();
    if (!note) return;

    setSubmittingNote(disputeId);
    try {
      await api.post(`/disputes/${disputeId}/evidence`, {
        type: 'note',
        refId: note,
      });
      setNoteInputs((prev) => ({ ...prev, [disputeId]: '' }));
      await fetchDisputes();
    } catch (err) {
      alert('नोट जोड़ने में त्रुटि: ' + err.message);
    } finally {
      setSubmittingNote(null);
    }
  };

  const filteredDisputes = disputes.filter((d) => {
    if (filter === 'ALL') return true;
    if (filter === 'OPEN') return d.status === 'OPEN' || d.status === 'UNDER_REVIEW';
    if (filter === 'RESOLVED') return d.status.startsWith('RESOLVED') || d.status === 'SPLIT';
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-24 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Link
              href="/contractor/dashboard"
              className="p-1 text-slate-400 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-xl font-black text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-amber-400" />
                हाज़िरी व भुगतान विवाद (Disputes)
              </h1>
              <p className="text-xs text-slate-400">
                मध्यस्थता और प्रमाण समीक्षा (Arbitration & Evidence)
              </p>
            </div>
          </div>

          <button
            onClick={fetchDisputes}
            className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* Filter Tabs */}
        <div className="flex bg-slate-900 border border-slate-800 rounded-xl p-1 gap-1">
          {['ALL', 'OPEN', 'RESOLVED'].map((tab) => (
            <button
              key={tab}
              onClick={() => setFilter(tab)}
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${
                filter === tab
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              {tab === 'ALL'
                ? `सभी (${disputes.length})`
                : tab === 'OPEN'
                ? 'चालू (Active)'
                : 'हल हुए (Resolved)'}
            </button>
          ))}
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
            {error}
          </div>
        )}

        {/* Disputes List */}
        {loading ? (
          <div className="text-center py-12 text-slate-400 text-xs">
            विवाद लोड हो रहे हैं...
          </div>
        ) : filteredDisputes.length === 0 ? (
          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-bold text-white">कोई विवाद नहीं है (No Disputes)</h3>
            <p className="text-xs text-slate-400">
              आपके सभी कार्य और हाज़िरी रिकॉर्ड शांतिपूर्वक संरेखित हैं।
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredDisputes.map((dispute) => {
              const isExpanded = expandedId === dispute._id;
              const statusCfg = STATUS_CONFIG[dispute.status] || {
                label: dispute.status,
                color: 'bg-slate-800 text-slate-400',
              };
              const amountPaise = dispute.escrowTransaction?.amountPaise || 0;
              const workerUser =
                dispute.against?.role === 'worker' ? dispute.against : dispute.raisedBy;

              return (
                <div
                  key={dispute._id}
                  className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden transition-all"
                >
                  {/* Card Header (Click to expand) */}
                  <div
                    onClick={() => setExpandedId(isExpanded ? null : dispute._id)}
                    className="p-4 cursor-pointer hover:bg-slate-800/50 transition-colors space-y-2"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block truncate">
                          {dispute.job?.title || 'Job Milestone'}
                        </span>
                        <h3 className="text-sm font-black text-white truncate">
                          {dispute.description || dispute.reason}
                        </h3>
                      </div>

                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border shrink-0 ${statusCfg.color}`}
                      >
                        {statusCfg.label}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-800/60 font-mono">
                      <div className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-blue-400" />
                        <span>{workerUser?.name || 'Worker'}</span>
                      </div>
                      <div className="flex items-center gap-1 font-bold text-amber-300">
                        <span>{formatRupees(amountPaise)}</span>
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 ml-1" />
                        ) : (
                          <ChevronRight className="w-4 h-4 ml-1" />
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Detail View */}
                  {isExpanded && (
                    <div className="p-4 bg-slate-950/60 border-t border-slate-800 space-y-4 text-xs">
                      {/* Reason & Meta */}
                      <div className="bg-slate-900 p-3 rounded-xl space-y-1.5">
                        <div className="text-[11px] text-slate-400">
                          <span className="text-slate-500 font-bold">कारण (Reason):</span>{' '}
                          <span className="text-white font-semibold">{dispute.reason}</span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="text-slate-500 font-bold">दिनांक (Date):</span>{' '}
                          <span className="text-white font-mono">
                            {dispute.escrowTransaction?.dayDate ||
                              new Date(dispute.createdAt).toLocaleDateString('hi-IN')}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-400">
                          <span className="text-slate-500 font-bold">दर्जकर्ता (Raised by):</span>{' '}
                          <span className="text-white font-semibold">
                            {dispute.raisedBy?.name} ({dispute.raisedBy?.role})
                          </span>
                        </div>
                      </div>

                      {/* Resolution details if resolved */}
                      {dispute.resolution?.decidedAt && (
                        <div className="bg-emerald-950/30 border border-emerald-800/40 p-3 rounded-xl space-y-1">
                          <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block">
                            निर्णय विवरण (Admin Arbitration Decision)
                          </span>
                          <div className="text-xs text-emerald-200">
                            कारीगर राशि:{' '}
                            <span className="font-bold font-mono">
                              {formatRupees(dispute.resolution.workerAmountPaise || 0)}
                            </span>{' '}
                            | ठेकेदार रिफंड:{' '}
                            <span className="font-bold font-mono">
                              {formatRupees(dispute.resolution.contractorRefundPaise || 0)}
                            </span>
                          </div>
                          {dispute.resolution.notes && (
                            <p className="text-[11px] text-emerald-300 italic">
                              &ldquo;{dispute.resolution.notes}&rdquo;
                            </p>
                          )}
                        </div>
                      )}

                      {/* Evidence Timeline */}
                      <div className="space-y-2">
                        <span className="text-[11px] font-bold text-slate-300 block">
                          प्रमाण एवं इतिहास (Evidence Timeline):
                        </span>

                        {(!dispute.evidence || dispute.evidence.length === 0) ? (
                          <div className="p-3 bg-slate-900/80 rounded-xl text-slate-500 italic text-[11px]">
                            अभी तक कोई अतिरिक्त प्रमाण संलग्न नहीं है।
                          </div>
                        ) : (
                          <div className="space-y-1.5">
                            {dispute.evidence.map((ev, idx) => (
                              <div
                                key={idx}
                                className="p-2.5 bg-slate-900 border border-slate-800 rounded-xl flex items-start gap-2"
                              >
                                <FileText className="w-3.5 h-3.5 text-blue-400 mt-0.5 shrink-0" />
                                <div className="min-w-0">
                                  <span className="text-[10px] uppercase font-bold text-slate-400">
                                    {ev.type}
                                  </span>
                                  <p className="text-slate-200 break-words text-[11px]">
                                    {ev.refId || ev.url || 'साक्ष्य संलग्न'}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Add Note Form (Only if not closed) */}
                      {dispute.status === 'OPEN' || dispute.status === 'UNDER_REVIEW' ? (
                        <div className="pt-2 border-t border-slate-800 space-y-2">
                          <label className="text-[11px] font-bold text-slate-300 block">
                            अपना पक्ष या नोट जोड़ें (Add Clarification Note):
                          </label>
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={noteInputs[dispute._id] || ''}
                              onChange={(e) =>
                                setNoteInputs((prev) => ({
                                  ...prev,
                                  [dispute._id]: e.target.value,
                                }))
                              }
                              placeholder="विस्तार से विवरण लिखें..."
                              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                            />
                            <button
                              onClick={() => handleAddNote(dispute._id)}
                              disabled={
                                submittingNote === dispute._id ||
                                !(noteInputs[dispute._id] || '').trim()
                              }
                              className="px-3 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1 shrink-0"
                            >
                              <Send className="w-3.5 h-3.5" />
                              भेजें
                            </button>
                          </div>
                        </div>
                      ) : null}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </main>

      <BottomNav role="contractor" />
    </div>
  );
}
