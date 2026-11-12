import { useEffect, useState, type ReactElement } from 'react';
import { api, ApiRequestError, type LocalConditions } from '../lib/api';
import type { LiveLocation } from './useLiveLocation';

export function aqiCategory(value: number): string {
  if (value <= 50) return 'Good';
  if (value <= 100) return 'Moderate';
  if (value <= 150) return 'Unhealthy for sensitive groups';
  if (value <= 200) return 'Unhealthy';
  if (value <= 300) return 'Very unhealthy';
  return 'Hazardous';
}

export function LocalConditionsCards({ accessToken, location }: { accessToken: string; location: LiveLocation }): ReactElement {
  const latitude = location.position ? Number(location.position.latitude.toFixed(3)) : null;
  const longitude = location.position ? Number(location.position.longitude.toFixed(3)) : null;
  const key = latitude !== null && longitude !== null ? `${latitude},${longitude}` : '';
  const [snapshot, setSnapshot] = useState<{ key: string; data: LocalConditions } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [now, setNow] = useState(() => new Date());
  const data = snapshot?.key === key ? snapshot.data : null;
  const error = failure?.key === key ? failure.message : '';
  const zone = data?.timezone ?? undefined;

  useEffect(() => { const timer = window.setInterval(() => setNow(new Date()), 30000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    if (latitude === null || longitude === null) { setLoading(false); return; }
    let active = true;
    let timer: number;
    async function refresh(): Promise<void> {
      if (document.hidden) { timer = window.setTimeout(() => void refresh(), 60000); return; }
      setLoading(true);
      try { const result = await api.localConditions(accessToken, latitude!, longitude!); if (active) { setSnapshot({ key, data: result }); setFailure(null); } }
      catch (reason: unknown) { if (active) setFailure({ key, message: reason instanceof ApiRequestError ? reason.message : 'Local conditions could not be loaded. Please refresh.' }); }
      finally { if (active) { setLoading(false); timer = window.setTimeout(() => void refresh(), 60000); } }
    }
    void refresh();
    return () => { active = false; window.clearTimeout(timer); };
  }, [accessToken, latitude, longitude, key, attempt]);

  const unavailable = !key ? location.error ? 'Location unavailable' : 'Waiting for location' : loading && !data ? 'Loading current data…' : 'Temporarily unavailable';
  function sourceTime(value: string | undefined): string | undefined {
    if (!value) return undefined;
    return `Data: ${new Intl.DateTimeFormat(undefined, { timeZone: zone, month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(new Date(value))}`;
  }
  const weather = data?.weather;
  const air = data?.airQuality;
  const weatherOld = weather ? now.getTime() - new Date(weather.time).getTime() > 3600000 : false;
  const airOld = air ? now.getTime() - new Date(air.time).getTime() > 10800000 : false;
  const day = new Intl.DateTimeFormat(undefined, { timeZone: zone, weekday: 'long' }).format(now);
  const date = new Intl.DateTimeFormat(undefined, { timeZone: zone, day: 'numeric', month: 'short', year: 'numeric' }).format(now);

  return <section className="local-conditions" aria-label="Live location weather and air quality">
    <div className="command-telemetry command-telemetry--conditions" aria-busy={loading}>
      <ConditionCard tone={air && air.usAqi > 100 ? 'critical' : air && air.usAqi > 50 ? 'queue' : 'fleet'} label="Air quality · US AQI" value={air ? String(Math.round(air.usAqi)) : '—'} detail={air ? aqiCategory(Math.round(air.usAqi)) : unavailable} timestamp={sourceTime(air?.time)} stale={Boolean(error && air) || airOld} />
      <ConditionCard tone="weather" label="Humidity" value={weather ? `${Math.round(weather.humidityPercent)}%` : '—'} detail={weather ? 'Relative humidity' : unavailable} timestamp={sourceTime(weather?.time)} stale={Boolean(error && weather) || weatherOld} />
      <ConditionCard tone="queue" label="Temperature" value={weather ? `${weather.temperatureC.toFixed(1)}°C` : '—'} detail={weather ? weather.isDay === null ? 'Current temperature' : weather.isDay ? 'Daytime conditions' : 'Nighttime conditions' : unavailable} timestamp={sourceTime(weather?.time)} stale={Boolean(error && weather) || weatherOld} />
      <ConditionCard tone="seismic" label="Day & date" value={day} detail={date} timestamp={zone ?? 'Device timezone'} />
    </div>
    <div className="local-conditions__footer"><span>⌖ {location.placeName ?? (key ? 'Your live location' : 'Waiting for your location')} · <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo</a> / <a href="https://atmosphere.copernicus.eu/" target="_blank" rel="noreferrer">CAMS</a> model estimates · 60s refresh</span><button className="quiet-button" type="button" disabled={loading} onClick={() => key ? setAttempt((value) => value + 1) : location.retry()}>{loading ? 'Updating…' : key ? '↻ Refresh conditions' : 'Locate me'}</button></div>
    {(error || (!key && location.error)) && <p className="local-conditions__error" role="status">{error || location.error}{data && error ? ' Showing last known values with their original timestamps.' : ''}</p>}
    {data && (!weather || !air) && <p className="local-conditions__error" role="status">{!weather ? 'Temperature and humidity are' : 'AQI is'} temporarily unavailable. Available conditions continue to update.</p>}
  </section>;
}

function ConditionCard({ label, value, detail, tone, timestamp, stale = false }: { label: string; value: string; detail: string; tone: string; timestamp?: string; stale?: boolean }): ReactElement {
  return <article className={`command-telemetry__metric command-telemetry__metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small>{timestamp && <small className={stale ? 'local-conditions__stale' : 'local-conditions__time'}>{stale ? 'Last known · ' : ''}{timestamp}</small>}</article>;
}
