'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import {
  Star,
  UserCheck,
  CheckCircle2,
  Lock,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import api from '../../../../lib/api';
import StarInput from '../../../../components/ui/StarInput';
import TagChips from '../../../../components/ui/TagChips';

export default function ContractorRatingScreen() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.jobId;

  const [job, setJob] = useState(null);
  const [workers, setWorkers] = useState([]);
  const [ratingsState, setRatingsState] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!jobId) return;

    Promise.all([
      api.get(`/jobs/${jobId}`),
      api.get(`/ratings/mine/given?jobId=${jobId}`),
    ])
      .then(([jobRes, givenRes]) => {
        const j = jobRes.data?.job || jobRes.job;
        setJob(j);

        const assigned = j.assignedWorkers || [];
        setWorkers(assigned);

        // Map already given ratings
        const given = givenRes.data?.ratings || givenRes.ratings || [];
        const stateMap = {};
        given.forEach((r) => {
          const wId = r.toUser?._id || r.toUser;
          stateMap[wId] = {
            done: true,
            score: r.score,
            tags: r.tags || [],
            comment: r.comment || '',
          };
        });
        setRatingsState(stateMap);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [jobId]);

  const handleScoreChange = (workerId, score) => {
    setRatingsState((prev) => ({
      ...prev,
      [workerId]: { ...(prev[workerId] || {}), score, error: null },
    }));
  };

  const handleTagsChange = (workerId, tags) => {
    setRatingsState((prev) => ({
      ...prev,
      [workerId]: { ...(prev[workerId] || {}), tags },
    }));
  };

  const handleCommentChange = (workerId, comment) => {
    setRatingsState((prev) => ({
      ...prev,
      [workerId]: { ...(prev[workerId] || {}), comment },
    }));
  };

  const handleSubmit = async (workerId) => {
    const current = ratingsState[workerId] || {};
    if (!current.score) {
      setRatingsState((prev) => ({
        ...prev,
        [workerId]: { ...(prev[workerId] || {}), error: 'कृपया स्टार रेटिंग चुनें' },
      }));
      return;
    }

    setRatingsState((prev) => ({
      ...prev,
      [workerId]: { ...(prev[workerId] || {}), submitting: true, error: null },
    }));

    try {
      await api.post('/ratings', {
        jobId,
        toUserId: workerId,
        type: 'WORKER_SKILL',
        score: current.score,
        tags: current.tags || [],
        comment: (current.comment || '').trim(),
      });

      setRatingsState((prev) => ({
        ...prev,
        [workerId]: { ...(prev[workerId] || {}), done: true, submitting: false },
      }));
    } catch (err) {
      setRatingsState((prev) => ({
        ...prev,
        [workerId]: {
          ...(prev[workerId] || {}),
          submitting: false,
          error: err.message || 'रेटिंग दर्ज करने में विफल',
        },
      }));
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-400 text-xs">लोड हो रहा है...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
      {/* Header */}
      <div className="flex items-center gap-3 py-3 border-b border-slate-800">
        <button
          type="button"
          onClick={() => router.back()}
          className="p-2 rounded-xl bg-slate-900 border border-slate-800 text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-base font-black tracking-tight text-white">
            कारीगरों को रेटिंग दें (Rate Workers)
          </h1>
          <p className="text-[11px] text-slate-400">{job?.title || 'काम की समीक्षा'}</p>
        </div>
      </div>

      <div className="mt-4 space-y-6 max-w-md mx-auto">
        {/* Double-Blind Privacy Note */}
        <div className="p-3.5 rounded-2xl bg-blue-950/40 border border-blue-800/60 flex items-start gap-3">
          <Lock className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" />
          <div className="text-xs text-blue-200">
            <strong className="block text-white font-bold mb-0.5">डबल-ब्लाइंड प्रणाली (Double-Blind Privacy):</strong>
            <span>
              कारीगर को आपकी रेटिंग तभी दिखेगी जब वह भी आपकी रेटिंग दे देगा या विंडो बंद होगी। निष्पक्ष और सच्ची रेटिंग दें।
            </span>
          </div>
        </div>

        {workers.length === 0 ? (
          <div className="p-6 text-center text-slate-400 bg-slate-900 rounded-2xl border border-slate-800 text-xs">
            इस काम पर कोई कारीगर असाइन नहीं थे।
          </div>
        ) : (
          workers.map((worker) => {
            const wId = worker._id || worker;
            const state = ratingsState[wId] || {};

            return (
              <div
                key={wId}
                className="p-5 rounded-3xl bg-slate-900 border border-slate-800 space-y-4 shadow-xl"
              >
                <div className="flex items-center gap-2.5 pb-2 border-b border-slate-800">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                    <UserCheck className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="font-bold text-sm text-white">
                      {worker.name || 'कारीगर (Worker)'}
                    </h2>
                    <p className="text-[11px] text-slate-400">हुनर और समय की पाबंदी (Skill & Punctuality)</p>
                  </div>
                </div>

                {state.done ? (
                  <div className="p-4 rounded-2xl bg-emerald-950/40 border border-emerald-700/60 text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                    <p className="text-xs font-bold text-emerald-300">रेटिंग सफलतापूर्वक दर्ज हो गई!</p>
                    <p className="text-[11px] text-slate-400">
                      कारीगर द्वारा आपकी समीक्षा पूरी करने पर रेटिंग प्रोफाइल पर जुड़ेगी।
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {state.error && (
                      <div className="p-2.5 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs">
                        {state.error}
                      </div>
                    )}

                    <StarInput
                      value={state.score || 0}
                      onChange={(score) => handleScoreChange(wId, score)}
                    />

                    <TagChips
                      type="WORKER_SKILL"
                      selectedTags={state.tags || []}
                      onChange={(tags) => handleTagsChange(wId, tags)}
                    />

                    <div className="space-y-1">
                      <label className="text-[11px] font-semibold text-slate-400">
                        संक्षिप्त टिप्पणी (वैकल्पिक, अधिकतम 300 अक्षर):
                      </label>
                      <input
                        type="text"
                        maxLength={300}
                        value={state.comment || ''}
                        onChange={(e) => handleCommentChange(wId, e.target.value)}
                        placeholder="उदा: समय पर आया, बढ़िया काम किया"
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl bg-slate-950 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
                      />
                    </div>

                    <button
                      type="button"
                      disabled={state.submitting || !state.score}
                      onClick={() => handleSubmit(wId)}
                      className="w-full min-h-[48px] py-3 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-xs shadow flex items-center justify-center gap-2 transition-transform active:scale-95 disabled:opacity-50"
                    >
                      {state.submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
                      <span>कारीगर की रेटिंग सबमिट करें (Submit Rating)</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
