import { type FormEvent, useState } from 'react';
import { ApiRequestError, api, type OperationsOverview } from '../lib/api';

type Props = { accessToken: string; onClose: () => void; onCreated: (incident: OperationsOverview['incidents'][number]) => void };
const emergencyTypes = ['flood', 'earthquake', 'cyclone', 'landslide', 'wildfire', 'building_fire', 'road_accident', 'medical_emergency', 'other'];
const severities = ['low', 'medium', 'high', 'critical'];

function label(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function IncidentReporter({ accessToken, onClose, onCreated }: Props): React.ReactElement {
  const [description, setDescription] = useState('');
  const [emergencyType, setEmergencyType] = useState('flood');
  const [severity, setSeverity] = useState('medium');
  const [locationLabel, setLocationLabel] = useState('Local report location');
  const [latitude, setLatitude] = useState('12.9200');
  const [longitude, setLongitude] = useState('77.5800');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLocating, setIsLocating] = useState(false);

  function useMyLocation(): void {
    if (!navigator.geolocation) { setError('This browser does not provide location access. Enter coordinates manually.'); return; }
    setIsLocating(true); setError(null);
    navigator.geolocation.getCurrentPosition(
      (position) => { setLatitude(position.coords.latitude.toFixed(6)); setLongitude(position.coords.longitude.toFixed(6)); setLocationLabel('Browser-provided location'); setIsLocating(false); },
      () => { setError('Location permission was unavailable. Enter coordinates manually.'); setIsLocating(false); },
      { enableHighAccuracy: false, timeout: 10_000, maximumAge: 60_000 },
    );
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null); setIsSaving(true);
    try {
      const incident = await api.createIncident(accessToken, { description, emergencyType, severity, locationLabel, latitude: Number(latitude), longitude: Number(longitude) });
      onCreated(incident);
    } catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The incident could not be saved locally.'); } finally { setIsSaving(false); }
  }

  return <div className="modal-backdrop" role="presentation"><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="report-title"><header><div><p className="panel-kicker">LOCAL INCIDENT REPORT</p><h2 id="report-title">Create an incident</h2></div><button type="button" aria-label="Close report form" onClick={onClose}>×</button></header><p className="modal-notice">This stores a local coordination report only. It does not contact emergency services or verify that an emergency has occurred.</p><form onSubmit={submit} className="action-form"><label>Incident type<select value={emergencyType} onChange={(event) => setEmergencyType(event.target.value)}>{emergencyTypes.map((type) => <option key={type} value={type}>{label(type)}</option>)}</select></label><label>Severity<select value={severity} onChange={(event) => setSeverity(event.target.value)}>{severities.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label className="form-span">What is happening?<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required placeholder="Give useful operational details without private medical diagnoses." /></label><label className="form-span">Location label<input value={locationLabel} onChange={(event) => setLocationLabel(event.target.value)} minLength={2} maxLength={180} required /></label><div className="coordinate-actions form-span"><span>Coordinates are validated by PostGIS.</span><button type="button" onClick={useMyLocation} disabled={isLocating}>{isLocating ? 'Locating…' : 'Use my browser location'}</button></div><label>Latitude<input value={latitude} onChange={(event) => setLatitude(event.target.value)} type="number" min="-90" max="90" step="any" required /></label><label>Longitude<input value={longitude} onChange={(event) => setLongitude(event.target.value)} type="number" min="-180" max="180" step="any" required /></label>{error && <p className="form-span form-error" role="alert">{error}</p>}<footer className="form-span"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button className="submit-button" type="submit" disabled={isSaving}>{isSaving ? 'Saving…' : 'Save local report'}</button></footer></form></section></div>;
}
