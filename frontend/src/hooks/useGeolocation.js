'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/**
 * useGeolocation hook
 * Real-time GPS tracking using navigator.geolocation.watchPosition
 * Returns { lat, lng, accuracy, error, loading, refresh, clearError }
 */
export function useGeolocation(options = {}) {
  const [coords, setCoords] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const watchIdRef = useRef(null);

  const startWatching = useCallback(() => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('आपके डिवाइस में GPS / लोकेशन सपोर्ट नहीं है (Geolocation not supported).');
      setLoading(false);
      return;
    }

    setLoading(true);

    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
    }

    const geoOptions = {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 0,
      ...options,
    };

    const handleSuccess = (position) => {
      const { latitude, longitude, accuracy } = position.coords;
      setCoords({
        lat: latitude,
        lng: longitude,
        accuracy: Math.round(accuracy),
      });
      setError(null);
      setLoading(false);
    };

    const handleError = (err) => {
      setLoading(false);
      switch (err.code) {
        case 1: // PERMISSION_DENIED
          setError(
            'लोकेशन की अनुमति नहीं मिली (Location permission denied). कृपया ब्राउज़र सेटिंग्स में जाकर लोकेशन चालू करें (Settings kholein).'
          );
          break;
        case 2: // POSITION_UNAVAILABLE
          setError(
            'GPS सिग्नल नहीं मिल रहा (Location unavailable). कृपया खुले स्थान पर जाएँ या GPS ऑन करें।'
          );
          break;
        case 3: // TIMEOUT
          setError(
            'लोकेशन खोजने में समय समाप्त हो गया (GPS timeout). कृपया दोबारा कोशिश करें।'
          );
          break;
        default:
          setError(`लोकेशन त्रुटि: ${err.message || 'अज्ञात त्रुटि'}`);
      }
    };

    watchIdRef.current = navigator.geolocation.watchPosition(
      handleSuccess,
      handleError,
      geoOptions
    );
  }, [options]);

  useEffect(() => {
    startWatching();
    return () => {
      if (watchIdRef.current !== null && typeof window !== 'undefined' && navigator.geolocation) {
        navigator.geolocation.clearWatch(watchIdRef.current);
      }
    };
  }, [startWatching]);

  return {
    lat: coords?.lat ?? null,
    lng: coords?.lng ?? null,
    accuracy: coords?.accuracy ?? null,
    location: coords
      ? {
          latitude: coords.lat,
          longitude: coords.lng,
          accuracy: coords.accuracy,
        }
      : null,
    error,
    loading,
    refresh: startWatching,
    clearError: () => setError(null),
  };
}
