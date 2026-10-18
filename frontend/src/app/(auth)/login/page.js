'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Phone, Shield, ArrowRight, HardHat, Briefcase, RotateCcw } from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [step, setStep] = useState('phone'); // 'phone' | 'otp'
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [devOtp, setDevOtp] = useState(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState('worker'); // 'worker' | 'contractor'
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSendOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/send-otp', {
        phone,
        purpose: 'login',
      });

      if (res.data?.devOtp) {
        setDevOtp(res.data.devOtp);
        setOtp(res.data.devOtp); // auto-fill dev otp for super fast test flow
      }

      setStep('otp');
    } catch (err) {
      setError(err.message || 'OTP भेजने में समस्या हुई। कृपया दोबारा प्रयास करें।');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const payload = { phone, otp };
      if (isNewUser) {
        payload.name = name;
        payload.role = role;
      }

      const res = await api.post('/auth/verify-otp', payload);

      if (res.data?.token && res.data?.user) {
        setAuth(res.data.user, res.data.token);

        // Redirect based on role
        if (res.data.user.role === 'contractor') {
          router.push('/contractor/dashboard');
        } else {
          router.push('/worker/dashboard');
        }
      }
    } catch (err) {
      if (err.code === 'REGISTRATION_REQUIRED') {
        setIsNewUser(true);
        setError('नया खाता! कृपया अपना नाम और रोल चुनें।');
      } else {
        setError(err.message || 'OTP गलत है या एक्सपायर हो गया है।');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[85vh] flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-black text-white">
            लॉगिन / खाता बनाएं
          </h1>
          <p className="text-xs text-slate-400">
            Login or Register with your Mobile Number
          </p>
        </div>

        {error && (
          <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400 font-semibold">
            {error}
          </div>
        )}

        {devOtp && (
          <div className="p-3 bg-amber-400/20 border border-amber-400/50 rounded-xl text-center space-y-1">
            <span className="text-[10px] font-black uppercase tracking-wider bg-amber-400 text-slate-900 px-2 py-0.5 rounded">
              DEV MODE OTP
            </span>
            <div className="text-2xl font-black text-amber-300 tracking-widest">
              {devOtp}
            </div>
            <p className="text-[10px] text-amber-200">
              Dev OTP received from server (Auto-filled)
            </p>
          </div>
        )}

        {step === 'phone' ? (
          <form onSubmit={handleSendOtp} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-300">
                मोबाइल नंबर (Mobile Number)
              </label>
              <div className="relative">
                <Phone className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="tel"
                  placeholder="98765 43210"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-base font-medium focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || !phone}
              className="w-full min-h-[50px] bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
              {loading ? 'OTP भेजा जा रहा है...' : 'OTP भेजें (Send OTP)'}
              <ArrowRight className="w-5 h-5" />
            </button>

            <div className="text-center pt-2">
              <Link
                href="/dev/login"
                className="text-xs text-amber-400 hover:underline font-semibold"
              >
                🧪 Dev Multi-User Quick Login (सीडेड यूज़र्स)
              </Link>
            </div>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="space-y-4">
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-slate-300">
                  OTP दर्ज करें (Enter 6-Digit OTP)
                </label>
                <button
                  type="button"
                  onClick={() => setStep('phone')}
                  className="text-xs text-blue-400 hover:underline flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" /> नंबर बदलें
                </button>
              </div>

              <div className="relative">
                <Shield className="w-5 h-5 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  maxLength={6}
                  placeholder="123456"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  required
                  className="w-full pl-11 pr-4 py-3 bg-slate-800 border border-slate-700 rounded-xl text-white text-xl tracking-widest font-black focus:outline-none focus:border-blue-500 text-center"
                />
              </div>
            </div>

            {/* Registration fields if user does not exist */}
            {isNewUser && (
              <div className="space-y-3 pt-2 border-t border-slate-800 animate-fadeIn">
                <div className="space-y-1">
                  <label className="text-xs font-semibold text-slate-300">
                    आपका नाम (Your Full Name)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Ramesh Kumar"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    required
                    className="w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-xl text-white text-sm focus:outline-none focus:border-blue-500"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-slate-300">
                    आप क्या हैं? (Select Role)
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setRole('worker')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        role === 'worker'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <HardHat className="w-6 h-6" />
                      <span className="text-xs font-bold">कारीगर / मजदूर (Worker)</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setRole('contractor')}
                      className={`p-3 rounded-xl border flex flex-col items-center gap-1.5 transition-all ${
                        role === 'contractor'
                          ? 'bg-blue-600/20 border-blue-500 text-blue-400'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      <Briefcase className="w-6 h-6" />
                      <span className="text-xs font-bold">ठेकेदार (Contractor)</span>
                    </button>
                  </div>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otp.length !== 6 || (isNewUser && !name)}
              className="w-full min-h-[50px] bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold rounded-xl flex items-center justify-center gap-2 shadow-lg transition-transform active:scale-95"
            >
              {loading ? 'सत्यापित हो रहा है...' : 'पुष्टि करें (Verify & Login)'}
              <ArrowRight className="w-5 h-5" />
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
