'use client';

import React from 'react';
import Link from 'next/link';
import { BellRing, X, ArrowRight, IndianRupee, MapPin } from 'lucide-react';
import { useSocketStore } from '../../store/socketStore';

export const AlertToast = () => {
  const { activeAlert, dismissAlert } = useSocketStore();

  if (!activeAlert) return null;

  const wageInRupees = Math.round((activeAlert.wagePerDayPaise || 0) / 100);
  const distanceKm = activeAlert.distanceMeters
    ? (activeAlert.distanceMeters / 1000).toFixed(1)
    : '0.0';

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-3 bg-gradient-to-r from-blue-700 via-indigo-700 to-blue-800 text-white shadow-2xl animate-bounce-short border-b-2 border-yellow-400">
      <div className="max-w-md mx-auto flex items-start justify-between gap-3">
        <div className="flex items-center justify-center p-2 bg-yellow-400 text-slate-900 rounded-full mt-1 shrink-0 animate-pulse">
          <BellRing className="w-6 h-6" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider bg-yellow-400/20 text-yellow-300 px-2 py-0.5 rounded">
              नया काम उपलब्ध (New Job Alert)
            </span>
          </div>

          <h4 className="text-base font-bold text-white truncate mt-1">
            {activeAlert.title || activeAlert.skillRequired}
          </h4>

          <div className="flex items-center gap-4 text-xs font-medium text-blue-100 mt-1">
            <span className="flex items-center gap-1 font-bold text-green-300">
              <IndianRupee className="w-3.5 h-3.5" /> ₹{wageInRupees}/दिन
            </span>
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" /> {distanceKm} km दूर
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            <Link
              href={`/worker/jobs/${activeAlert.jobId}`}
              onClick={dismissAlert}
              className="inline-flex items-center justify-center gap-1.5 px-4 py-2 bg-yellow-400 hover:bg-yellow-300 text-slate-900 font-bold rounded-lg text-sm shadow-md transition-transform active:scale-95"
            >
              देखें (View Job) <ArrowRight className="w-4 h-4" />
            </Link>

            <button
              onClick={dismissAlert}
              className="px-3 py-2 text-xs font-medium text-blue-200 hover:text-white"
            >
              बाद में (Dismiss)
            </button>
          </div>
        </div>

        <button
          onClick={dismissAlert}
          className="text-blue-200 hover:text-white p-1"
          aria-label="Close alert"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );
};
