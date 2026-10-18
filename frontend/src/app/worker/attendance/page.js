'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  CalendarCheck,
  Calendar,
  Clock,
  MapPin,
  ChevronRight,
  ArrowLeft,
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
} from 'lucide-react';
import api from '../../../lib/api';
import { Navbar } from '../../../components/layout/Navbar';
import { BottomNav } from '../../../components/layout/BottomNav';

export default function WorkerAttendancePage() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedItem, setSelectedItem] = useState(null);
  const [selfieBlobUrl, setSelfieBlobUrl] = useState(null);
  const [loadingSelfie, setLoadingSelfie] = useState(false);

  const fetchHistory = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await api.get('/attendance/history');
      setHistory(res.data || []);
    } catch (err) {
      setError(err.message || 'हाज़िरी इतिहास लोड करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  // When a modal item is selected, load selfie securely via authenticated endpoint
  useEffect(() => {
    if (!selectedItem || !selectedItem.selfieUrl) {
      setSelfieBlobUrl(null);
      return;
    }

    let isMounted = true;
    async function loadSecureSelfie() {
      try {
        setLoadingSelfie(true);
        const res = await api.get(`/attendance/${selectedItem._id}/selfie`, {
          responseType: 'blob',
        });
        if (isMounted) {
          const url = URL.createObjectURL(res.data || res);
          setSelfieBlobUrl(url);
        }
      } catch (err) {
        console.warn('Failed to load authenticated selfie:', err);
      } finally {
        if (isMounted) setLoadingSelfie(false);
      }
    }

    loadSecureSelfie();

    return () => {
      isMounted = false;
      if (selfieBlobUrl) {
        URL.revokeObjectURL(selfieBlobUrl);
      }
    };
  }, [selectedItem]);

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col pb-24 text-white">
      <Navbar />

      <main className="flex-1 max-w-md mx-auto w-full px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link
              href="/worker/dashboard"
              className="p-2 bg-slate-900 border border-slate-800 rounded-xl text-slate-300 hover:text-white"
            >
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div>
              <h1 className="text-lg font-black text-white">हाज़िरी का इतिहास (History)</h1>
              <p className="text-xs text-slate-400">Proof-of-Work Logs</p>
            </div>
          </div>

          <button
            onClick={fetchHistory}
            className="p-2 text-slate-400 hover:text-white rounded-xl bg-slate-900 border border-slate-800"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-2xl flex items-center gap-2 text-xs text-rose-300">
            <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Loading */}
        {loading && history.length === 0 && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 bg-slate-900/60 border border-slate-800 rounded-2xl animate-pulse"
              />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && history.length === 0 && !error && (
          <div className="p-8 text-center bg-slate-900/60 border border-slate-800 rounded-2xl space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mx-auto text-slate-500">
              <CalendarCheck className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">कोई हाज़िरी रिकॉर्ड नहीं मिला</h4>
              <p className="text-xs text-slate-400 mt-1">
                जब आप साइट पर चेक-इन करेंगे, तो यहाँ आपका दैनिक लॉग दिखाई देगा।
              </p>
            </div>
          </div>
        )}

        {/* History List */}
        <div className="space-y-3">
          {history.map((att) => {
            const inTime = att.checkInAt
              ? new Date(att.checkInAt).toLocaleTimeString('hi-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--:--';
            const outTime = att.checkOutAt
              ? new Date(att.checkOutAt).toLocaleTimeString('hi-IN', {
                  hour: '2-digit',
                  minute: '2-digit',
                })
              : '--:--';

            return (
              <div
                key={att._id}
                onClick={() => setSelectedItem(att)}
                className="p-4 bg-slate-900 border border-slate-800 hover:border-slate-700 rounded-2xl space-y-2 cursor-pointer shadow-md transition active:scale-98"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {att.job?.title || 'काम'}
                      </span>
                      {att.autoCheckout && (
                        <span className="text-[10px] font-black bg-amber-500/20 text-amber-300 border border-amber-500/40 px-1.5 py-0.2 rounded-md flex items-center gap-0.5">
                          <Zap className="w-2.5 h-2.5" />
                          Auto Check-out
                        </span>
                      )}
                    </div>
                    <span className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                      <Calendar className="w-3 h-3 text-slate-500" />
                      {att.date}
                    </span>
                  </div>

                  {/* Status chip */}
                  <span
                    className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                      att.status === 'CHECKED_OUT'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                        : att.status === 'CHECKED_IN'
                        ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                        : att.status === 'MISSED'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : 'bg-slate-800 text-slate-400'
                    }`}
                  >
                    {att.status === 'CHECKED_OUT'
                      ? '✓ पूरा हुआ'
                      : att.status === 'CHECKED_IN'
                      ? '● चालू'
                      : att.status === 'MISSED'
                      ? '✕ अनुपस्थित'
                      : att.status}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-slate-300 border-t border-slate-800/80 pt-2">
                  <div className="flex items-center gap-3">
                    <span>
                      In: <b>{inTime}</b>
                    </span>
                    <span>
                      Out: <b>{outTime}</b>
                    </span>
                    <span>
                      घंटे: <b className="text-emerald-400">{att.hoursWorked || 0} h</b>
                    </span>
                  </div>

                  <div className="flex items-center gap-1 text-[11px] text-slate-400">
                    <span>
                      {att.contractorSignoff?.status === 'APPROVED'
                        ? '✅ मंज़ूर'
                        : att.contractorSignoff?.status === 'DISPUTED'
                        ? '⚠️ विवादित'
                        : '⏳ साइन-ऑफ़'}
                    </span>
                    <ChevronRight className="w-4 h-4 text-slate-500" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* Detail Modal / Sheet */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-sm p-5 space-y-4 shadow-2xl animate-in slide-in-from-bottom">
            <div className="flex items-center justify-between pb-2 border-b border-slate-800">
              <div>
                <h3 className="text-base font-black text-white">हाज़िरी विवरण (Details)</h3>
                <p className="text-xs text-slate-400">{selectedItem.date}</p>
              </div>
              <button
                onClick={() => setSelectedItem(null)}
                className="p-1.5 bg-slate-800 rounded-full text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Selfie Preview if present */}
            {selectedItem.selfieUrl && (
              <div className="space-y-1.5 text-center">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  सेल्फ़ी प्रमाण (Selfie Proof)
                </span>
                <div className="w-36 h-36 mx-auto rounded-2xl overflow-hidden border-2 border-slate-700 bg-black flex items-center justify-center">
                  {loadingSelfie ? (
                    <RefreshCw className="w-5 h-5 animate-spin text-emerald-400" />
                  ) : selfieBlobUrl ? (
                    <img
                      src={selfieBlobUrl}
                      alt="Selfie Proof"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <span className="text-[10px] text-slate-500">फोटो लोड नहीं हो सकी</span>
                  )}
                </div>
              </div>
            )}

            {/* Attendance Details Table */}
            <div className="bg-slate-950 rounded-2xl p-3.5 space-y-2 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>काम:</span>
                <span className="text-white font-bold">{selectedItem.job?.title}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>चेक-इन समय:</span>
                <span className="text-white font-semibold">
                  {selectedItem.checkInAt
                    ? new Date(selectedItem.checkInAt).toLocaleTimeString('hi-IN')
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>चेक-आउट समय:</span>
                <span className="text-white font-semibold">
                  {selectedItem.checkOutAt
                    ? new Date(selectedItem.checkOutAt).toLocaleTimeString('hi-IN')
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>कुल काम (Hours):</span>
                <span className="text-emerald-400 font-bold">
                  {selectedItem.hoursWorked || 0} घंटे
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>साइट से दूरी:</span>
                <span className="text-white">
                  {selectedItem.checkInDistanceMeters !== null
                    ? `${selectedItem.checkInDistanceMeters} m`
                    : '--'}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>तरीका (Method):</span>
                <span className="text-white uppercase font-bold">
                  {selectedItem.method}
                </span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>ठेकेदार साइन-ऑफ़:</span>
                <span className="font-bold text-amber-400">
                  {selectedItem.contractorSignoff?.status}
                </span>
              </div>
              {selectedItem.contractorSignoff?.reason && (
                <div className="text-[11px] text-rose-300 pt-1 border-t border-slate-800">
                  कारण: {selectedItem.contractorSignoff.reason}
                </div>
              )}
            </div>

            <button
              onClick={() => setSelectedItem(null)}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold rounded-xl text-xs"
            >
              बंद करें (Close)
            </button>
          </div>
        </div>
      )}

      <BottomNav role="worker" />
    </div>
  );
}
