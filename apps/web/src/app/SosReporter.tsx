import { type FormEvent, useState } from 'react';
import { ApiRequestError, api } from '../lib/api';

type Props = { accessToken: string; onClose: () => void; onCreated: () => void };
const emergencies = ['medical_emergency', 'building_fire', 'flood', 'road_accident', 'landslide', 'other'];
const categories = ['medical', 'rescue', 'evacuation', 'food', 'water', 'shelter', 'other'];
function label(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function SosReporter({ accessToken, onClose, onCreated }: Props): React.ReactElement {
  const [emergencyType, setEmergencyType] = useState('medical_emergency');
  const [category, setCategory] = useState('medical');
  const [severity, setSeverity] = useState('high');
  const [locationLabel, setLocationLabel] = useState('');
  const [description, setDescription] = useState('');
  const [peopleCount, setPeopleCount] = useState('1');
  const [latitude, setLatitude] = useState('12.9200');
  const [longitude, setLongitude] = useState('77.5800');
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  function useBrowserLocation(): void {
    if (!navigator.geolocation) { setError('Browser location is unavailable. Enter coordinates manually.'); return; }
    navigator.geolocation.getCurrentPosition((position) => { setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); setError(null); }, () => setError('Location permission was not granted. Enter coordinates manually.'));
  }
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setSaving(true); setError(null);
    try { await api.createSos(accessToken, { emergencyType, category, severity, locationLabel, description, peopleCount: Number(peopleCount), latitude: Number(latitude), longitude: Number(longitude) }); onCreated(); }
    catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The SOS report could not be saved locally.'); } finally { setSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="action-modal sos-modal" role="dialog" aria-modal="true" aria-labelledby="sos-title"><header><div><p className="panel-kicker">LOCAL SOS REPORT</p><h2 id="sos-title">Request urgent help</h2></div><button type="button" aria-label="Close SOS form" onClick={onClose}>×</button></header><p className="modal-notice"><strong>Demo workflow only.</strong> This is not connected to emergency services. For a real emergency, contact official local emergency services immediately.</p><form className="action-form" onSubmit={submit}><label>Emergency type<select value={emergencyType} onChange={(event) => setEmergencyType(event.target.value)}>{emergencies.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Help needed<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Urgency<select value={severity} onChange={(event) => setSeverity(event.target.value)}>{['medium', 'high', 'critical'].map((value) => <option key={value}>{label(value)}</option>)}</select></label><label>People affected<input type="number" min="1" value={peopleCount} onChange={(event) => setPeopleCount(event.target.value)} required /></label><label className="form-span">Location label<input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} minLength={2} maxLength={180} required placeholder="e.g. Northbank bridge access road" /></label><div className="coordinate-actions form-span"><span>Use your browser location only if this is safe and appropriate.</span><button type="button" onClick={useBrowserLocation}>Use browser location</button></div><label>Latitude<input type="number" min="-90" max="90" step="any" value={latitude} onChange={(event) => setLatitude(event.target.value)} required /></label><label>Longitude<input type="number" min="-180" max="180" step="any" value={longitude} onChange={(event) => setLongitude(event.target.value)} required /></label><label className="form-span">What happened?<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required placeholder="Share only the details that responders need to assess the request." /></label>{error && <p className="form-span form-error" role="alert">{error}</p>}<footer className="form-span"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="submit-button sos-submit" disabled={saving}>{saving ? 'Sending…' : 'Create local SOS request'}</button></footer></form></section></div>;
}
