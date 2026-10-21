'use client';

import { useAuthStore } from '../store/authStore';
import hi from '../i18n/hi.json';
import mr from '../i18n/mr.json';
import en from '../i18n/en.json';

const DICTIONARIES = { hi, mr, en };

/**
 * Lightweight translation hook accessing hi, mr, and en dictionaries
 */
export function useTranslation() {
  const language = useAuthStore((state) => state.language || 'hi');
  const setLanguage = useAuthStore((state) => state.setLanguage);

  const t = (key) => {
    const dict = DICTIONARIES[language] || DICTIONARIES.hi;
    return dict[key] || DICTIONARIES.hi[key] || DICTIONARIES.en[key] || key;
  };

  return { t, language, setLanguage };
}

export default useTranslation;
