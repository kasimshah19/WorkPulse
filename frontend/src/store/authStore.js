import { create } from 'zustand';

/**
 * Global authentication state store.
 * TODO Phase 1: Integrate OTP flow, persistent session handling, and role switching.
 */
export const useAuthStore = create((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  language: 'hi', // default to Hindi for worker accessibility

  setAuth: (user, token) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('token', token);
    }
    set({ user, token, isAuthenticated: true });
  },

  logout: () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem('token');
    }
    set({ user: null, token: null, isAuthenticated: false });
  },

  setLanguage: (language) => set({ language }),
}));
