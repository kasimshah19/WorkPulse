'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Navbar } from '../../../components/layout/Navbar';
import { Card } from '../../../components/ui/Card';
import { Button } from '../../../components/ui/Button';
import api from '../../../lib/api';
import { formatRupees } from '../../../lib/utils';
import {
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Clock,
  User,
  MapPin,
  Camera,
  Scale,
  RefreshCw,
  Sliders,
  FileText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

export default function AdminDisputesPage() {
  const [disputes, setDisputes] = useState([]);
  const [selectedDispute, setSelectedDispute] = useState(null);
  const [statusFilter, setStatusFilter] = useState('OPEN');
  const [isLoading, setIsLoading] = useState(true);

  // Resolution Form State
  const [resolutionType, setResolutionType] = useState('FOR_WORKER'); // FOR_WORKER | FOR_CONTRACTOR | SPLIT
  const [workerSplitPercent, setWorkerSplitPercent] = useState(50);
  const [adminNotes, setAdminNotes] = useState('');
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState('');
  const [resolveSuccess, setResolveSuccess] = useState('');

  const loadDisputes = useCallback(async () => {
    try {
      setIsLoading(true);
      const query = statusFilter === 'ALL' ? '' : `?status=${statusFilter}`;
      const res = await api.get(`/admin/disputes${query}`);
      if (res.data) {
        setDisputes(res.data);
        if (selectedDispute) {
          const updated = res.data.find((d) => d._id === selectedDispute._id);
          if (updated) setSelectedDispute(updated);
        }
      }
    } catch (err) {
      console.error('Failed to load disputes:', err);
    } finally {
      setIsLoading(false);
    }
  }, [statusFilter, selectedDispute]);

  useEffect(() => {
    loadDisputes();
  }, [statusFilter]);

  const handleResolve = async () => {
    if (!selectedDispute) return;
    setResolveError('');
    setResolveSuccess('');
    setIsResolving(true);

    try {
      const escrowAmount = selectedDispute.escrowTransaction?.amountPaise || 80000;
      let payload = {
        resolution: resolutionType,
        adminNotes: adminNotes || 'Arbitrated by admin',
      };

      if (resolutionType === 'SPLIT') {
        const workerPaise = Math.round((escrowAmount * workerSplitPercent) / 100);
        const contractorPaise = escrowAmount - workerPaise;
        payload.splitPaise = {
          worker: workerPaise,
          contractor: contractorPaise,
        };
      }

      await api.post(`/admin/disputes/${selectedDispute._id}/resolve`, payload);
      setResolveSuccess('विवाद का समाधान सफलतापूर्वक रिकॉर्ड किया गया (Dispute resolved)!');
      setTimeout(() => {
        setResolveSuccess('');
        setSelectedDispute(null);
        loadDisputes();
      }, 1500);
    } catch (err) {
      setResolveError(err.message || 'विवाद समाधान विफल रहा।');
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-16 text-slate-100">
      <Navbar />

      <main className="flex-1 max-w-4xl mx-auto w-full px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-500/20 text-red-400 flex items-center justify-center">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white">विवाद पंचाट (Dispute Arbitration)</h1>
              <p className="text-xs text-slate-400">एडमिन मध्यस्थता और भुगतान विभाजन</p>
            </div>
          </div>

          <button
            onClick={loadDisputes}
            disabled={isLoading}
            className="p-2 text-slate-400 hover:text-white rounded-lg bg-slate-900 border border-slate-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-red-400' : ''}`} />
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex gap-2 border-b border-slate-800 pb-2">
          {['OPEN', 'UNDER_REVIEW', 'RESOLVED', 'ALL'].map((status) => (
            <button
              key={status}
              type="button"
              onClick={() => setStatusFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                statusFilter === status
                  ? 'bg-red-600 text-white shadow-sm shadow-red-500/20'
                  : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              {status}
            </button>
          ))}
        </div>

        {/* Main Grid: Queue on left / Evidence & Resolve on right */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Dispute Queue List */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
              विवाद सूची ({disputes.length})
            </h2>

            {disputes.length === 0 ? (
              <Card className="text-center py-10 space-y-2 border-dashed border-slate-800">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p className="text-sm font-semibold text-slate-300">कोई लंबित विवाद नहीं है</p>
                <p className="text-xs text-slate-500">सभी एस्क्रो लेन-देन सामान्य रूप से चल रहे हैं।</p>
              </Card>
            ) : (
              <div className="space-y-2.5">
                {disputes.map((d) => {
                  const isSelected = selectedDispute?._id === d._id;
                  const escrowAmount = d.escrowTransaction?.amountPaise || 80000;

                  return (
                    <Card
                      key={d._id}
                      onClick={() => setSelectedDispute(d)}
                      className={`p-4 cursor-pointer transition-all border ${
                        isSelected
                          ? 'bg-red-950/20 border-red-500/60 shadow-md shadow-red-500/10'
                          : 'bg-slate-900/80 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-bold text-white">
                              {d.job?.title || 'Disputed Job'}
                            </span>
                            <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-red-500/20 text-red-400 border border-red-500/30">
                              {d.status}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 mt-1">
                            कारण: <span className="text-slate-200">{d.reason}</span>
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5">
                            ठेकेदार: {d.raisedBy?.name || 'Contractor'} • श्रमिक: {d.against?.name || 'Worker'}
                          </p>
                        </div>

                        <div className="text-right">
                          <p className="text-sm font-bold text-white font-mono">
                            {formatRupees(escrowAmount)}
                          </p>
                          <p className="text-[10px] text-slate-500 mt-0.5 font-mono">
                            {d.escrowTransaction?.dayDate || '2026-10-19'}
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>

          {/* Dispute Arbitration Workspace */}
          <div>
            {selectedDispute ? (
              <div className="space-y-4">
                <Card className="p-5 bg-slate-900 border-slate-800 space-y-4">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                    <div>
                      <h3 className="text-sm font-bold text-white">
                        केस विवरण #{selectedDispute._id.slice(-6)}
                      </h3>
                      <p className="text-xs text-slate-400">
                        {selectedDispute.job?.title} ({formatRupees(selectedDispute.escrowTransaction?.amountPaise || 80000)})
                      </p>
                    </div>
                    <span className="text-xs font-bold text-red-400 font-mono bg-red-950/60 px-2 py-1 rounded border border-red-900/60">
                      {selectedDispute.status}
                    </span>
                  </div>

                  {/* Auto-Collected Evidence Section */}
                  <div className="space-y-2">
                    <h4 className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
                      <Camera className="w-3.5 h-3.5 text-blue-400" />
                      एकत्रित साक्ष्य (Evidence Trail)
                    </h4>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400">ठेकेदार (Contractor)</span>
                        <p className="font-bold text-white">{selectedDispute.raisedBy?.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{selectedDispute.raisedBy?.phone}</p>
                      </div>

                      <div className="p-2.5 bg-slate-950 rounded-xl border border-slate-800 space-y-1">
                        <span className="text-[10px] text-slate-400">श्रमिक (Worker)</span>
                        <p className="font-bold text-white">{selectedDispute.against?.name}</p>
                        <p className="text-[10px] text-slate-400 font-mono">{selectedDispute.against?.phone}</p>
                      </div>
                    </div>

                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-1">
                      <span className="text-[10px] text-slate-400 font-bold uppercase">शिकायत विवरण:</span>
                      <p className="text-slate-200">{selectedDispute.description || selectedDispute.reason}</p>
                    </div>

                    {/* Evidence links */}
                    {selectedDispute.evidence && selectedDispute.evidence.length > 0 && (
                      <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                        <span className="text-[10px] text-slate-400 font-bold uppercase">सिस्टम लॉग और सेल्फ़ी:</span>
                        <div className="space-y-1.5">
                          {selectedDispute.evidence.map((ev, i) => (
                            <div key={i} className="flex items-center justify-between text-xs py-1 border-b border-slate-800/40 last:border-none">
                              <span className="text-slate-300 capitalize">{ev.type}</span>
                              <span className="text-blue-400 font-mono text-[11px] truncate max-w-[200px]">{ev.url}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Arbitration Actions (If OPEN) */}
                  {selectedDispute.status === 'OPEN' || selectedDispute.status === 'UNDER_REVIEW' ? (
                    <div className="space-y-4 pt-3 border-t border-slate-800">
                      <h4 className="text-xs font-bold text-white flex items-center gap-1.5">
                        <Scale className="w-3.5 h-3.5 text-amber-400" />
                        मध्यस्थता निर्णय (Arbitration Verdict)
                      </h4>

                      {/* Mode Choice */}
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <button
                          type="button"
                          onClick={() => setResolutionType('FOR_WORKER')}
                          className={`p-2 rounded-xl border font-bold text-center transition-all ${
                            resolutionType === 'FOR_WORKER'
                              ? 'bg-emerald-600 text-white border-emerald-500'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          100% श्रमिक
                        </button>

                        <button
                          type="button"
                          onClick={() => setResolutionType('FOR_CONTRACTOR')}
                          className={`p-2 rounded-xl border font-bold text-center transition-all ${
                            resolutionType === 'FOR_CONTRACTOR'
                              ? 'bg-blue-600 text-white border-blue-500'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          100% ठेकेदार
                        </button>

                        <button
                          type="button"
                          onClick={() => setResolutionType('SPLIT')}
                          className={`p-2 rounded-xl border font-bold text-center transition-all ${
                            resolutionType === 'SPLIT'
                              ? 'bg-amber-600 text-white border-amber-500'
                              : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700'
                          }`}
                        >
                          विभाजन (Split)
                        </button>
                      </div>

                      {/* Split Percentage Slider */}
                      {resolutionType === 'SPLIT' && (
                        <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 space-y-2">
                          <div className="flex justify-between items-center text-xs">
                            <span className="text-slate-300">
                              श्रमिक: <strong className="text-amber-400">{workerSplitPercent}%</strong>
                            </span>
                            <span className="text-slate-300">
                              ठेकेदार: <strong className="text-blue-400">{100 - workerSplitPercent}%</strong>
                            </span>
                          </div>

                          <input
                            type="range"
                            min="0"
                            max="100"
                            step="5"
                            value={workerSplitPercent}
                            onChange={(e) => setWorkerSplitPercent(Number(e.target.value))}
                            className="w-full accent-amber-500"
                          />

                          <div className="flex justify-between text-[11px] font-mono pt-1 text-slate-400">
                            <span>
                              श्रमिक हिस्सा:{' '}
                              {formatRupees(
                                Math.round(
                                  ((selectedDispute.escrowTransaction?.amountPaise || 80000) *
                                    workerSplitPercent) /
                                    100
                                )
                              )}
                            </span>
                            <span>
                              ठेकेदार रिफंड:{' '}
                              {formatRupees(
                                (selectedDispute.escrowTransaction?.amountPaise || 80000) -
                                  Math.round(
                                    ((selectedDispute.escrowTransaction?.amountPaise || 80000) *
                                      workerSplitPercent) /
                                      100
                                  )
                              )}
                            </span>
                          </div>
                        </div>
                      )}

                      {/* Admin Notes */}
                      <div>
                        <label className="text-xs text-slate-400 block mb-1">
                          एडमिन टिप्पणी (Decision Rationale / Notes)
                        </label>
                        <textarea
                          rows="2"
                          value={adminNotes}
                          onChange={(e) => setAdminNotes(e.target.value)}
                          placeholder="फैसले का आधार..."
                          className="w-full bg-slate-950 border border-slate-800 rounded-xl p-2.5 text-xs text-white focus:outline-none focus:border-amber-500"
                        />
                      </div>

                      {resolveError && (
                        <p className="text-xs text-red-400 bg-red-950/60 p-2 rounded-lg border border-red-800">
                          {resolveError}
                        </p>
                      )}

                      {resolveSuccess && (
                        <p className="text-xs text-emerald-400 bg-emerald-950/60 p-2 rounded-lg border border-emerald-800">
                          {resolveSuccess}
                        </p>
                      )}

                      <Button
                        variant="primary"
                        onClick={handleResolve}
                        disabled={isResolving}
                        className="w-full py-2.5 bg-red-600 hover:bg-red-500 text-white font-bold text-xs rounded-xl"
                      >
                        {isResolving ? 'समाधान लागू हो रहा है...' : 'फैसले को अंतिम रूप दें (Execute Resolution)'}
                      </Button>
                    </div>
                  ) : (
                    <div className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-xs text-slate-300">
                      <p className="font-bold text-emerald-400">यह विवाद पहले ही सुलझाया जा चुका है।</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        फैसला: {selectedDispute.status} • नोट्स: {selectedDispute.resolution?.notes || 'N/A'}
                      </p>
                    </div>
                  )}
                </Card>
              </div>
            ) : (
              <Card className="text-center py-16 border-dashed border-slate-800 space-y-2">
                <FileText className="w-8 h-8 text-slate-600 mx-auto" />
                <p className="text-sm font-semibold text-slate-400">विवाद चुनें</p>
                <p className="text-xs text-slate-500">
                  बाएं पैनल से किसी भी विवाद पर क्लिक करके साक्ष्य और फैसला दर्ज करें।
                </p>
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
