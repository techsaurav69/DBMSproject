import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { ApiRequestError, api, type GlobalChatMessage } from '../lib/api';

type Props = { accessToken: string };
function time(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

export function GlobalChat({ accessToken }: Props): React.ReactElement {
  const [items, setItems] = useState<GlobalChatMessage[]>([]);
  const [open, setOpen] = useState(false);
  const [body, setBody] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [unseen, setUnseen] = useState(0);
  const initialLoad = useRef(true);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const load = useCallback(async () => {
    try {
      const response = await api.globalChatMessages(accessToken);
      setItems((current) => {
        if (!initialLoad.current && !open) setUnseen((count) => count + response.items.filter((item) => !current.some((known) => known.id === item.id) && !item.mine).length);
        initialLoad.current = false;
        return response.items;
      });
    } catch { setError('Chat is temporarily unavailable. Local operations remain available.'); }
  }, [accessToken, open]);
  useEffect(() => { void load(); const timer = window.setInterval(() => void load(), 3_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => { function close(event: MouseEvent): void { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); } document.addEventListener('mousedown', close); return () => document.removeEventListener('mousedown', close); }, []);
  useEffect(() => { if (open) { setUnseen(0); listRef.current?.scrollTo({ top: listRef.current.scrollHeight }); } }, [open, items]);
  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> { event.preventDefault(); if (!body.trim()) return; setSending(true); setError(null); try { const message = await api.createGlobalChatMessage(accessToken, body); setItems((current) => [...current, message]); setBody(''); } catch (reason) { setError(reason instanceof ApiRequestError ? reason.message : 'Message could not be sent.'); } finally { setSending(false); } }
  return <div className="global-chat" ref={rootRef}><button type="button" className="global-chat__trigger" aria-expanded={open} onClick={() => { setOpen((value) => !value); setUnseen(0); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 15a4 4 0 0 1-4 4H8l-4 3v-7a4 4 0 0 1-1-2.65V7a4 4 0 0 1 4-4h9a4 4 0 0 1 4 4z" /><path d="M8 10h.01M12 10h.01M16 10h.01" /></svg><span>Live chat</span>{unseen > 0 && <b>{unseen > 9 ? '9+' : unseen}</b>}</button>{open && <section className="global-chat__panel" aria-label="Global local coordination chat"><header><div><p className="panel-kicker">SHARED COORDINATION ROOM</p><h2>Global live chat</h2><small><i />Syncing every 3 seconds</small></div><button type="button" aria-label="Close global chat" onClick={() => setOpen(false)}>×</button></header><p className="global-chat__notice">For local demo coordination only. Do not use this chat to request real emergency assistance.</p><div className="global-chat__messages" ref={listRef}>{items.length ? items.map((message) => <article key={message.id} className={message.mine ? 'is-mine' : ''}><strong>{message.authorName}</strong><small>{message.roleLabel} · {time(message.createdAt)}</small><p>{message.body}</p></article>) : <p className="global-chat__empty">No messages yet. Start the local coordination conversation.</p>}</div><form onSubmit={submit}><textarea value={body} onChange={(event) => setBody(event.target.value)} maxLength={1000} placeholder="Share a local operational update…" aria-label="Global chat message" /><footer><small>{body.length}/1000</small><button type="submit" className="submit-button" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send'}</button></footer></form>{error && <p className="form-error">{error}</p>}</section>}</div>;
}
