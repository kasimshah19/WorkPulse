'use client';

import React, { useState, useEffect } from 'react';
import { WifiOff } from 'lucide-react';

export function OfflineBanner() {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const handleOnline = () => setIsOffline(false);
    const handleOffline = () => setIsOffline(true);

    setIsOffline(!navigator.onLine);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!isOffline) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="bg-amber-600 text-white px-3 py-2 text-xs font-semibold flex items-center justify-center gap-2 sticky top-0 z-50 shadow-md"
    >
      <WifiOff className="w-4 h-4 shrink-0 animate-pulse" />
      <span>
        आप ऑफ़लाइन हैं (No Internet). हाज़िरी और पैसे से जुड़े काम ऑनलाइन होने पर ही चलेंगे।
      </span>
    </div>
  );
}
