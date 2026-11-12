import { type FormEvent, useRef, useState } from 'react';
import { ApiRequestError, api } from '../lib/api';
import type { LiveLocation } from './useLiveLocation';

type Props = { accessToken: string; onClose: () => void; onCreated: () => void; location?: Pick<LiveLocation, 'position' | 'placeName'> };
const emergencies = ['medical_emergency', 'building_fire', 'flood', 'road_accident', 'landslide', 'other'];
const categories = ['medical', 'rescue', 'evacuation', 'food', 'water', 'shelter', 'other'];
function label(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function SosReporter({ accessToken, onClose, onCreated, location }: Props): React.ReactElement {
  const [emergencyType, setEmergencyType] = useState('medical_emergency');
  const [category, setCategory] = useState('medical');
  const [severity, setSeverity] = useState('high');
  const [locationLabel, setLocationLabel] = useState(location?.placeName?.slice(0, 180) ?? (location?.position ? 'Current device location' : ''));
  const [description, setDescription] = useState('');
  const [peopleCount, setPeopleCount] = useState('1');
  const [latitude, setLatitude] = useState(location?.position?.latitude.toFixed(6) ?? '');
  const [longitude, setLongitude] = useState(location?.position?.longitude.toFixed(6) ?? '');
  const [locationSource, setLocationSource] = useState<'gps' | 'manual'>(location?.position ? 'gps' : 'manual');
  const [locating, setLocating] = useState(false);
  const [lookingUp, setLookingUp] = useState(false);
  const [matches, setMatches] = useState<Array<{ name: string; latitude: number; longitude: number }>>([]);
  const [lookupDone, setLookupDone] = useState(false);
  const placeVersion = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  function useBrowserLocation(): void {
    if (!navigator.geolocation) { setError('Browser location is unavailable. Enter coordinates manually.'); return; }
    const version = ++placeVersion.current;
    setLocating(true); setError(null); setMatches([]); setLookupDone(false);
    navigator.geolocation.getCurrentPosition((position) => {
      if (version !== placeVersion.current) return;
      setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); setLocationLabel('Device GPS location'); setLocationSource('gps'); setLocating(false);
      void api.placeName(accessToken, position.coords.latitude, position.coords.longitude).then((place) => { if (version === placeVersion.current) setLocationLabel(place.name.slice(0, 180)); }).catch(() => {});
    }, () => { if (version === placeVersion.current) { setLocating(false); setError('Location permission was not granted. Find the place or enter coordinates manually.'); } }, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 });
  }
  async function findPlace(): Promise<void> {
    const version = ++placeVersion.current;
    setLookingUp(true); setError(null); setMatches([]); setLookupDone(false);
    try { const result = await api.searchPlaces(accessToken, locationLabel); if (version === placeVersion.current) { setMatches(result.items); setLookupDone(true); } }
    catch (reason: unknown) { if (version === placeVersion.current) setError(reason instanceof ApiRequestError ? reason.message : 'Place lookup failed. Enter the correct coordinates manually.'); }
    finally { if (version === placeVersion.current) setLookingUp(false); }
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null);
    if (!latitude.trim() || !longitude.trim() || !Number.isFinite(Number(latitude)) || !Number.isFinite(Number(longitude)) || Math.abs(Number(latitude)) > 90 || Math.abs(Number(longitude)) > 180) { setError('Choose the reported place, use GPS, or enter its valid coordinates before submitting.'); return; }
    if (locating || lookingUp) { setError('Wait for the location lookup to finish.'); return; }
    setSaving(true);
    try { await api.createSos(accessToken, { emergencyType, category, severity, locationLabel: locationLabel.trim(), description: description.trim(), peopleCount: Number(peopleCount), latitude: Number(latitude), longitude: Number(longitude), locationSource }); onCreated(); }
    catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The SOS report could not be saved locally.'); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="action-modal sos-modal" role="dialog" aria-modal="true" aria-labelledby="sos-title"><header><div><p className="panel-kicker">LOCAL SOS REPORT</p><h2 id="sos-title">Request urgent help</h2></div><button type="button" aria-label="Close SOS form" onClick={onClose}>×</button></header><p className="modal-notice"><strong>Demo workflow only.</strong> This is not connected to emergency services. For a real emergency, contact official local emergency services immediately.</p><form className="action-form" onSubmit={submit}><label>Emergency type<select value={emergencyType} onChange={(event) => setEmergencyType(event.target.value)}>{emergencies.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Help needed<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Urgency<select value={severity} onChange={(event) => setSeverity(event.target.value)}>{['medium', 'high', 'critical'].map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>People affected<input type="number" min="1" value={peopleCount} onChange={(event) => setPeopleCount(event.target.value)} required /></label><label className="form-span">Location label<input value={locationLabel} onChange={(event) => { placeVersion.current++; setLocationLabel(event.target.value); setLatitude(''); setLongitude(''); setLocationSource('manual'); setMatches([]); setLookupDone(false); setLookingUp(false); setLocating(false); }} minLength={2} maxLength={180} required placeholder="Place name, district and country" /></label><div className="coordinate-actions form-span"><span>Find and select the reported place, use GPS, or enter coordinates. Changing the place name clears the old coordinates.</span><button type="button" disabled={lookingUp || locating || saving || locationLabel.trim().length < 3} onClick={() => void findPlace()}>{lookingUp ? 'Finding…' : 'Find place'}</button><button type="button" disabled={locating || lookingUp || saving} onClick={useBrowserLocation}>{locating ? 'Locating…' : 'Use browser location'}</button></div>{matches.length > 0 && <fieldset className="sos-place-matches form-span"><legend>Select the correct location</legend>{matches.map((place, index) => <button type="button" key={index} onClick={() => { placeVersion.current++; setLatitude(place.latitude.toFixed(6)); setLongitude(place.longitude.toFixed(6)); setLocationLabel(place.name); setLocationSource('manual'); setMatches([]); setLookupDone(false); }}>{place.name}<small>{place.latitude.toFixed(4)}, {place.longitude.toFixed(4)}</small></button>)}</fieldset>}{lookupDone && matches.length === 0 && <p className="form-span" role="status">No matching place found. Include the district/country or enter coordinates manually.</p>}<label>Latitude<input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => { setLatitude(event.target.value); setLocationSource('manual'); }} required /></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => { setLongitude(event.target.value); setLocationSource('manual'); }} required /></label><label className="form-span">What happened?<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required placeholder="Share only the details that responders need to assess the request." /></label>{error && <p className="form-span form-error" role="alert">{error}</p>}<footer className="form-span"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="submit-button sos-submit" disabled={saving || locating || lookingUp}>{saving ? 'Sending…' : 'Send in-app SOS'}</button></footer></form></section></div>;
}
