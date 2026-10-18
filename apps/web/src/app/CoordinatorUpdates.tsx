import { useCallback, useEffect, useState } from 'react';
import { ApiRequestError, api, type CoordinatorUpdate, type CoordinatorUpdateScope } from '../lib/api';

type Props = { accessToken: string; canPost: boolean; scope: CoordinatorUpdateScope; title: string };
function time(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' }).format(new Date(value)); }

export function CoordinatorUpdates({ accessToken, canPost, scope, title }: Props): React.ReactElement {
  const [items, setItems] = useState<CoordinatorUpdate[]>([]);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const load = useCallback(async () => {
    try { setError(null); setItems((await api.coordinatorUpdates(accessToken, scope)).items); }
    catch (reason) { setError(reason instanceof ApiRequestError ? reason.message : 'Updates are unavailable right now.'); }
  }, [accessToken, scope]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 12_000); return () => window.clearInterval(timer); }, [load]);
  async function submit(event: React.FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!body.trim()) return;
    setSending(true); setError(null);
    try { await api.createCoordinatorUpdate(accessToken, scope, body); await load(); setBody(''); }
    catch (reason) { setError(reason instanceof ApiRequestError ? reason.message : 'The update could not be saved.'); }
    finally { setSending(false); }
  }

  return <section className="coordinator-updates" aria-label={`${title} coordinator updates`}><header><div><p className="panel-kicker">SHARED COORDINATOR UPDATES</p><h2>{title}</h2><p>Visible to every signed-in local participant, including citizens.</p></div><button type="button" className="quiet-button" onClick={() => void load()}>↻ Refresh</button></header><div className="coordinator-updates__feed">{items.length ? items.map((item) => <article key={item.id}><span className="coordinator-updates__avatar">C</span><div><strong>{item.authorName}</strong><time>{time(item.createdAt)}</time>{item.repeatCount > 1 && <em className="coordinator-updates__repeat">Collapsed {item.repeatCount} duplicates</em>}<p>{item.body}</p></div></article>) : <p className="coordinator-updates__empty">No coordinator update has been posted for this section.</p>}</div>{canPost ? <form onSubmit={(event) => void submit(event)}><label htmlFor={`coordinator-update-${scope}`}>Post an update for citizens and the response team</label><textarea id={`coordinator-update-${scope}`} value={body} onChange={(event) => setBody(event.target.value)} minLength={1} maxLength={1200} placeholder="Share the current status, instructions, or next action…" required /><footer><small>{body.length}/1200</small><button className="submit-button" type="submit" disabled={sending}>{sending ? 'Posting…' : 'Post update'}</button></footer></form> : <p className="coordinator-updates__view-only">Coordinator updates are read-only for your account.</p>}{error && <p className="coordinator-updates__error" role="alert">{error}</p>}</section>;
}
