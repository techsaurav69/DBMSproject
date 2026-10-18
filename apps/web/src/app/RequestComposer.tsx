import { type FormEvent, useState } from 'react';
import { ApiRequestError, api, type OperationsOverview } from '../lib/api';

type Props = { accessToken: string; incidents: OperationsOverview['incidents']; onClose: () => void; onCreated: () => void };
const categories = ['medical', 'rescue', 'evacuation', 'food', 'water', 'shelter', 'other'];
const severities = ['low', 'medium', 'high', 'critical'];
function label(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function RequestComposer({ accessToken, incidents, onClose, onCreated }: Props): React.ReactElement {
  const [incidentId, setIncidentId] = useState(incidents[0]?.id ?? '');
  const [category, setCategory] = useState('water');
  const [urgency, setUrgency] = useState('medium');
  const [description, setDescription] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setIsSaving(true); setError(null);
    try { await api.createRequest(accessToken, { incidentId, category, urgency, description, peopleCount: peopleCount ? Number(peopleCount) : undefined }); onCreated(); }
    catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The assistance request could not be saved locally.'); } finally { setIsSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><header><div><p className="panel-kicker">LOCAL ASSISTANCE REQUEST</p><h2 id="request-title">Create a request</h2></div><button type="button" aria-label="Close request form" onClick={onClose}>×</button></header><p className="modal-notice">This creates a local coordination request linked to an existing incident. Inventory, shelter, and vehicle dispatch are separate controlled workflows.</p><form className="action-form" onSubmit={submit}><label className="form-span">Linked incident<select value={incidentId} onChange={(event) => setIncidentId(event.target.value)} required>{incidents.map((incident) => <option value={incident.id} key={incident.id}>{label(incident.emergencyType)} · {incident.label ?? incident.id.slice(0, 8)} · {label(incident.severity)}</option>)}</select></label><label>Request category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value}>{label(value)}</option>)}</select></label><label>Urgency<select value={urgency} onChange={(event) => setUrgency(event.target.value)}>{severities.map((value) => <option key={value}>{label(value)}</option>)}</select></label><label className="form-span">Operational details<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required placeholder="Describe the specific assistance needed." /></label><label>People affected (optional)<input value={peopleCount} onChange={(event) => setPeopleCount(event.target.value)} type="number" min="1" step="1" /></label>{error && <p className="form-span form-error" role="alert">{error}</p>}<footer className="form-span"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="submit-button" disabled={isSaving || !incidentId}>{isSaving ? 'Saving…' : 'Create local request'}</button></footer></form></section></div>;
}
