'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  ArrowRight,
  Paintbrush,
  Wrench,
  Hammer,
  Zap,
  Sparkles,
  Truck,
  Minus,
  Plus,
  IndianRupee,
  Calendar,
  MapPin,
  CheckCircle2,
  ShieldCheck,
  Send,
} from 'lucide-react';
import api from '../../../lib/api';
import { MapPicker } from '../../../components/ui/MapPicker';

const SKILLS = [
  { id: 'painter', label: 'पेंटर (Painter)', icon: Paintbrush },
  { id: 'plumber', label: 'प्लंबर (Plumber)', icon: Wrench },
  { id: 'mason', label: 'राजमिस्त्री (Mason)', icon: Hammer },
  { id: 'electrician', label: 'इलेक्ट्रीशियन (Electrician)', icon: Zap },
  { id: 'carpenter', label: 'बढ़ई (Carpenter)', icon: Hammer },
  { id: 'welder', label: 'वेल्डर (Welder)', icon: Sparkles },
  { id: 'laborer', label: 'मजदूर / हेल्पर (Laborer)', icon: Hammer },
  { id: 'driver', label: 'ड्राइवर (Driver)', icon: Truck },
];

const WAGE_PRESETS = [500, 700, 850, 1000];

export default function PostJobPage() {
  const router = useRouter();

  const [step, setStep] = useState(1);
  const [skillRequired, setSkillRequired] = useState('painter');
  const [title, setTitle] = useState('दीवार पेंटिंग कार्य (Wall Painting Work)');
  const [description, setDescription] = useState('');
  const [workersNeeded, setWorkersNeeded] = useState(2);
  const [wagePerDay, setWagePerDay] = useState(850);
  const [startDate, setStartDate] = useState(
    new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [endDate, setEndDate] = useState(
    new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  );
  const [location, setLocation] = useState({ lat: 18.5204, lng: 73.8567 });
  const [addressText, setAddressText] = useState('Central Commercial Site, Pune');
  const [matchRadiusKm, setMatchRadiusKm] = useState(5);

  const [loading, setLoading] = useState(false);
  const [publishSuccessData, setPublishSuccessData] = useState(null);
  const [error, setError] = useState('');

  const handleNext = () => {
    if (step < 6) setStep(step + 1);
  };

  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };

  const handlePublish = async () => {
    setLoading(true);
    setError('');

    try {
      // 1. Create Job (POST /jobs as DRAFT)
      const wagePerDayPaise = wagePerDay * 100;
      const createRes = await api.post('/jobs', {
        title,
        description,
        skillRequired,
        workersNeeded,
        wagePerDayPaise,
        startDate: new Date(startDate).toISOString(),
        endDate: new Date(endDate).toISOString(),
        location,
        addressText,
        matchRadiusKm,
        geofenceRadiusMeters: 100,
        requiresSelfie: true,
      });

      const createdJob = createRes.data;

      // 2. Publish Job (POST /jobs/:id/publish)
      const pubRes = await api.post(`/jobs/${createdJob._id}/publish`);
      setPublishSuccessData(pubRes.data);
    } catch (err) {
      setError(err.message || 'काम पोस्ट करने में समस्या हुई।');
    } finally {
      setLoading(false);
    }
  };

  if (publishSuccessData) {
    const matching = publishSuccessData.matching || {};
    return (
      <div className="max-w-md mx-auto p-6 space-y-6 text-center">
        <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-400 flex items-center justify-center mx-auto animate-bounce-short">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div className="space-y-2">
          <h2 className="text-2xl font-black text-white">
            काम लाइव हो गया! (Job Published)
          </h2>
          <p className="text-sm text-slate-300">
            आपके क्षेत्र के उपलब्ध कारीगरों को नोटिफिकेशन भेज दिया गया है।
          </p>
        </div>

        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl text-left space-y-2 text-xs">
          <div className="flex justify-between font-bold">
            <span className="text-slate-400">कुल सूचित कारीगर (Notified):</span>
            <span className="text-emerald-400 text-sm">{matching.notified || 0} कारीगर</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>लाइव सॉकेट अलर्ट (viaSocket):</span>
            <span className="text-white font-mono">{matching.viaSocket || 0}</span>
          </div>
          <div className="flex justify-between text-slate-400">
            <span>SMS संदेश (viaSms):</span>
            <span className="text-white font-mono">{matching.viaSms || 0}</span>
          </div>
        </div>

        <Link
          href="/contractor/dashboard"
          className="inline-block w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl text-sm"
        >
          डैशबोर्ड पर जाएं (Go to Dashboard)
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4 space-y-5 pb-24">
      {/* Progress Stepper Bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-bold text-slate-400">
          <button
            type="button"
            onClick={step === 1 ? () => router.push('/contractor/dashboard') : handleBack}
            className="flex items-center gap-1 hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" /> वापस
          </button>
          <span>कदम (Step) {step} / 6</span>
        </div>

        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
          <div
            className="h-full bg-blue-600 transition-all duration-300"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-semibold">
          {error}
        </div>
      )}

      {/* Step 1: Skill Selection */}
      {step === 1 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">
              1. काम का प्रकार चुनें (Skill Required)
            </h2>
            <p className="text-xs text-slate-400">
              आपको किस तरह के कारीगर की आवश्यकता है?
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {SKILLS.map((item) => {
              const Icon = item.icon;
              const isSelected = skillRequired === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSkillRequired(item.id);
                    setTitle(`${item.label.split(' ')[0]} कार्य (${item.id} Work)`);
                  }}
                  className={`p-4 rounded-xl border flex flex-col items-center gap-2 transition-all ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-blue-400 ring-2 ring-blue-500/30'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Icon className="w-7 h-7" />
                  <span className="text-xs font-bold text-center">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Step 2: Workers Count */}
      {step === 2 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">
              2. कितने कारीगर चाहिए? (Workers Count)
            </h2>
            <p className="text-xs text-slate-400">
              साइट के लिए कुल आवश्यक कारीगरों की संख्या
            </p>
          </div>

          <div className="p-8 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-center gap-6">
            <button
              type="button"
              onClick={() => setWorkersNeeded(Math.max(1, workersNeeded - 1))}
              className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-700 text-lg font-bold"
            >
              <Minus className="w-5 h-5" />
            </button>

            <div className="text-center">
              <span className="text-5xl font-black text-white">{workersNeeded}</span>
              <span className="block text-xs font-bold text-slate-400 mt-1">कारीगर (Workers)</span>
            </div>

            <button
              type="button"
              onClick={() => setWorkersNeeded(Math.min(50, workersNeeded + 1))}
              className="w-12 h-12 rounded-xl bg-slate-800 hover:bg-slate-700 text-white flex items-center justify-center border border-slate-700 text-lg font-bold"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Wage per Day */}
      {step === 3 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">
              3. रोज़ाना दिहाड़ी (Wage Per Day)
            </h2>
            <p className="text-xs text-slate-400">
              प्रत्येक कारीगर को प्रति दिन दिया जाने वाला वेतन
            </p>
          </div>

          <div className="p-6 bg-slate-900 border border-slate-800 rounded-2xl text-center space-y-4">
            <div className="flex items-center justify-center gap-1 text-4xl font-black text-emerald-400">
              <IndianRupee className="w-8 h-8" />
              <span>{wagePerDay}</span>
              <span className="text-sm font-normal text-slate-400">/दिन</span>
            </div>

            <div className="grid grid-cols-4 gap-2">
              {WAGE_PRESETS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setWagePerDay(p)}
                  className={`py-2 rounded-xl text-xs font-bold border transition-colors ${
                    wagePerDay === p
                      ? 'bg-emerald-600 text-white border-emerald-500'
                      : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                  }`}
                >
                  ₹{p}
                </button>
              ))}
            </div>

            <div className="pt-2">
              <input
                type="number"
                step="50"
                min="100"
                value={wagePerDay}
                onChange={(e) => setWagePerDay(parseInt(e.target.value, 10) || 0)}
                placeholder="कस्टम दिहाड़ी (Custom Amount)"
                className="w-full px-4 py-2 bg-slate-800 border border-slate-700 rounded-xl text-center text-sm font-bold text-white focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      )}

      {/* Step 4: Dates & Title */}
      {step === 4 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">
              4. कार्य शीर्षक और तारीखें (Dates & Title)
            </h2>
            <p className="text-xs text-slate-400">
              काम कब शुरू और समाप्त होगा?
            </p>
          </div>

          <div className="space-y-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">काम का शीर्षक (Title)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-sm font-bold text-white focus:outline-none focus:border-blue-500"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">शुरू तारीख (Start)</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[11px] font-bold text-slate-300">अंतिम तारीख (End)</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs font-semibold text-white"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Step 5: Map Location & Match Radius */}
      {step === 5 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">
              5. साइट लोकेशन और मैच दायरा (Location & Radius)
            </h2>
            <p className="text-xs text-slate-400">
              नक्शे पर पिन लगाएं और खोजने का दायरा चुनें
            </p>
          </div>

          <div className="space-y-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">साइट का पता (Address Text)</label>
              <input
                type="text"
                value={addressText}
                onChange={(e) => setAddressText(e.target.value)}
                required
                className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-xl text-xs text-white font-medium"
              />
            </div>

            {/* Radius Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-300">
                अलर्ट दायरा (Match Radius): {matchRadiusKm} km
              </label>
              <div className="grid grid-cols-3 gap-2">
                {[2, 5, 10].map((r) => (
                  <button
                    key={r}
                    type="button"
                    onClick={() => setMatchRadiusKm(r)}
                    className={`py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                      matchRadiusKm === r
                        ? 'bg-blue-600 text-white border-blue-500'
                        : 'bg-slate-800 text-slate-400 border-slate-700'
                    }`}
                  >
                    {r} km
                  </button>
                ))}
              </div>
            </div>

            {/* Interactive Leaflet Map Picker */}
            <MapPicker
              location={location}
              radiusKm={matchRadiusKm}
              onChangeLocation={(loc) => setLocation(loc)}
            />
          </div>
        </div>
      )}

      {/* Step 6: Review & Publish */}
      {step === 6 && (
        <div className="space-y-4 animate-fadeIn">
          <div className="space-y-1">
            <h2 className="text-lg font-black text-white">
              6. समीक्षा और पब्लिश करें (Review & Publish)
            </h2>
            <p className="text-xs text-slate-400">
              पुष्टि करें ताकि आसपास के कारीगरों को अलर्ट भेजा जा सके
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl space-y-4 text-xs">
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">काम:</span>
              <span className="font-bold text-white text-sm">{title}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">हुनर:</span>
              <span className="font-bold text-blue-400 uppercase">{skillRequired}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">कारीगर संख्या:</span>
              <span className="font-bold text-white">{workersNeeded} कारीगर</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">दिहाड़ी:</span>
              <span className="font-black text-emerald-400 text-sm">₹{wagePerDay} / दिन</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">तारीख:</span>
              <span className="font-bold text-white">{startDate} से {endDate}</span>
            </div>
            <div className="flex justify-between border-b border-slate-800 pb-2">
              <span className="text-slate-400">पता:</span>
              <span className="font-bold text-slate-200 text-right truncate max-w-[200px]">
                {addressText}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400">अलर्ट दायरा:</span>
              <span className="font-bold text-amber-300">{matchRadiusKm} km के भीतर</span>
            </div>
          </div>
        </div>
      )}

      {/* Action Footer Navigation */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-slate-900/95 backdrop-blur border-t border-slate-800 z-30">
        <div className="max-w-md mx-auto flex items-center gap-3">
          {step > 1 && (
            <button
              type="button"
              onClick={handleBack}
              disabled={loading}
              className="px-4 py-3 bg-slate-800 text-slate-300 font-bold rounded-xl text-xs hover:bg-slate-700"
            >
              पीछे (Back)
            </button>
          )}

          {step < 6 ? (
            <button
              type="button"
              onClick={handleNext}
              className="flex-1 min-h-[50px] bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-transform active:scale-95"
            >
              आगे बढ़ें (Next) <ArrowRight className="w-5 h-5" />
            </button>
          ) : (
            <button
              type="button"
              onClick={handlePublish}
              disabled={loading}
              className="flex-1 min-h-[50px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-black rounded-xl flex items-center justify-center gap-2 text-sm shadow-lg transition-transform active:scale-95"
            >
              <Send className="w-5 h-5" />
              {loading ? 'अलर्ट भेजा जा रहा है...' : 'पब्लिश करें व अलर्ट भेजें (Publish & Broadcast)'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
