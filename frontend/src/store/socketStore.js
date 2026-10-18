import { create } from 'zustand';

export const useSocketStore = create((set) => ({
  isConnected: false,
  activeAlert: null, // { jobId, title, skillRequired, wagePerDayPaise, distanceMeters }

  setConnected: (isConnected) => set({ isConnected }),

  triggerJobAlert: (alertData) => {
    // Vibrate device if supported
    if (typeof window !== 'undefined' && window.navigator && window.navigator.vibrate) {
      try {
        window.navigator.vibrate([200, 100, 200]);
      } catch (_e) {}
    }
    set({ activeAlert: alertData });
  },

  dismissAlert: () => set({ activeAlert: null }),
}));
