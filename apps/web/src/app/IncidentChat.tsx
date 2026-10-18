import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, api, type IncidentMessage, type OperationsOverview } from '../lib/api';

type Props = { accessToken: string; incident: OperationsOverview['incidents'][number]; onClose: () => void };
function time(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

export function IncidentChat({ accessToken, incident, onClose }: Props): React.ReactElement {
  const [items, setItems] = useState<IncidentMessage[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => { try { const response = await api.incidentMessages(accessToken, incident.id); setItems(response.items); } catch (reason) { setError(reason instanceof ApiRequestError ? reason.message : 'Unable to load coordination messages.'); } }, [accessToken, incident.id]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 10_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); }, [items]);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); if (!body.trim()) return; setSending(true); setError(null); try { const message = await api.createIncidentMessage(accessToken, incident.id, body); setItems((current) => [...current, message]); setBody(''); } catch (reason) { setError(reason instanceof ApiRequestError ? reason.message : 'Message could not be sent.'); } finally { setSending(false); } }
  return <div className="modal-backdrop" role="presentation"><section className="action-modal incident-chat" role="dialog" aria-modal="true" aria-labelledby="chat-title"><header><div><p className="panel-kicker">LOCAL COORDINATION ROOM</p><h2 id="chat-title">{incident.label ?? 'Incident'} updates</h2><small>{incident.emergencyType.replaceAll('_', ' ')} · {incident.severity}</small></div><button type="button" aria-label="Close coordination chat" onClick={onClose}>×</button></header><p className="modal-notice">Shared local workspace. Messages refresh every 10 seconds and are recorded in the incident audit trail.</p><div className="chat-list" ref={listRef}>{items.length ? items.map((message) => <article key={message.id} className={message.mine ? 'is-mine' : ''}><strong>{message.authorName}</strong><p>{message.body}</p><time>{time(message.createdAt)}</time></article>) : <p className="chat-empty">No updates yet. Start the local coordination conversation.</p>}</div><form className="chat-form" onSubmit={submit}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={2000} placeholder="Share an operational update…" aria-label="Coordination message" />{error && <p className="form-error" role="alert">{error}</p>}<footer><small>{body.length}/2000</small><button className="submit-button" type="submit" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send update'}</button></footer></form></section></div>;
}
