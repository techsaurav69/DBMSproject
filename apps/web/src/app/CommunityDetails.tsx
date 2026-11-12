import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react';
import { api, ApiRequestError, type CommunityGroup, type CommunityMediaInput, type CommunityMessage } from '../lib/api';
import { CommunityDialog } from './CommunityDialog';
import { CommunityImage, CommunityMediaFields } from './CommunityMedia';

function messageError(reason: unknown): string { return reason instanceof ApiRequestError ? reason.message : 'This action could not be completed. Please try again.'; }
function time(value: string): string { return new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }); }

export function CommunityDetails({ group: initial, accessToken, canModerate, onClose, onUpdated, onOffer }: { group: CommunityGroup; accessToken: string; canModerate: boolean; onClose: () => void; onUpdated: () => Promise<void>; onOffer: (id: string) => void }): ReactElement {
  const [group, setGroup] = useState(initial);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [busy, setBusy] = useState(false);
  const [reason, setReason] = useState('');
  const [media, setMedia] = useState<CommunityMediaInput>({ qrCaption: initial.qrCaption });
  const [showQr, setShowQr] = useState(false);
  const [pin, setPin] = useState(initial.announcement);
  const [messages, setMessages] = useState<CommunityMessage[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [chatLoading, setChatLoading] = useState(true);
  const [chatError, setChatError] = useState('');
  const [sending, setSending] = useState(false);
  const [body, setBody] = useState('');
  const historyRef = useRef<HTMLDivElement>(null);
  const shouldScroll = useRef(true);
  const olderHeight = useRef<number | null>(null);
  const initializedChat = useRef(false);
  const member = group.status === 'approved' && group.joined;

  useEffect(() => { setGroup(initial); }, [initial]);
  const refreshMessages = useCallback(async () => {
    const result = await api.communityMessages(accessToken, group.id);
    const history = historyRef.current;
    shouldScroll.current = !history || history.scrollHeight - history.scrollTop - history.clientHeight < 80;
    setMessages((previous) => { const merged = new Map(previous.map((item) => [item.id, item])); result.items.forEach((item) => merged.set(item.id, item)); return [...merged.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id)); });
    if (!initializedChat.current) { setHasMore(result.hasMore); initializedChat.current = true; }
    setChatError('');
  }, [accessToken, group.id]);

  useEffect(() => {
    if (!member) { setMessages([]); setHasMore(false); initializedChat.current = false; setChatLoading(false); return; }
    let active = true;
    // Poll only while this member's dialog is open. Requests never overlap.
    let timer: number;
    async function tick(): Promise<void> {
      try { if (!document.hidden) await refreshMessages(); }
      catch (failure: unknown) { if (active) { setChatError(messageError(failure)); if (failure instanceof ApiRequestError && [403, 404].includes(failure.statusCode ?? 0)) setMessages([]); } }
      finally { if (active) { setChatLoading(false); timer = window.setTimeout(() => void tick(), 5000); } }
    }
    setChatLoading(true); void tick();
    return () => { active = false; window.clearTimeout(timer); };
  }, [member, refreshMessages]);

  useEffect(() => {
    const history = historyRef.current;
    if (!history) return;
    if (olderHeight.current !== null) { history.scrollTop += history.scrollHeight - olderHeight.current; olderHeight.current = null; }
    else if (shouldScroll.current) history.scrollTop = history.scrollHeight;
  }, [messages]);

  async function action(operation: () => Promise<unknown>, successText: string): Promise<void> {
    setBusy(true); setError(''); setSuccess('');
    try { await operation(); const updated = await api.communityGroup(accessToken, group.id); setGroup(updated); await onUpdated(); setSuccess(successText); }
    catch (failure: unknown) { setError(messageError(failure)); }
    finally { setBusy(false); }
  }

  async function older(): Promise<void> {
    if (!messages[0]) return;
    setChatLoading(true);
    try { const result = await api.communityMessages(accessToken, group.id, messages[0].id); olderHeight.current = historyRef.current?.scrollHeight ?? null; setMessages((previous) => [...result.items.filter((item) => !previous.some((old) => old.id === item.id)), ...previous]); setHasMore(result.hasMore); setChatError(''); }
    catch (failure: unknown) { setChatError(messageError(failure)); }
    finally { setChatLoading(false); }
  }

  async function send(): Promise<void> {
    if (!body.trim() || sending) return;
    setSending(true); setChatError('');
    try { const sent = await api.sendCommunityMessage(accessToken, group.id, body); shouldScroll.current = true; setMessages((previous) => previous.some((item) => item.id === sent.id) ? previous : [...previous, sent]); setBody(''); }
    catch (failure: unknown) { setChatError(messageError(failure)); }
    finally { setSending(false); }
  }

  return <CommunityDialog title={group.name} onClose={onClose}>
    <div className="community-detail-heading"><CommunityImage accessToken={accessToken} group={group} /><div><span className={`community-status community-status--${group.status}`}>{group.status === 'pending' ? 'Pending approval' : group.status === 'approved' ? 'Approved community' : 'Request rejected'}</span><p>⌖ {group.location || 'Location not added'} · {group.memberCount} {group.memberCount === 1 ? 'member' : 'members'}</p></div></div>
    <p className="community-detail-summary">{group.summary}</p><p className="community-detail-byline">Founded by {group.creatorName} · {time(group.createdAt)}</p>
    {error && <p className="form-error" role="alert">{error}</p>}{success && <p className="community-success" role="status">{success}</p>}
    {group.status === 'pending' && <p className="community-info">Only the requester and coordinators can see this community until it is approved.</p>}
    {group.status === 'rejected' && <p className="community-info">{group.rejectionReason ? `Reason: ${group.rejectionReason}` : 'The coordinator did not include a reason.'}</p>}
    {canModerate && group.status === 'pending' && <form className="community-review" onSubmit={(event) => { event.preventDefault(); void action(() => api.reviewCommunity(accessToken, group.id, 'approved'), 'Community approved and published.'); }}><h3>Coordinator review</h3><label>Rejection reason (optional)<textarea maxLength={500} value={reason} onChange={(event) => setReason(event.target.value)} /></label><div className="community-inline-actions"><button className="cancel-button" type="button" disabled={busy} onClick={() => void action(() => api.reviewCommunity(accessToken, group.id, 'rejected', reason), 'Community request rejected.')}>Reject request</button><button className="submit-button" disabled={busy}>{busy ? 'Saving…' : 'Approve community'}</button></div></form>}
    <div className="community-inline-actions">{group.status === 'approved' && !group.joined && <button className="submit-button" disabled={busy} onClick={() => void action(() => api.joinCommunityGroup(accessToken, group.id), 'You joined the community. Chat is now available.')}>{busy ? 'Joining…' : 'Join community'}</button>}{member && <button className="submit-button" onClick={() => onOffer(group.id)}>Offer help</button>}{group.hasQr && <button className="cancel-button" aria-expanded={showQr} onClick={() => setShowQr(!showQr)}>{showQr ? 'Hide QR' : 'View QR'}</button>}</div>
    {showQr && group.hasQr && <figure className="community-qr-view"><CommunityImage accessToken={accessToken} group={group} kind="qr" />{group.qrCaption && <figcaption>{group.qrCaption}</figcaption>}</figure>}
    {group.canManage && <details className="community-manage"><summary>Update logo and QR image</summary><form onSubmit={(event) => { event.preventDefault(); void action(async () => { await api.updateCommunityMedia(accessToken, group.id, media); setMedia({ qrCaption: media.qrCaption }); }, 'Community images saved.'); }}><CommunityMediaFields value={media} onChange={setMedia} existing={group} disabled={busy} /><button className="submit-button" disabled={busy}>{busy ? 'Saving…' : 'Save images'}</button></form></details>}
    {member ? <section className="community-chat" aria-label="Members-only community chat">
      <header><div><p className="panel-kicker">MEMBERS ONLY</p><h3>Community conversation</h3></div><small>Updates every 5 seconds</small></header>
      {group.announcement && <aside className="community-pin"><strong>⌖ Pinned announcement</strong><p>{group.announcement}</p>{group.announcementAt && <small>{time(group.announcementAt)}</small>}</aside>}
      {group.canManage && <details className="community-manage"><summary>{group.announcement ? 'Edit pinned announcement' : 'Pin an announcement'}</summary><form onSubmit={(event) => { event.preventDefault(); void action(() => api.pinCommunityAnnouncement(accessToken, group.id, pin), pin.trim() ? 'Announcement pinned.' : 'Announcement removed.'); }}><label>Important community update<textarea maxLength={1000} value={pin} onChange={(event) => setPin(event.target.value)} placeholder="Volunteer activity, meeting time, or important update" /></label><div className="community-inline-actions"><button className="submit-button" disabled={busy}>Save announcement</button>{group.announcement && <button className="cancel-button" type="button" disabled={busy} onClick={() => void action(async () => { await api.pinCommunityAnnouncement(accessToken, group.id, ''); setPin(''); }, 'Announcement removed.')}>Unpin</button>}</div></form></details>}
      <div className="community-chat__history" ref={historyRef} role="log" aria-label="Community messages" aria-live="polite" aria-busy={chatLoading}>
        {hasMore && <button className="quiet-button" disabled={chatLoading} onClick={() => void older()}>Load earlier messages</button>}
        {chatLoading && !messages.length && <p>Loading messages…</p>}{!chatLoading && !messages.length && !chatError && <p>No messages yet. Start the conversation.</p>}
        {messages.map((message) => <article className={message.mine ? 'is-mine' : ''} key={message.id}><header><strong>{message.senderName}{message.mine ? ' (you)' : ''}</strong><time dateTime={message.createdAt}>{time(message.createdAt)}</time></header><p>{message.body}</p></article>)}
      </div>
      {chatError && <p className="form-error" role="alert">{chatError} <button type="button" className="quiet-button" onClick={() => void refreshMessages().catch((failure: unknown) => setChatError(messageError(failure)))}>Retry</button></p>}
      <form className="community-chat__composer" onSubmit={(event) => { event.preventDefault(); void send(); }}><label htmlFor={`community-message-${group.id}`}>Message to members</label><textarea id={`community-message-${group.id}`} maxLength={2000} value={body} onChange={(event) => setBody(event.target.value)} placeholder="Write a message…" required /><button className="submit-button" disabled={sending || !body.trim()}>{sending ? 'Sending…' : 'Send message'}</button></form>
    </section> : group.status === 'approved' && <p className="community-info">Join this community to read and send messages. Membership is granted when you join.</p>}
  </CommunityDialog>;
}
