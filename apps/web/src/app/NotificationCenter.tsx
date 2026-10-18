import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type NotificationItem } from '../lib/api';

type Props = { accessToken: string; refreshKey: number };

function timeLabel(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

export function NotificationCenter({ accessToken, refreshKey }: Props): React.ReactElement {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [open, setOpen] = useState(false);
  const [newSinceLastCheck, setNewSinceLastCheck] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const unreadCount = items.filter((item) => !item.read).length;

  const load = useCallback(async (): Promise<void> => {
    try {
      const result = await api.notifications(accessToken);
      setItems((current) => {
        if (current.length && result.items.some((item) => !item.read && !current.some((existing) => existing.id === item.id))) setNewSinceLastCheck(true);
        return result.items;
      });
    } catch { /* The command workspace remains usable if notifications cannot load. */ }
  }, [accessToken]);
  useEffect(() => { void load(); }, [load, refreshKey]);
  useEffect(() => { const timer = window.setInterval(() => void load(), 15_000); return () => window.clearInterval(timer); }, [load]);
  useEffect(() => {
    function close(event: MouseEvent): void { if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false); }
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  async function markRead(id: string): Promise<void> {
    await api.markNotificationRead(accessToken, id);
    setItems((current) => current.map((item) => item.id === id ? { ...item, read: true } : item));
  }
  async function markAllRead(): Promise<void> {
    await api.markAllNotificationsRead(accessToken);
    setItems((current) => current.map((item) => ({ ...item, read: true })));
  }

  return <div className="notification-center" ref={rootRef}><button type="button" className="notification-trigger" aria-expanded={open} aria-label="Open local notifications" onClick={() => { setOpen((value) => !value); setNewSinceLastCheck(false); }}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 9a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4" /></svg>{unreadCount > 0 && <b>{unreadCount > 9 ? '9+' : unreadCount}</b>}</button>{newSinceLastCheck && !open && <span className="notification-live">New update</span>}{open && <section className="notification-popover" aria-label="Local operational notifications"><header><div><p className="panel-kicker">IN-APP UPDATES · 15S CHECK</p><h2>Coordination notifications</h2></div>{unreadCount > 0 && <button type="button" onClick={() => void markAllRead()}>Mark all read</button>}</header><p className="notification-note">Shared local workflow updates. Not an emergency-alert channel.</p><div className="notification-list">{items.length ? items.map((item) => <button key={item.id} type="button" className={item.read ? 'is-read' : ''} onClick={() => void markRead(item.id)}><i className={`notification-icon notification-icon--${item.kind}`}>{item.kind === 'sos' ? 'SOS' : item.kind === 'request' ? '!' : item.kind === 'assignment' ? '↗' : '▣'}</i><span><strong>{item.title}</strong><small>{item.message}</small><time>{timeLabel(item.timestamp)} · {item.read ? 'Read' : 'Mark read'}</time></span></button>) : <p className="notification-empty">You are all caught up. No local operational reminders need review.</p>}</div></section>}</div>;
}
