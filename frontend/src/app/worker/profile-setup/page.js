'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Paintbrush,
  Wrench,
  Hammer,
  Zap,
  Truck,
  Sparkles,
  MapPin,
  CheckCircle2,
  Navigation,
  ArrowRight,
} from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

// Canonical skill metadata matching constants.js
const SKILL_ITEMS = [
  { id: 'painter', label: 'पेंटर (Painter)', icon: Paintbrush },
  { id: 'plumber', label: 'प्लंबर (Plumber)', icon: Wrench },
  { id: 'mason', label: 'राजमिस्त्री (Mason)', icon: Hammer },
  { id: 'electrician', label: 'इलेक्ट्रीशियन (Electrician)', icon: Zap },
  { id: 'carpenter', label: 'बढ़ई (Carpenter)', icon: Hammer },
  { id: 'welder', label: 'वेल्डर (Welder)', icon: Sparkles },
  { id: 'laborer', label: 'मजदूर / हेल्पर (Laborer)', icon: Hammer },
  { id: 'driver', label: 'ड्राइवर (Driver)', icon: Truck },
];

export default function WorkerProfileSetupPage() {
  const router = useRouter();
  const { user, updateUser, isAuthenticated } = useAuthStore();

  const [selectedSkills, setSelectedSkills] = useState([]);
  const [experienceYears, setExperienceYears] = useState(3);
  const [isAvailable, setIsAvailable] = useState(true);
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(18.5204);
  const [lng, setLng] = useState(73.8567);
  const [loading, setLoading] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (user) {
      if (user.skills && user.skills.length > 0) setSelectedSkills(user.skills);
      if (user.experienceYears !== undefined) setExperienceYears(user.experienceYears);
      if (user.isAvailable !== undefined) setIsAvailable(user.isAvailable);
      if (user.address) setAddress(user.address);
      if (user.location?.coordinates) {
        setLng(user.location.coordinates[0]);
        setLat(user.location.coordinates[1]);
      }
    }
  }, [user]);

  const toggleSkill = (skillId) => {
    setSelectedSkills((prev) =>
      prev.includes(skillId)
        ? prev.filter((s) => s !== skillId)
        : [...prev, skillId]
    );
  };

  const handleGetCurrentLocation = () => {
    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(parseFloat(pos.coords.latitude.toFixed(6)));
          setLng(parseFloat(pos.coords.longitude.toFixed(6)));
        },
        (err) => {
          alert('GPS Error: ' + err.message);
        },
        { enableHighAccuracy: true }
      );
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    setLoading(true);
    setSavedSuccess(false);

    try {
      // 1. Update basic profile
      await api.patch('/users/me', {
        skills: selectedSkills,
        experienceYears,
        address,
      });

      // 2. Update location (lat, lng)
      await api.patch('/users/me/location', {
        lat: parseFloat(lat),
        lng: parseFloat(lng),
      });

      // 3. Update availability
      await api.patch('/users/me/availability', {
        isAvailable,
      });

      updateUser({
        skills: selectedSkills,
        experienceYears,
        address,
        isAvailable,
        location: { type: 'Point', coordinates: [lng, lat] },
      });

      setSavedSuccess(true);
      setTimeout(() => {
        router.push('/worker/dashboard');
      }, 1000);
    } catch (err) {
      alert('Error updating profile: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-black text-white">
          कारीगर प्रोफाइल (Worker Profile)
        </h1>
        <p className="text-xs text-slate-400">
          अपना हुनर और कार्यक्षेत्र सेट करें ताकि नजदीकी काम मिल सके
        </p>
      </div>

      {savedSuccess && (
        <div className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl flex items-center gap-2 text-emerald-300 text-xs font-bold animate-fadeIn">
          <CheckCircle2 className="w-4 h-4" />
          प्रोफाइल सफलतापूर्वक सेव हो गई! डैशबोर्ड पर जा रहे हैं...
        </div>
      )}

      <form onSubmit={handleSaveProfile} className="space-y-6">
        {/* Availability Toggle */}
        <div className="p-4 bg-slate-900 border border-slate-800 rounded-2xl flex items-center justify-between">
          <div>
            <h4 className="text-sm font-bold text-white">
              काम के लिए उपलब्ध हैं? (Available for Work)
            </h4>
            <p className="text-xs text-slate-400">
              {isAvailable ? 'नए काम के अलर्ट प्राप्त होंगे' : 'अलर्ट बंद हैं'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAvailable(!isAvailable)}
            className={`w-14 h-8 flex items-center rounded-full p-1 transition-colors ${
              isAvailable ? 'bg-emerald-600 justify-end' : 'bg-slate-700 justify-start'
            }`}
          >
            <div className="w-6 h-6 rounded-full bg-white shadow-md" />
          </button>
        </div>

        {/* Skill Selector Grid */}
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-300">
            आप क्या काम करते हैं? (Select Skills)
          </label>
          <div className="grid grid-cols-2 gap-2.5">
            {SKILL_ITEMS.map((item) => {
              const Icon = item.icon;
              const isSelected = selectedSkills.includes(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => toggleSkill(item.id)}
                  className={`p-3 rounded-xl border flex items-center gap-2.5 transition-all min-h-[50px] text-left ${
                    isSelected
                      ? 'bg-blue-600/20 border-blue-500 text-blue-300 shadow-sm'
                      : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${isSelected ? 'text-blue-400' : 'text-slate-500'}`} />
                  <span className="text-xs font-bold truncate">{item.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Experience Slider */}
        <div className="space-y-2 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex justify-between items-center text-xs font-bold">
            <span className="text-slate-300">अनुभव (Experience):</span>
            <span className="text-blue-400">{experienceYears} वर्ष (Years)</span>
          </div>
          <input
            type="range"
            min="0"
            max="30"
            value={experienceYears}
            onChange={(e) => setExperienceYears(parseInt(e.target.value, 10))}
            className="w-full accent-blue-600"
          />
        </div>

        {/* Location Section */}
        <div className="space-y-3 p-4 bg-slate-900 border border-slate-800 rounded-2xl">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-400" />
              आपकी लोकेशन (Saved Location)
            </label>
            <button
              type="button"
              onClick={handleGetCurrentLocation}
              className="px-2.5 py-1 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/40 rounded-lg text-xs font-bold flex items-center gap-1"
            >
              <Navigation className="w-3.5 h-3.5" />
              GPS से सेट करें
            </button>
          </div>

          <div className="text-xs text-slate-400">
            Current: {lat.toFixed(4)}, {lng.toFixed(4)}
          </div>

          {/* Dev Mode Manual Coordinate Inputs */}
          <div className="p-3 bg-amber-400/10 border border-amber-400/30 rounded-xl space-y-2">
            <span className="text-[10px] font-black uppercase text-amber-300 bg-amber-400/20 px-1.5 py-0.5 rounded">
              DEV SIMULATOR: Manual Coordinates
            </span>
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <label className="text-[10px] text-slate-400">Latitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lat}
                  onChange={(e) => setLat(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
              <div>
                <label className="text-[10px] text-slate-400">Longitude</label>
                <input
                  type="number"
                  step="0.0001"
                  value={lng}
                  onChange={(e) => setLng(parseFloat(e.target.value))}
                  className="w-full px-2 py-1.5 bg-slate-800 border border-slate-700 rounded-lg text-white"
                />
              </div>
            </div>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading || selectedSkills.length === 0}
          className="w-full min-h-[50px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
        >
          {loading ? 'सेव हो रहा है...' : 'प्रोफाइल सेव करें (Save Profile)'}
          <ArrowRight className="w-5 h-5" />
        </button>
      </form>
    </div>
  );
}
