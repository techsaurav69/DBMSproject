import { useEffect, useRef, useState } from 'react';
import { api, ApiRequestError, type NearbyService } from '../lib/api';

import type { LiveLocation } from './useLiveLocation';

type Props = { location: LiveLocation; centre: { latitude: number; longitude: number } | null; accessToken: string | null };
const categories: Record<string, string> = { hospital: 'Hospital', clinic: 'Clinic', police: 'Police station', fire_station: 'Fire station', ambulance_station: 'Ambulance station', rescue_station: 'Rescue station', disaster_response: 'Disaster response', lifeguard: 'Lifeguard' };

export function NearbyServices({ centre: mapCentre, accessToken, location }: Props): React.ReactElement {
  const [locationMode, setLocationMode] = useState('live');
  const liveCentre = location.position;
  const locationError = location.error;
  const centre = locationMode === 'live' ? liveCentre : mapCentre;
  const [radius, setRadius] = useState(5000);
  const [items, setItems] = useState<NearbyService[]>([]);
  const [status, setStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('hospital');
  const [refresh, setRefresh] = useState(0);
  const sequence = useRef(0);
  const lastSearch = useRef('');
  const coverage = useRef<{ key: string; radius: number; items: NearbyService[]; fetchedAt: string } | null>(null);
  const [fetchedAt, setFetchedAt] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  useEffect(() => {
    const requestId = ++sequence.current;
    const searchKey = `${centre?.latitude},${centre?.longitude},${radius},${filter}`;
    const changed = lastSearch.current !== searchKey;
    const locationKey = `${centre?.latitude},${centre?.longitude},${filter}`;
    const previous = coverage.current;
    const covered = previous?.key === locationKey && previous.radius >= radius;
    if (covered) { setItems(previous.items); setFetchedAt(previous.fetchedAt); setStatus('ready'); }
    else if (changed) { setItems([]); setFetchedAt(null); }
    lastSearch.current = searchKey;
    if (!centre || !accessToken) { setStatus('idle'); setRefreshing(false); return; }
    if (covered && changed) { setRefreshing(false); setError(''); return; }
    setRefreshing(true);
    setError('');
    if (!covered && (changed || !fetchedAt)) setStatus('loading');
    const queryRadius = covered ? previous.radius : radius;
    const timer = window.setTimeout(() => {
      void api.nearbyServices(accessToken, centre.latitude, centre.longitude, queryRadius, filter).then((response) => {
        if (requestId !== sequence.current) return;
        coverage.current = { key: locationKey, radius: queryRadius, items: response.items, fetchedAt: response.fetchedAt };
        setItems(response.items); setFetchedAt(response.fetchedAt); setRefreshing(false); setStatus('ready');
      }).catch((reason: unknown) => {
        if (requestId !== sequence.current) return;
        setRefreshing(false);
        setError(reason instanceof ApiRequestError ? reason.message : 'Nearby services are unavailable. Try again.'); setStatus(covered || (fetchedAt && !changed) ? 'ready' : 'error');
      });
    }, 500);
    return () => { window.clearTimeout(timer); sequence.current++; };
  }, [centre?.latitude, centre?.longitude, accessToken, radius, filter, refresh]);
  const visible = items.filter((item) => item.distanceMeters <= radius && (filter === 'all' || item.category === filter));
  return <section className="nearby-services" aria-label="Nearby rescue services">
    <header><div><p className="panel-kicker">NEARBY SUPPORT</p><h2>Nearby rescue services</h2><p>List hospitals and rescue services within the selected distance of your location.</p></div><label>Search radius<select value={radius} onChange={(event) => setRadius(Number(event.target.value))}>{[1000, 2000, 5000, 10000].map((value) => <option key={value} value={value}>{value / 1000} km</option>)}</select></label></header>
    <div className="nearby-services__filters"><label>Search from<select value={locationMode} onChange={(event) => setLocationMode(event.target.value)}><option value="live">My live location</option><option value="map">Map centre</option></select></label>{locationMode === 'live' && <button type="button" className="refresh-button" onClick={location.retry}>Locate me again</button>}</div>
    {locationError && locationMode === 'live' && <p className="form-error" role="alert">{locationError}</p>}
    {centre && <p className="nearby-services__centre">{locationMode === 'live' ? location.placeName ?? 'Your live location' : 'Map centre'}: {centre.latitude.toFixed(4)}, {centre.longitude.toFixed(4)} · Straight-line distances</p>}
    <div className="nearby-services__filters"><label>Service type<select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All services</option>{Object.entries(categories).map(([key, value]) => <option key={key} value={key}>{value}</option>)}</select></label><button type="button" className="refresh-button" disabled={refreshing || !centre} onClick={() => setRefresh((value) => value + 1)}>{refreshing ? 'Updating…' : 'Refresh now'}</button></div>
    <p className="nearby-services__message">Refresh when needed{fetchedAt ? ` · Updated ${new Date(fetchedAt).toLocaleTimeString()}` : ''}</p>
    {error && status === 'ready' && <p className="form-error">Refresh failed. Showing the last successful results. Use Refresh now to retry.</p>}
    <div aria-live="polite">{status === 'loading' && <p className="nearby-services__message">Finding services within {radius / 1000} km…</p>}{status === 'error' && <p className="form-error" role="alert">{error}</p>}{status === 'idle' && <p className="nearby-services__message">{locationMode === 'live' ? 'Waiting for your location. Allow location access when your browser asks.' : 'A map location is needed to find nearby services.'}</p>}{status === 'ready' && <><p className="nearby-services__message">{visible.length ? `${visible.length} ${filter === 'hospital' ? 'hospitals' : 'mapped services'} within ${radius / 1000} km` : `No ${filter === 'all' ? 'services' : categories[filter].toLowerCase()} mapped within ${radius / 1000} km. Try a larger radius.`}</p><div className="nearby-services__list">{visible.map((item) => <article key={item.id}><div><small>{categories[item.category] ?? 'Rescue service'}</small><h3>{item.name}</h3>{item.address && <p>{item.address}</p>}{item.phone && <p>Phone: {item.phone}</p>}</div><aside><strong>{item.distanceMeters < 1000 ? `${item.distanceMeters} m` : `${(item.distanceMeters / 1000).toFixed(1)} km`}</strong><a href={`https://www.google.com/maps/dir/?api=1&origin=${centre!.latitude},${centre!.longitude}&destination=${item.latitude},${item.longitude}`} target="_blank" rel="noreferrer">Directions ↗</a></aside></article>)}</div></>}</div>
    <footer>© OpenStreetMap contributors. Listings may be incomplete; opening hours and emergency capacity are not verified.</footer>
  </section>;
}
