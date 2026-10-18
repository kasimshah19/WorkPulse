import { useAuthStore } from '../store/authStore';

/**
 * useAuth hook wrapper around authStore.
 * TODO Phase 1: Implement auto-refresh token and session check on mount.
 */
export function useAuth() {
  const { user, token, isAuthenticated, setAuth, logout, language, setLanguage } =
    useAuthStore();

  return {
    user,
    token,
    isAuthenticated,
    setAuth,
    logout,
    language,
    setLanguage,
  };
}
