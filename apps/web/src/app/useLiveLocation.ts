import { useCallback, useEffect, useState } from 'react';

export type LiveLocation = { position: { latitude: number; longitude: number } | null; placeName?: string | null; error: string; retry: () => void };

export function useLiveLocation(): LiveLocation {
  const [position, setPosition] = useState<LiveLocation['position']>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    setError('');
    if (!navigator.geolocation) { setError('Location is unavailable in this browser.'); return; }
    const watch = navigator.geolocation.watchPosition((value) => {
      const latitude = Number(value.coords.latitude.toFixed(4));
      const longitude = Number(value.coords.longitude.toFixed(4));
      setPosition((current) => current?.latitude === latitude && current?.longitude === longitude ? current : { latitude, longitude });
      setError('');
    }, (reason) => {
      setPosition(null);
      setError(reason.code === 1 ? 'Allow location access in your browser to show your live location.' : 'Device location is unavailable. Please try locating again.');
    }, { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 });
    return () => navigator.geolocation.clearWatch(watch);
  }, [attempt]);
  return { position, error, retry };
}
