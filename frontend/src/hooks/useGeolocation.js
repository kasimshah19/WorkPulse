import { useState, useEffect } from 'react';

/**
 * useGeolocation hook stub.
 * Tracks user GPS coordinates for radius matching and proof-of-work geofencing.
 *
 * TODO Phase 4: Add high-accuracy GPS polling, accuracy threshold, and error recovery.
 */
export function useGeolocation() {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getCurrentLocation = () => {
    if (typeof window === 'undefined' || !navigator.geolocation) {
      setError('Geolocation not supported');
      return;
    }

    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
        });
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    // Initial fetch on mount
    getCurrentLocation();
  }, []);

  return { location, error, loading, refresh: getCurrentLocation };
}
