import { create } from 'zustand';
import api from '../lib/api';
import { disconnectSocket } from '../lib/socket';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null, // In-memory primary storage
  isAuthenticated: false,
  isLoading: true,
  language: 'hi',

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
      localStorage.setItem('user', JSON.stringify(user));
    }
    set({ user, token, isAuthenticated: true, isLoading: false });
  },

  updateUser: (partialUser) => {
    const updated = { ...get().user, ...partialUser };
    if (typeof window !== 'undefined') {
      localStorage.setItem('user', JSON.stringify(updated));
    }
    set({ user: updated });
  },

  logout: async () => {
    try {
      await api.post('/auth/logout', {}).catch(() => {});
    } catch (_e) {}

    disconnectSocket();

    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
    }
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  initAuth: async () => {
    if (typeof window === 'undefined') {
      set({ isLoading: false });
      return;
    }

    const savedToken = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    // 1. First attempt: check if we have a valid refresh cookie or existing token
    try {
      const res = await api.post(
        '/auth/refresh',
        {},
        {
          headers: {
            'X-Requested-With': 'workpulse',
          },
        }
      );

      const payload = res.data?.data || res.data;
      const refreshedToken = payload.accessToken || payload.token;
      const user = payload.user;

      if (refreshedToken && user) {
        get().setAuth(user, refreshedToken);
        return;
      }
    } catch (_refreshErr) {
      // Refresh cookie expired or absent, proceed to check local token fallback
    }

    // 2. Fallback: check saved token in localStorage
    if (savedToken) {
      try {
        if (savedUser) {
          set({ user: JSON.parse(savedUser), token: savedToken, isAuthenticated: true });
        }

        const meRes = await api.get('/auth/me');
        if (meRes.data) {
          get().setAuth(meRes.data, savedToken);
          return;
        }
      } catch (_meErr) {
        // Token invalid or expired
      }
    }

    // No valid session found
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    set({ user: null, token: null, isAuthenticated: false, isLoading: false });
  },

  setLanguage: (language) => set({ language }),
}));
