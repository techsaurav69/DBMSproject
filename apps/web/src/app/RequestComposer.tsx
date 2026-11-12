import { type FormEvent, useId, useState } from 'react';
import { ApiRequestError, api, type OperationsOverview } from '../lib/api';

type Props = { accessToken: string; incidents: OperationsOverview['incidents']; onClose: () => void; onCreated: () => void };
const categories = ['medical', 'rescue', 'evacuation', 'food', 'water', 'shelter', 'other'];
const severities = ['low', 'medium', 'high', 'critical'];
function label(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function RequestComposer({ accessToken, incidents, onClose, onCreated }: Props): React.ReactElement {
  const suggestionsId = useId();
  function incidentText(incident: Props['incidents'][number]): string {
    const text = `${label(incident.emergencyType)} · ${incident.label ?? 'Location pending'} · ${label(incident.severity)}`;
    const duplicate = incidents.some((other) => other.id !== incident.id && other.emergencyType === incident.emergencyType && other.label === incident.label && other.severity === incident.severity);
    return duplicate ? `${text} · ${incident.id.slice(0, 8)}` : text;
  }
  const [incidentId, setIncidentId] = useState(incidents[0]?.id ?? '');
  const [incidentQuery, setIncidentQuery] = useState(incidents[0] ? incidentText(incidents[0]) : '');
  const [category, setCategory] = useState('water');
  const [urgency, setUrgency] = useState('medium');
  const [description, setDescription] = useState('');
  const [peopleCount, setPeopleCount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault(); setError(null);
    if (!incidents.some((incident) => incident.id === incidentId && incidentText(incident) === incidentQuery)) { setError('Choose an existing incident from the suggestions to link this request.'); return; }
    setIsSaving(true);
    try { await api.createRequest(accessToken, { incidentId, category, urgency, description, peopleCount: peopleCount ? Number(peopleCount) : undefined }); onCreated(); }
    catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The assistance request could not be saved locally.'); } finally { setIsSaving(false); }
  }
  return <div className="modal-backdrop" role="presentation"><section className="action-modal" role="dialog" aria-modal="true" aria-labelledby="request-title"><header><div><p className="panel-kicker">LOCAL ASSISTANCE REQUEST</p><h2 id="request-title">Create a request</h2></div><button type="button" aria-label="Close request form" onClick={onClose}>×</button></header><p className="modal-notice">This creates a local coordination request linked to an existing incident. Inventory, shelter, and vehicle dispatch are separate controlled workflows.</p><form className="action-form" onSubmit={submit}><label className="form-span">Linked incident<input aria-label="Linked incident" list={suggestionsId} value={incidentQuery} placeholder="Type an incident name or location…" autoComplete="off" onChange={(event) => { const text = event.target.value; setIncidentQuery(text); setIncidentId(incidents.find((incident) => incidentText(incident) === text)?.id ?? ''); setError(null); }} aria-describedby={suggestionsId + '-hint'} required /><datalist id={suggestionsId}>{incidents.map((incident) => <option value={incidentText(incident)} key={incident.id} />)}</datalist><small id={suggestionsId + '-hint'}>Type to search, then choose an existing incident from the suggestions.</small></label><label>Request category<select value={category} onChange={(event) => setCategory(event.target.value)}>{categories.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label>Urgency<select value={urgency} onChange={(event) => setUrgency(event.target.value)}>{severities.map((value) => <option key={value} value={value}>{label(value)}</option>)}</select></label><label className="form-span">Operational details<textarea value={description} onChange={(event) => setDescription(event.target.value)} minLength={10} maxLength={4000} required placeholder="Describe the specific assistance needed." /></label><label>People affected (optional)<input value={peopleCount} onChange={(event) => setPeopleCount(event.target.value)} type="number" min="1" step="1" /></label>{error && <p className="form-span form-error" role="alert">{error}</p>}<footer className="form-span"><button type="button" className="cancel-button" onClick={onClose}>Cancel</button><button type="submit" className="submit-button" disabled={isSaving || !incidentId}>{isSaving ? 'Saving…' : 'Create local request'}</button></footer></form></section></div>;
}
