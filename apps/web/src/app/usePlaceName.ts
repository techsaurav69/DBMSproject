import { useEffect, useState } from 'react';
import { api } from '../lib/api';

export function usePlaceName(position: { latitude: number; longitude: number } | null, accessToken: string): string | null {
  const latitude = position ? Number(position.latitude.toFixed(3)) : null;
  const longitude = position ? Number(position.longitude.toFixed(3)) : null;
  const [result, setResult] = useState<{ key: string; name: string } | null>(null);
  const key = `${latitude},${longitude}`;
  useEffect(() => {
    if (latitude === null || longitude === null) return;
    let active = true;
    const timer = window.setTimeout(() => {
      void api.placeName(accessToken, latitude, longitude).then((response) => { if (active) setResult({ key: `${latitude},${longitude}`, name: response.name }); }).catch(() => { if (active) setResult(null); });
    }, 1000);
    return () => { active = false; window.clearTimeout(timer); };
  }, [latitude, longitude, accessToken]);
  return result?.key === key ? result.name : null;
}
