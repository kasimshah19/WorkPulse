'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  AlertTriangle,
  Flame,
  ShieldAlert,
  MessageSquare,
  HelpCircle,
  Camera,
  CheckCircle2,
  ArrowLeft,
  Lock,
  RefreshCw,
  X,
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

const INCIDENT_TYPES = [
  {
    key: 'INJURY',
    titleHi: 'चोट / दुर्घटना (Injury)',
    descHi: 'साइट पर किसी को चोट लगी या हादसा हुआ',
    icon: Flame,
    color: 'border-amber-500/50 bg-amber-500/10 text-amber-400',
    adminOnly: false,
  },
  {
    key: 'HARASSMENT',
    titleHi: 'गाली-गलौज / बदतमीज़ी (Harassment)',
    descHi: 'ठेकेदार या किसी अन्य द्वारा दुर्व्यवहार या धमकी',
    icon: ShieldAlert,
    color: 'border-rose-500/50 bg-rose-500/10 text-rose-400',
    adminOnly: true,
  },
  {
    key: 'DISPUTE',
    titleHi: 'पैसा या साइन-ऑफ विवाद (Dispute)',
    descHi: 'हाज़िरी या मजदूरी का मसला',
    icon: AlertTriangle,
    color: 'border-blue-500/50 bg-blue-500/10 text-blue-400',
    adminOnly: true,
  },
  {
    key: 'OTHER',
    titleHi: 'अन्य समस्या (Other Issue)',
    descHi: 'अन्य कोई साइट सुरक्षा या नियम उल्लंघन',
    icon: HelpCircle,
    color: 'border-slate-600 bg-slate-800 text-slate-300',
    adminOnly: false,
  },
];

const SEVERITIES = [
  { key: 'LOW', label: 'साधारण (Low)' },
  { key: 'MEDIUM', label: 'मध्यम (Medium)' },
  { key: 'HIGH', label: 'गंभीर (High)' },
  { key: 'CRITICAL', label: 'अति-गंभीर (Critical)' },
];

export default function WorkerReportIncidentPage() {
  const router = useRouter();
  const { user } = useAuthStore();

  const [type, setType] = useState('INJURY');
  const [severity, setSeverity] = useState('MEDIUM');
  const [description, setDescription] = useState('');
  const [photos, setPhotos] = useState([]);
  const [jobs, setJobs] = useState([]);
  const [selectedJobId, setSelectedJobId] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    // Fetch assigned jobs
    api
      .get('/jobs/my-jobs')
      .then((res) => {
        const list = res.data?.jobs || res.jobs || [];
        setJobs(list);
        if (list.length > 0) {
          setSelectedJobId(list[0]._id);
        }
      })
      .catch(() => {});
  }, []);

  const handlePhotoAdd = (e) => {
    const files = Array.from(e.target.files || []);
    if (photos.length + files.length > 3) {
      alert('अधिकतम 3 तस्वीरें जोड़ी जा सकती हैं (Maximum 3 photos)');
      return;
    }
    setPhotos([...photos, ...files]);
  };

  const removePhoto = (idx) => {
    setPhotos(photos.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (description.trim().length < 10) {
      setError('विवरण कम से कम 10 अक्षरों का होना चाहिए (Description min 10 chars)');
      return;
    }

    setSubmitting(true);
    setError(null);

    const formData = new FormData();
    formData.append('type', type);
    formData.append('severity', severity);
    formData.append('description', description.trim());
    if (selectedJobId) formData.append('jobId', selectedJobId);

    photos.forEach((file) => {
      formData.append('photos', file);
    });

    try {
      await api.post('/incidents', formData);
      setSuccess(true);
      setTimeout(() => {
        router.push('/worker/incidents');
      }, 1500);
    } catch (err) {
      setError(err.message || 'रिपोर्ट दर्ज करने में विफल');
    } finally {
      setSubmitting(false);
    }
  };

  const selectedTypeConfig = INCIDENT_TYPES.find((t) => t.key === type);

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
            समस्या रिपोर्ट करें (Report Incident)
          </h1>
          <p className="text-[11px] text-slate-400">सुरक्षा, दुर्व्यवहार या विवाद की शिकायत दर्ज करें</p>
        </div>
      </div>

      <div className="mt-4 space-y-4 max-w-md mx-auto">
        {error && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-4 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />
            <span>आपकी रिपोर्ट दर्ज हो गई है और एडमिन को भेज दी गई है।</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Incident Type Grid */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300">समस्या का प्रकार चुनें (Type):</label>
            <div className="grid grid-cols-2 gap-2">
              {INCIDENT_TYPES.map((t) => {
                const Icon = t.icon;
                const isSelected = type === t.key;
                return (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setType(t.key)}
                    className={`p-3 rounded-2xl text-left border transition-all min-h-[72px] flex flex-col justify-between ${
                      isSelected
                        ? `${t.color} border-2 shadow-sm`
                        : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <Icon className="w-5 h-5 mb-1" />
                    <div>
                      <span className="font-bold text-xs block text-white">{t.titleHi}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Privacy Note for Harassment/Dispute */}
          {selectedTypeConfig?.adminOnly && (
            <div className="p-3.5 rounded-2xl bg-amber-950/30 border border-amber-600/40 text-amber-200 text-xs flex items-start gap-2.5">
              <Lock className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong className="block text-amber-300 font-bold mb-0.5">गोपनीय रिपोर्ट (Private & Protected)</strong>
                <span>यह रिपोर्ट सिर्फ़ वर्कपल्स एडमिन को दिखेगी, ठेकेदार या साथी को नहीं। आपकी पहचान सुरक्षित रहेगी।</span>
              </div>
            </div>
          )}

          {/* Job Selector */}
          {jobs.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-300">संबंधित काम (Associated Job):</label>
              <select
                value={selectedJobId}
                onChange={(e) => setSelectedJobId(e.target.value)}
                className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white focus:outline-none focus:border-blue-500"
              >
                <option value="">कोई सक्रिय काम नहीं (Off-site)</option>
                {jobs.map((j) => (
                  <option key={j._id} value={j._id}>
                    {j.title} ({j.skillRequired})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Severity Chips */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">गंभीरता (Severity):</label>
            <div className="grid grid-cols-4 gap-1.5">
              {SEVERITIES.map((s) => (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => setSeverity(s.key)}
                  className={`min-h-[44px] py-2 px-1 rounded-xl text-center text-xs font-bold border transition-all ${
                    severity === s.key
                      ? 'bg-blue-600 text-white border-blue-400'
                      : 'bg-slate-900 text-slate-400 border-slate-800'
                  }`}
                >
                  {s.label.split(' ')[0]}
                </button>
              ))}
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300">पूरा विवरण लिखें (Description):</label>
            <textarea
              rows={4}
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="क्या हुआ, कब हुआ, और किसने किया? संक्षेप में बताएं..."
              className="w-full p-3 rounded-xl bg-slate-900 border border-slate-700 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          {/* Photos Upload */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-300 block">फोटो साक्ष्य (Photos, max 3):</label>
            <div className="flex items-center gap-2">
              {photos.map((p, idx) => (
                <div key={idx} className="relative w-16 h-16 rounded-xl border border-slate-700 overflow-hidden bg-slate-800">
                  <img src={URL.createObjectURL(p)} alt="proof" className="w-full h-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removePhoto(idx)}
                    className="absolute top-0 right-0 p-1 bg-black/70 text-white rounded-bl"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}

              {photos.length < 3 && (
                <label className="w-16 h-16 rounded-xl border-2 border-dashed border-slate-700 hover:border-slate-500 flex flex-col items-center justify-center cursor-pointer text-slate-400 hover:text-white">
                  <Camera className="w-5 h-5 mb-0.5" />
                  <span className="text-[9px] font-semibold">+फोटो</span>
                  <input
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handlePhotoAdd}
                  />
                </label>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={submitting}
            className="w-full min-h-[52px] py-3.5 rounded-2xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            {submitting && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>रिपोर्ट दर्ज करें (Submit Report)</span>
          </button>
        </form>
      </div>
    </div>
  );
}
