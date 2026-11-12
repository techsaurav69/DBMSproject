import { type FormEvent, type ReactElement, useCallback, useEffect, useMemo, useState } from 'react';
import { ApiRequestError, api, type CommunityMediaInput, type CommunityOverview } from '../lib/api';
import { CommunityDialog } from './CommunityDialog';
import { CommunityDetails } from './CommunityDetails';
import { CommunityImage, CommunityMediaFields } from './CommunityMedia';

type Props = { accessToken: string };

const focusAreas = [
  ['food', 'Food & essentials'],
  ['medical', 'Medical support'],
  ['shelter', 'Shelter & care'],
  ['transport', 'Transport'],
  ['rescue', 'Rescue support'],
  ['community_support', 'Community support'],
  ['other', 'Other'],
] as const;

const contributionKinds = [
  ['volunteer_time', 'Volunteer time'],
  ['supplies', 'Supplies'],
  ['transport', 'Transport'],
  ['money_pledge', 'Donation pledge'],
  ['other', 'Other support'],
] as const;

function labelFor(value: string, options: readonly (readonly [string, string])[]): string {
  return options.find(([key]) => key === value)?.[1] ?? value.replaceAll('_', ' ');
}

function formatTime(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(value));
}

export function CommunityAid({ accessToken }: Props): ReactElement {
  const [overview, setOverview] = useState<CommunityOverview>({ groups: [], pledges: [], canModerate: false });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [groupName, setGroupName] = useState('');
  const [focusArea, setFocusArea] = useState('community_support');
  const [groupSummary, setGroupSummary] = useState('');
  const [location, setLocation] = useState('');
  const [media, setMedia] = useState<CommunityMediaInput>({});
  const [detailId, setDetailId] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [success, setSuccess] = useState('');
  const [contributionKind, setContributionKind] = useState('volunteer_time');
  const [quantity, setQuantity] = useState('1');
  const [unitLabel, setUnitLabel] = useState('hours');
  const [pledgeDetails, setPledgeDetails] = useState('');

  const selectedGroup = useMemo(() => overview.groups.find((group) => group.id === selectedGroupId) ?? null, [overview.groups, selectedGroupId]);
  const detailGroup = overview.groups.find((group) => group.id === detailId);
  const approvedGroups = overview.groups.filter((group) => group.status === 'approved');
  const privateGroups = overview.groups.filter((group) => group.status !== 'approved');
  const load = useCallback(async () => {
    try { setError(null); setOverview(await api.communityOverview(accessToken)); }
    catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'Community aid could not be loaded.'); }
    finally { setLoading(false); }
  }, [accessToken]);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), 45_000);
    return () => window.clearInterval(timer);
  }, [load]);

  async function createGroup(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setBusy(true); setError(null);
    try {
      const group = await api.createCommunityGroup(accessToken, { name: groupName, focusArea, summary: groupSummary, location, ...media });
      setGroupName(''); setGroupSummary(''); setLocation(''); setMedia({}); setShowGroupForm(false); setDetailId(group.id); setSuccess('Community submitted for coordinator approval.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The community could not be created.'); }
    finally { setBusy(false); }
  }

  async function joinGroup(groupId: string): Promise<void> {
    setBusy(true); setError(null);
    try { await api.joinCommunityGroup(accessToken, groupId); await load(); setDetailId(groupId); setSuccess('You joined the community.'); }
    catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The community could not be joined.'); }
    finally { setBusy(false); }
  }

  async function createPledge(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    if (!selectedGroupId) return;
    setBusy(true); setError(null);
    try {
      await api.createCommunityPledge(accessToken, selectedGroupId, { contributionKind, quantity: Number(quantity), unitLabel, details: pledgeDetails });
      setQuantity('1'); setUnitLabel(contributionKind === 'volunteer_time' ? 'hours' : 'units'); setPledgeDetails(''); setSelectedGroupId(null);
      setSuccess('Your support offer has been recorded.');
      await load();
    } catch (reason: unknown) { setError(reason instanceof ApiRequestError ? reason.message : 'The support offer could not be recorded.'); }
    finally { setBusy(false); }
  }

  return <section className="community-aid" id="community">
    <header>
      <div><p className="eyebrow">LOCAL MUTUAL AID</p><h2>Community aid network</h2><p>Form a local group, join neighbours, and record practical help that people can coordinate.</p></div>
      <div className="community-aid__actions"><button className="quiet-button" type="button" onClick={() => void load()} disabled={loading || busy}>↻ Refresh</button><button className="report-button" type="button" onClick={() => { setError(null); setSuccess(''); setShowGroupForm(true); }}>+ Form a community</button></div>
    </header>
    <p className="community-aid__notice"><strong>Prototype safety:</strong> this records intentions to help. Donation pledges are not payments—never enter card, bank, or sensitive personal information here.</p>
    {error && <p className="community-aid__error" role="alert">{error}</p>}
    {success && <p className="community-success" role="status">{success}</p>}

    {showGroupForm && <CommunityDialog title="Form a community" onClose={() => { if (!busy) setShowGroupForm(false); }}><form className="community-aid__form" onSubmit={(event) => void createGroup(event)}>
      <div><p className="eyebrow">START A GROUP</p><h3>Bring local people together</h3></div>
      <label>Community name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} minLength={3} maxLength={100} placeholder="e.g. Gorkha Community Relief" required /></label>
      <label>Focus area<select value={focusArea} onChange={(event) => setFocusArea(event.target.value)}>{focusAreas.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} minLength={2} maxLength={180} placeholder="Neighbourhood, city" required /></label>
      <label className="community-aid__wide">How will this group help?<textarea value={groupSummary} onChange={(event) => setGroupSummary(event.target.value)} minLength={10} maxLength={1500} placeholder="Describe the local need, the support people can offer, and who should join." required /></label>
      <CommunityMediaFields value={media} onChange={setMedia} disabled={busy} />
      {error && <p className="form-error community-aid__wide" role="alert">{error}</p>}
      <footer><small>You become the owner. The community stays private until a coordinator approves it.</small><button className="submit-button" disabled={busy}>{busy ? 'Submitting…' : 'Submit for approval'}</button></footer>
    </form></CommunityDialog>}

    {selectedGroup && <CommunityDialog title={`Offer help · ${selectedGroup.name}`} onClose={() => { if (!busy) setSelectedGroupId(null); }}><form className="community-aid__form community-aid__form--pledge" onSubmit={(event) => void createPledge(event)}>
      <div><p className="eyebrow">OFFER SUPPORT</p><h3>Help {selectedGroup.name}</h3></div>
      <label>Contribution<select value={contributionKind} onChange={(event) => { const kind = event.target.value; setContributionKind(kind); setUnitLabel(kind === 'volunteer_time' ? 'hours' : kind === 'money_pledge' ? 'pledge amount' : 'units'); }}>{contributionKinds.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
      <label>Quantity<input type="number" min="0.01" step="0.01" value={quantity} onChange={(event) => setQuantity(event.target.value)} required /></label>
      <label>Unit<input value={unitLabel} onChange={(event) => setUnitLabel(event.target.value)} minLength={1} maxLength={50} required /></label>
      <label className="community-aid__wide">What can you offer?<textarea value={pledgeDetails} onChange={(event) => setPledgeDetails(event.target.value)} minLength={3} maxLength={600} placeholder="Describe availability, supplies, pickup point, or other useful details. Do not include payment information." required /></label>
      {error && <p className="form-error community-aid__wide" role="alert">{error}</p>}
      <footer><small>{contributionKind === 'money_pledge' ? 'Record an intention only; no money is collected in CrisisGrid.' : 'Your offer will appear in the shared community aid ledger.'}</small><button className="submit-button" disabled={busy}>{busy ? 'Recording…' : 'Record offer'}</button></footer>
    </form></CommunityDialog>}

    {detailGroup && <CommunityDetails key={detailGroup.id} accessToken={accessToken} group={detailGroup} canModerate={overview.canModerate} onClose={() => setDetailId(null)} onUpdated={load} onOffer={(id) => { setDetailId(null); setSelectedGroupId(id); }} />}

    {privateGroups.length > 0 && <section className="community-requests" aria-label={overview.canModerate ? 'Community approval requests' : 'Your community requests'}><header><div><p className="panel-kicker">{overview.canModerate ? 'COORDINATOR REVIEW' : 'YOUR REQUESTS'}</p><h3>{overview.canModerate ? 'Community approval requests' : 'Your approval status'}</h3></div><small>Visible only to the requester and coordinators</small></header>{privateGroups.map((group) => <article key={group.id}><CommunityImage accessToken={accessToken} group={group} /><div><strong>{group.name}</strong><span className={`community-status community-status--${group.status}`}>{group.status === 'pending' ? 'Pending approval' : 'Rejected'}</span></div><button className="cancel-button" type="button" onClick={() => setDetailId(group.id)}>{overview.canModerate && group.status === 'pending' ? 'Review request' : 'View status'}</button></article>)}</section>}

    <div className="community-aid__grid">
      {loading && <p className="community-aid__empty">Loading local communities…</p>}
      {!loading && approvedGroups.length === 0 && <p className="community-aid__empty">No approved communities yet. Form a community or check your approval status above.</p>}
      {(showAll ? approvedGroups : approvedGroups.slice(0, 3)).map((group) => <article className="community-card" key={group.id}>
        <div className="community-card__meta"><span>{labelFor(group.focusArea, focusAreas)}</span><small>{group.memberCount} {group.memberCount === 1 ? 'member' : 'members'} · {group.pledgeCount} offers</small></div>
        <div className="community-card__heading"><CommunityImage accessToken={accessToken} group={group} /><h3>{group.name}</h3></div><p>{group.summary}</p><small className="community-card__location">⌖ {group.location || 'Location not added'}</small>
        <footer><button className="quiet-button" type="button" onClick={() => setDetailId(group.id)}>Open</button>{!group.joined ? <button className="submit-button" type="button" disabled={busy} onClick={() => void joinGroup(group.id)}>Join community</button> : <button className="submit-button" type="button" disabled={busy} onClick={() => setSelectedGroupId(group.id)}>Offer help</button>}</footer>
      </article>)}
    </div>
    {approvedGroups.length > 3 && <div className="community-view-all"><button className="cancel-button" type="button" aria-expanded={showAll} onClick={() => setShowAll(!showAll)}>{showAll ? 'Show fewer communities' : `View all communities (${approvedGroups.length})`}</button></div>}

    <section className="community-aid__ledger" aria-label="Recent community support offers">
      <header><div><p className="eyebrow">SHARED SUPPORT LEDGER</p><h3>Recent offers</h3></div><small>Visible to signed-in local participants</small></header>
      {overview.pledges.length === 0 ? <p className="community-aid__empty">Support offers will appear here after community members record them.</p> : <div>{overview.pledges.slice(0, 8).map((pledge) => <article key={pledge.id}><span className="community-aid__pledge-icon">{pledge.kind === 'volunteer_time' ? '↗' : pledge.kind === 'supplies' ? '□' : pledge.kind === 'transport' ? '⌁' : '♥'}</span><div><strong>{pledge.contributorName} offered {pledge.quantity} {pledge.unitLabel}</strong><small>{labelFor(pledge.kind, contributionKinds)} · {pledge.groupName} · {formatTime(pledge.createdAt)}</small><p>{pledge.details}</p></div></article>)}</div>}
    </section>
  </section>;
}
