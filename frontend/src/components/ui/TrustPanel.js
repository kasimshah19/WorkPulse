'use client';

import React, { useEffect, useState } from 'react';
import {
  ShieldCheck,
  CheckCircle,
  Clock,
  AlertTriangle,
  Award,
  ThumbsUp,
  MessageSquare,
  Building,
  UserCheck,
} from 'lucide-react';
import api from '../../lib/api';
import ScoreBadge from './ScoreBadge';

export function TrustPanel({ userId, initialData = null, onClose }) {
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (initialData) {
      setData(initialData);
      return;
    }

    if (!userId) return;

    let mounted = true;
    setLoading(true);

    api
      .get(`/users/${userId}/reputation`)
      .then((res) => {
        if (mounted) {
          setData(res.data || res);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message || 'Failed to load reputation');
          setLoading(false);
        }
      });

    return () => {
      mounted = false;
    };
  }, [userId, initialData]);

  if (loading) {
    return (
      <div className="p-6 text-center text-slate-400">
        <div className="w-8 h-8 mx-auto border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-3" />
        <p className="text-xs">भरोसा और रेटिंग विवरण लोड हो रहा है...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-slate-400 text-center text-xs">
        {error || 'विवरण उपलब्ध नहीं है'}
      </div>
    );
  }

  const { name, role, summary = {}, topTags = [], recentComments = [], objectiveStats = {} } = data;
  const isContractor = role === 'contractor';

  return (
    <div className="bg-slate-900 text-white rounded-2xl border border-slate-800 p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
            {isContractor ? <Building className="w-5 h-5" /> : <UserCheck className="w-5 h-5" />}
          </div>
          <div>
            <h3 className="font-bold text-sm text-slate-100 flex items-center gap-1.5">
              <span>{name || 'उपयोगकर्ता (User)'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 uppercase font-semibold">
                {isContractor ? 'ठेकेदार' : 'कारीगर'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">विश्वसनीयता स्कोरकार्ड (Trust Scorecard)</p>
          </div>
        </div>

        {summary.badge && (
          <ScoreBadge score={summary.score || summary.avg} count={summary.count} badge={summary.badge} />
        )}
      </div>

      {/* Objective Performance Section */}
      <div className="space-y-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-300">
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>सिस्टम डेटा (वास्तविक रिकॉर्ड्स)</span>
        </div>

        {objectiveStats.sampleTooSmall ? (
          <div className="p-3 rounded-xl bg-slate-800/60 border border-slate-700/60 text-center">
            <p className="text-xs font-semibold text-amber-400">
              {isContractor ? 'नया ठेकेदार, अभी कम डेटा है' : 'नया कारीगर, अभी कम डेटा है'}
            </p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              5 से कम कार्य दिवस पूरे होने पर प्रतिशत के बजाय सीधा डेटा दिखाया जाता है।
            </p>
          </div>
        ) : isContractor ? (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
              <span className="text-[11px] text-slate-400 block">समय पर मंज़ूरी (Approval):</span>
              <span className="text-sm font-black text-emerald-400">
                {objectiveStats.escrowRowsSettled > 0
                  ? `${objectiveStats.escrowRowsSettled} में से ${objectiveStats.approvedByContractorCount} बार`
                  : 'डेटा नहीं'}
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">ठेकेदार ने खुद साइन-ऑफ किया</span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
              <span className="text-[11px] text-slate-400 block">विवाद स्थिति (Disputes):</span>
              <span className="text-sm font-black text-blue-400">
                {objectiveStats.disputesOpenedAgainst || 0} कुल विवाद
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                {objectiveStats.disputesResolvedForWorker || 0} वर्कर के पक्ष में सुलझे
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
              <span className="text-[11px] text-slate-400 block">औसत स्वीकृति समय:</span>
              <span className="text-sm font-black text-amber-400">
                {objectiveStats.avgApprovalHours ? `${objectiveStats.avgApprovalHours} घंटे` : 'तुरंत'}
              </span>
            </div>

            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
              <span className="text-[11px] text-slate-400 block">सुरक्षा इंसिडेंट्स:</span>
              <span className="text-sm font-black text-slate-200">
                {objectiveStats.incidentsReported || 0} रिपोर्ट
              </span>
              <span className="text-[10px] text-slate-400 block mt-0.5">
                ({objectiveStats.incidentsPer100WorkerDays || 0} प्रति 100 कार्य-दिवस)
              </span>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
              <span className="text-[11px] text-slate-400 block">कुल काम के दिन:</span>
              <span className="text-sm font-black text-emerald-400">{objectiveStats.daysWorked || 0} दिन</span>
            </div>
            <div className="p-2.5 rounded-xl bg-slate-800/80 border border-slate-700/70">
              <span className="text-[11px] text-slate-400 block">अनुपस्थिति (No Show):</span>
              <span className="text-sm font-black text-rose-400">{objectiveStats.noShowCount || 0} बार छूटा</span>
            </div>
          </div>
        )}
      </div>

      {/* Top Reputation Tags */}
      {topTags.length > 0 && (
        <div className="space-y-1.5 pt-1">
          <span className="text-xs font-bold text-slate-300 block">शीर्ष विशेषताएं (Top Tags):</span>
          <div className="flex flex-wrap gap-1.5">
            {topTags.map((t, idx) => (
              <span
                key={idx}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-900/30 border border-blue-700/40 text-blue-300 text-xs font-semibold"
              >
                <Award className="w-3 h-3 text-blue-400" />
                <span>{t.tag}</span>
                <span className="text-[10px] opacity-75 font-mono">({t.count})</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Recent Comments (First names only for privacy) */}
      {recentComments.length > 0 && (
        <div className="space-y-2 pt-1">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-slate-400" />
            <span>हालिया समीक्षाएं (Verified Feedback):</span>
          </span>
          <div className="space-y-1.5">
            {recentComments.slice(0, 3).map((c, idx) => (
              <div key={idx} className="p-2.5 rounded-xl bg-slate-800/50 border border-slate-800 text-xs">
                <div className="flex items-center justify-between text-[11px] text-slate-400 mb-1">
                  <span className="font-semibold text-slate-300">{c.authorFirstName || 'Verified User'}</span>
                  <span className="text-amber-400 font-bold">★ {c.score}</span>
                </div>
                <p className="text-slate-300 italic">"{c.comment}"</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {onClose && (
        <button
          type="button"
          onClick={onClose}
          className="w-full py-2.5 mt-2 rounded-xl bg-slate-800 text-slate-300 font-semibold text-xs border border-slate-700 hover:bg-slate-700"
        >
          बंद करें (Close)
        </button>
      )}
    </div>
  );
}

export default TrustPanel;
