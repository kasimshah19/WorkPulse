import { create } from 'zustand';
import api from '../lib/api';

export const useAuthStore = create((set, get) => ({
  user: null,
  token: null,
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

  logout: () => {
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

    const token = localStorage.getItem('token');
    const savedUser = localStorage.getItem('user');

    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      if (savedUser) {
        set({ user: JSON.parse(savedUser), token, isAuthenticated: true });
      }

      // Fetch fresh me
      const res = await api.get('/auth/me');
      if (res.data) {
        localStorage.setItem('user', JSON.stringify(res.data));
        set({ user: res.data, token, isAuthenticated: true, isLoading: false });
      }
    } catch (_err) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  },

  setLanguage: (language) => set({ language }),
}));
