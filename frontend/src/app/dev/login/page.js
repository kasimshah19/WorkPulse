'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { HardHat, Briefcase, ArrowLeft, LogIn, RefreshCw } from 'lucide-react';
import api from '../../../lib/api';
import { useAuthStore } from '../../../store/authStore';

export default function DevLoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loginLoading, setLoginLoading] = useState(null);
  const [error, setError] = useState('');

  const fetchDevUsers = async () => {
    setLoading(true);
    setError('');
    try {
      const res = await api.get('/auth/dev-users');
      setUsers(res.data || []);
    } catch (err) {
      setError(err.message || 'Dev users could not be loaded. Ensure OTP_DEV_MODE=true on backend.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevUsers();
  }, []);

  const handleQuickLogin = async (phone, role) => {
    setLoginLoading(phone);
    try {
      const res = await api.post('/auth/dev-login', { phone });
      if (res.data?.token && res.data?.user) {
        setAuth(res.data.user, res.data.token);
        if (role === 'contractor') {
          router.push('/contractor/dashboard');
        } else if (role === 'admin') {
          router.push('/admin/disputes');
        } else {
          if (res.data.user.profileComplete === false || !res.data.user.skills || res.data.user.skills.length === 0) {
            router.push('/worker/onboarding');
          } else {
            router.push('/worker/dashboard');
          }
        }
      }
    } catch (err) {
      alert('Login failed: ' + err.message);
    } finally {
      setLoginLoading(null);
    }
  };

  return (
    <div className="max-w-md mx-auto p-4 space-y-4">
      <div className="flex items-center justify-between">
        <Link
          href="/login"
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white"
        >
          <ArrowLeft className="w-4 h-4" /> लॉगिन पर लौटें
        </Link>
        <button
          onClick={fetchDevUsers}
          className="p-1.5 rounded-lg bg-slate-800 text-slate-400 hover:text-white"
          title="Refresh List"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="bg-amber-400/10 border border-amber-400/30 rounded-2xl p-4 text-center space-y-1">
        <h1 className="text-lg font-black text-amber-300">
          🧪 Dev Quick Multi-User Login
        </h1>
        <p className="text-xs text-amber-200/80">
          Click any seeded user below to instantly log in without entering OTP.
        </p>
      </div>

      {error && (
        <div className="p-3 bg-rose-500/10 border border-rose-500/30 rounded-xl text-xs text-rose-400">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-center py-8 text-slate-400 text-xs">
          सीडेड यूज़र्स लोड हो रहे हैं...
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => {
            const isContractor = u.role === 'contractor';
            const isAdmin = u.role === 'admin';
            return (
              <div
                key={u._id}
                className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl flex items-center justify-between gap-3 hover:border-slate-700 transition-colors"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center text-white shrink-0 ${
                      isAdmin
                        ? 'bg-purple-600'
                        : isContractor
                        ? 'bg-indigo-600'
                        : 'bg-emerald-600'
                    }`}
                  >
                    {isAdmin ? (
                      <span className="text-xs font-black">ADM</span>
                    ) : isContractor ? (
                      <Briefcase className="w-4 h-4" />
                    ) : (
                      <HardHat className="w-4 h-4" />
                    )}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white truncate">
                        {u.name}
                      </h3>
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.2 rounded uppercase ${
                          isAdmin
                            ? 'bg-purple-500/20 text-purple-300'
                            : isContractor
                            ? 'bg-indigo-500/20 text-indigo-300'
                            : 'bg-emerald-500/20 text-emerald-300'
                        }`}
                      >
                        {u.role}
                      </span>
                    </div>

                    <p className="text-xs text-slate-400 font-mono">
                      {u.phone} • {isAdmin ? 'Arbitration Admin' : (u.skills?.join(', ') || (isContractor ? 'Thekedaar' : 'No Skill'))}
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => handleQuickLogin(u.phone, u.role)}
                  disabled={loginLoading === u.phone}
                  className="px-3 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-lg text-xs font-bold flex items-center gap-1 shrink-0"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  {loginLoading === u.phone ? '...' : 'Login'}
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
