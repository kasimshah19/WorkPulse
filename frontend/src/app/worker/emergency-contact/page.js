'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Phone, User, ShieldAlert, CheckCircle2, ArrowLeft, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

export default function EmergencyContactPage() {
  const router = useRouter();
  const { user, updateUser } = useAuthStore();
  const [name, setName] = useState(user?.emergencyContact?.name || '');
  const [phone, setPhone] = useState(user?.emergencyContact?.phone || '');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);

    if (!name.trim() || name.trim().length < 2) {
      setError('कृपया नाम दर्ज करें (कम से कम 2 अक्षर)');
      return;
    }

    let cleanPhone = phone.trim().replace(/\s+/g, '');
    if (!cleanPhone.startsWith('+')) {
      if (cleanPhone.length === 10) cleanPhone = `+91${cleanPhone}`;
      else cleanPhone = `+${cleanPhone}`;
    }

    if (!/^\+[1-9]\d{1,14}$/.test(cleanPhone)) {
      setError('कृपया सही मोबाइल नंबर दर्ज करें (उदा: +919876543210)');
      return;
    }

    setLoading(true);
    try {
      const res = await api.patch('/users/me/emergency-contact', {
        name: name.trim(),
        phone: cleanPhone,
      });

      if (updateUser) {
        updateUser({
          ...user,
          emergencyContact: res.data?.emergencyContact || { name: name.trim(), phone: cleanPhone },
          hasEmergencyContact: true,
        });
      }

      setSuccess(true);
      setTimeout(() => {
        router.back();
      }, 1500);
    } catch (err) {
      setError(err.message || 'इमरजेंसी संपर्क सहेजने में विफल');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white p-4 pb-24">
      {/* Top Header */}
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
            आपातकालीन संपर्क (Emergency Contact)
          </h1>
          <p className="text-[11px] text-slate-400">SOS के समय परिवार या मित्र को SMS अलर्ट जाएगा</p>
        </div>
      </div>

      <div className="mt-5 space-y-4 max-w-sm mx-auto">
        {/* Notice Card */}
        <div className="p-4 rounded-2xl bg-blue-950/40 border border-blue-800/60 space-y-2">
          <div className="flex items-center gap-2 text-blue-400 font-bold text-xs">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>यह नंबर कैसे उपयोग होगा?</span>
          </div>
          <p className="text-xs text-blue-200/90 leading-relaxed">
            जब आप SOS बटन दबाएंगे, तो इस नंबर पर आपकी लाइव लोकेशन के साथ तुरंत SMS भेजा जाएगा। सेव करने पर उन्हें सूचित करने के लिए एक बार SMS जाएगा।
          </p>
          <p className="text-[10px] text-slate-400">* प्रतिदिन अधिकतम 3 बार बदला जा सकता है।</p>
        </div>

        {error && (
          <div className="p-3 rounded-xl bg-rose-950/80 border border-rose-700 text-rose-300 text-xs font-semibold">
            {error}
          </div>
        )}

        {success && (
          <div className="p-3 rounded-xl bg-emerald-950/80 border border-emerald-700 text-emerald-300 text-xs font-semibold flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>इमरजेंसी संपर्क सफलतापूर्वक जुड़ गया!</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <User className="w-4 h-4 text-slate-400" />
              <span>संपर्क व्यक्ति का नाम (Name):</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="उदा: पिता, भाई या मित्र का नाम"
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Phone className="w-4 h-4 text-slate-400" />
              <span>मोबाइल नंबर (Phone Number):</span>
            </label>
            <input
              type="tel"
              required
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+919876543210"
              className="w-full min-h-[48px] px-3.5 py-2.5 rounded-xl bg-slate-900 border border-slate-700 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500 font-mono"
            />
            <span className="text-[11px] text-slate-500 block">
              आपका अपना नंबर नहीं हो सकता।
            </span>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full min-h-[52px] py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-500 active:bg-blue-700 text-white font-bold text-sm shadow flex items-center justify-center gap-2 transition-transform active:scale-95"
          >
            {loading && <RefreshCw className="w-4 h-4 animate-spin" />}
            <span>सेव करें (Save Emergency Contact)</span>
          </button>
        </form>
      </div>
    </div>
  );
}
