import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { ApiRequestError, api, type AdvisoryEarthquakes, type CurrentUser, type GdacsEvents, type NasaNaturalEvents, type OperationsOverview, type OsirisHazards } from '../lib/api';
import { OperationsMap } from './OperationsMap';
import { useLiveLocation } from './useLiveLocation';
import { usePlaceName } from './usePlaceName';
import { GlobalHazardMap } from './GlobalHazardMap';
import { GlobalDisasterSummary } from './GlobalDisasterSummary';
import { IncidentReporter } from './IncidentReporter';
import { RequestComposer } from './RequestComposer';
import { DispatchPlanner } from './DispatchPlanner';
import { NotificationCenter } from './NotificationCenter';
import { GlobalChat } from './GlobalChat';
import { SosReporter } from './SosReporter';
import { WorkflowBoard } from './WorkflowBoard';
import { SupplyTracker } from './SupplyTracker';
import { CoordinatorUpdates } from './CoordinatorUpdates';
import { CommunityAid } from './CommunityAid';
import { LocalConditionsCards } from './LocalConditionsCards';
import { TimeGreeting } from './TimeGreeting';
import type { NotificationLocation } from '../lib/api';

type Props = { accessToken: string; onSignOut: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void; user: CurrentUser };
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const navigation = [['overview', 'Overview'], ['operations', 'Operations map'], ['workflow', 'Response workflow'], ['requests', 'Request queue'], ['dispatch', 'Dispatch planner'], ['supply-tracking', 'Supply tracking'], ['community', 'Community aid'], ['global-map', 'Global live intelligence']] as const;

function titleCase(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }

export function Workspace({ accessToken, onSignOut, theme, onToggleTheme, user }: Props): ReactElement {
  const liveLocation = useLiveLocation();
  const placeName = usePlaceName(liveLocation.position, accessToken);
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [earthquakes, setEarthquakes] = useState<AdvisoryEarthquakes | null>(null);
  const [osirisHazards, setOsirisHazards] = useState<OsirisHazards | null>(null);
  const [nasaEvents, setNasaEvents] = useState<NasaNaturalEvents | null>(null);
  const [gdacsEvents, setGdacsEvents] = useState<GdacsEvents | null>(null);
  const [failedSources, setFailedSources] = useState<string[]>([]);
  const [notificationRefresh, setNotificationRefresh] = useState(0);
  const [status, setStatus] = useState<LoadState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [showReporter, setShowReporter] = useState(false);
  const [showSosReporter, setShowSosReporter] = useState(false);
  const [notificationLocation, setNotificationLocation] = useState<NotificationLocation | null>(null);
  const [sosSuccess, setSosSuccess] = useState('');
  const [showRequestComposer, setShowRequestComposer] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deletingRequestId, setDeletingRequestId] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const canPostCoordinatorUpdates = user.roles.some((role) => role === 'administrator' || role === 'coordinator');
  const load = useCallback(async () => {
    setStatus('loading'); setMessage(null);
    const [overviewResult, earthquakeResult, osirisResult, nasaResult, gdacsResult] = await Promise.allSettled([api.operationsOverview(accessToken), api.advisoryEarthquakes(accessToken), api.osirisHazards(accessToken), api.nasaNaturalEvents(accessToken), api.gdacsEvents(accessToken)]);
    if (overviewResult.status === 'fulfilled') { setOverview(overviewResult.value); setStatus('ready'); }
    else { setStatus('error'); const reason = overviewResult.reason; setMessage(reason instanceof ApiRequestError ? reason.message : 'The local operational dashboard could not be loaded.'); }
    if (earthquakeResult.status === 'fulfilled') setEarthquakes(earthquakeResult.value);
    if (osirisResult.status === 'fulfilled') setOsirisHazards(osirisResult.value);
    if (nasaResult.status === 'fulfilled') setNasaEvents(nasaResult.value);
    if (gdacsResult.status === 'fulfilled') setGdacsEvents(gdacsResult.value);
    setFailedSources([[earthquakeResult, 'USGS'], [osirisResult, 'OSIRIS'], [nasaResult, 'NASA EONET'], [gdacsResult, 'GDACS']].filter(([result]) => typeof result !== 'string' && result.status === 'rejected').map(([, source]) => source as string));
    setNotificationRefresh((value) => value + 1);
  }, [accessToken]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => void load(), 60_000);
    return () => window.clearInterval(timer);
  }, [load]);
  function scrollTo(section: string): void { setActiveSection(section); document.getElementById(section)?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  async function advanceRequest(id: string, currentStatus: string): Promise<void> {
    const nextStatus: Record<string, string> = { open: 'triaged', assigned: 'in_progress', in_progress: 'fulfilled' };
    const next = nextStatus[currentStatus];
    if (!next) return;
    setActionError(null); setUpdatingRequestId(id);
    try { await api.updateRequestStatus(accessToken, id, next); await load(); }
    catch (reason: unknown) { setActionError(reason instanceof ApiRequestError ? reason.message : 'The request status could not be updated.'); }
    finally { setUpdatingRequestId(null); }
  }

  async function deleteRequest(request: OperationsOverview['requests'][number]): Promise<void> {
    if (!user.roles.includes('coordinator') || !window.confirm(`Permanently delete this ${titleCase(request.category)} assistance request at ${request.label ?? 'the reported location'}?\n\n${request.description}\n\nThe linked incident will remain. This cannot be undone from the dashboard.`)) return;
    setDeletingRequestId(request.id); setActionError(null);
    try { await api.deleteRequest(accessToken, request.id); await load(); }
    catch (reason: unknown) { setActionError(reason instanceof ApiRequestError ? reason.message : 'The request could not be deleted.'); }
    finally { setDeletingRequestId(null); }
  }

  return <div className="command-shell">
    <aside className="command-sidebar">
      <a className="brand" href="/"><span className="brand-mark">+</span><span>CrisisGrid<small>COMMAND</small></span></a>
      <nav aria-label="Command navigation">{navigation.map(([target, label], index) => <button key={target} type="button" className={activeSection === target ? 'is-active' : ''} onClick={() => scrollTo(target)}><i>{['◫', '⌖', '◫', '≡', '↗', '▣', '⌁', '✦'][index]}</i>{label}</button>)}</nav>
      <div className="sidebar-status"><span className="status-pulse" />Local PostGIS mode <b>ONLINE</b><small>Transactional demo data · no live dispatch</small></div>
      <div className="sidebar-account"><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.roles.map(titleCase).join(' · ')}</small></span><button type="button" aria-label="Sign out" onClick={onSignOut}>↪</button></div>
    </aside>
    <main className="command-main">
      <header className="command-topbar"><div><p className="eyebrow">OPERATIONS CONSOLE</p><h1><TimeGreeting name={user.displayName.split(' ')[0]} /></h1></div><div className="topbar-right"><div className="topbar-utilities"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? '☀ Light' : '◐ Dark'}</button><GlobalChat accessToken={accessToken} canClear={user.roles.some((role) => role === 'administrator' || role === 'coordinator')} /><NotificationCenter accessToken={accessToken} refreshKey={notificationRefresh} onOpen={(notice) => { if (notice.location) { setNotificationLocation(notice.location); scrollTo('operations'); } }} /></div><div className="topbar-actions"><span className="sync-status"><i />{overview ? `Synced ${formatTime(overview.generatedAt)}` : 'Connecting to local data'}</span><button type="button" className="sos-button" onClick={() => setShowSosReporter(true)}>SOS request</button><button type="button" className="report-button report-button--quiet" onClick={() => setShowRequestComposer(true)} disabled={!overview?.incidents.length}>+ Assistance request</button><button type="button" className="report-button" onClick={() => setShowReporter(true)}>+ Report incident</button><button type="button" className="refresh-button" onClick={() => void load()} disabled={status === 'loading'}>{status === 'loading' ? 'Refreshing…' : '↻ Refresh'}</button></div></div></header>
      {status === 'error' && <div className="dashboard-error" role="alert"><strong>Local dashboard unavailable.</strong> {message}<button type="button" onClick={() => void load()}>Try again</button></div>}
      {status !== 'ready' && status !== 'error' && <div className="dashboard-loading"><span /><p>Loading the local operations picture…</p></div>}
      {sosSuccess && <p className="sos-success" role="status">{sosSuccess}</p>}{actionError && <div className="dashboard-error" role="alert"><strong>Action unavailable.</strong> {actionError}</div>}
      <GlobalDisasterSummary earthquakes={earthquakes} gdacs={gdacsEvents} nasa={nasaEvents} hazards={osirisHazards} failedSources={failedSources} loading={status === 'loading' || status === 'idle'} />
      {overview && <>
        <LocalConditionsCards accessToken={accessToken} location={{ ...liveLocation, placeName }} />
        <section id="operations" className="command-grid command-grid--map"><article className="panel map-panel"><div className="panel-header"><div><p className="panel-kicker">LIVE OPERATIONS MAP</p><h2>{notificationLocation ? `${notificationLocation.label} · ${notificationLocation.latitude.toFixed(4)}, ${notificationLocation.longitude.toFixed(4)}` : liveLocation.position ? `${placeName ?? 'Your live location'} · ${liveLocation.position.latitude.toFixed(4)}, ${liveLocation.position.longitude.toFixed(4)}` : liveLocation.error ? 'Your live location is unavailable' : 'Locating you…'}</h2></div><div className="map-legend"><span><i className="legend-dot legend-dot--incident" />Incident</span><span><i className="legend-dot legend-dot--resource" />Available resource</span></div></div><OperationsMap overview={overview} location={{ ...liveLocation, placeName }} focus={notificationLocation} onClearFocus={() => setNotificationLocation(null)} /><footer className="map-footer"><span>Data from local PostGIS records</span><span>Straight-line positions only · not vehicle tracking</span></footer></article></section>
        <section id="requests" className="command-grid command-grid--queue"><article className="panel request-panel"><div className="panel-header"><div><p className="panel-kicker">PRIORITY QUEUE</p><h2>Assistance requests</h2></div><button type="button" className="quiet-button" onClick={() => scrollTo('dispatch')}>Open planner</button></div><div className="request-list">{overview.requests.length ? overview.requests.map((request) => <article key={request.id}><span className={`severity-dot severity-dot--${request.severity}`} /><div><p><strong>{titleCase(request.category)} support</strong><span>{request.label ?? 'Location pending'}</span></p><small>{request.description}</small></div><aside><em className={`status-badge status-badge--${request.status}`}>{titleCase(request.status)}</em>{request.peopleCount && <small>{request.peopleCount} people</small>}<div className="request-row-actions">{request.status === 'triaged' && <button className="advance-button" type="button" onClick={() => scrollTo('dispatch')}>Plan dispatch</button>}{['open', 'assigned', 'in_progress'].includes(request.status) && <button className="advance-button" type="button" disabled={updatingRequestId === request.id} onClick={() => void advanceRequest(request.id, request.status)}>{updatingRequestId === request.id ? 'Saving…' : `Mark ${request.status === 'open' ? 'triaged' : request.status === 'assigned' ? 'in progress' : 'fulfilled'}`}</button>}{user.roles.includes('coordinator') && <button type="button" className="delete-request-button" disabled={deletingRequestId !== null || updatingRequestId === request.id || !['open', 'triaged'].includes(request.status)} title={['open', 'triaged'].includes(request.status) ? 'Delete this assistance request' : 'Assigned requests cannot be deleted'} onClick={() => void deleteRequest(request)}>{deletingRequestId === request.id ? 'Deleting…' : 'Delete'}</button>}</div></aside></article>) : <p className="empty-copy">No open assistance requests in the local database.</p>}</div></article><article className="panel incident-panel"><div className="panel-header"><div><p className="panel-kicker">INCIDENT WATCH</p><h2>Open reports</h2></div><span className="count-bubble">{overview.incidents.length}</span></div><div className="incident-list">{overview.incidents.map((incident) => <div key={incident.id}><span className={`incident-symbol incident-symbol--${incident.severity}`}>!</span><p><strong>{titleCase(incident.emergencyType)} · {titleCase(incident.severity)}</strong><small>{incident.label ?? 'Location pending'} · {formatTime(incident.reportedAt)}</small></p><em>{titleCase(incident.status)}</em></div>)}</div></article></section>
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="request_queue" title="Request queue updates" />
        <WorkflowBoard requests={overview.requests} updatingId={updatingRequestId} onAdvance={(id, requestStatus) => void advanceRequest(id, requestStatus)} onPlan={() => scrollTo('dispatch')} />
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="workflow" title="Response workflow updates" />
        <DispatchPlanner accessToken={accessToken} requests={overview.requests} onChanged={() => void load()} />
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="dispatch" title="Dispatch planner updates" />
        <SupplyTracker accessToken={accessToken} onChanged={() => void load()} />
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="supply_tracking" title="Supply tracking updates" />
        <CommunityAid accessToken={accessToken} />
        <section id="global-map" className="global-map-section" aria-labelledby="global-map-title"><div className="global-map-section__heading"><div><p className="eyebrow">GLOBAL LIVE INTELLIGENCE · 60S REFRESH</p><h2 id="global-map-title">Live map and advisory signals</h2><p>Public earthquakes, natural events, disaster alerts, fire hotspots, and weather signals from multiple live reference feeds.</p></div><div className="global-map-section__legend"><span><i className="legend-dot legend-dot--quake" />USGS earthquake</span><span><i className="legend-dot legend-dot--gdacs" />GDACS alert</span><span><i className="legend-dot legend-dot--fire" />OSIRIS fire</span><span><i className="legend-dot legend-dot--weather" />Weather / NASA</span></div></div><GlobalHazardMap hazards={osirisHazards} earthquakes={earthquakes} nasaEvents={nasaEvents} gdacsEvents={gdacsEvents} /><footer><span>USGS + GDACS + NASA EONET + OSIRIS public advisory data · refreshes every 60 seconds</span><span>Not a local alert, dispatch, or verified incident record</span></footer></section>
        <section id="global-advisory" className="global-advisory" aria-labelledby="global-advisory-title"><div className="global-advisory__hero"><div><span className="live-tag"><i />PUBLIC DATA · 60S CACHE</span><p className="eyebrow">GLOBAL ADVISORY DESK</p><h2 id="global-advisory-title">Worldwide hazard signals, kept separate from local operations.</h2><p>OSIRIS aggregates public earthquake, fire and weather-event data into one external reference space for situation awareness.</p></div><div className="global-advisory__actions"><a href="https://osirisai.live/" target="_blank" rel="noreferrer">Open OSIRIS ↗</a><button type="button" className="refresh-button" onClick={() => void load()} disabled={status === 'loading'}>{status === 'loading' ? 'Refreshing…' : '↻ Refresh signals'}</button></div></div>{osirisHazards ? <><div className="global-advisory__stats"><article><span>Fire hotspots</span><strong>{osirisHazards.stats.fires.toLocaleString()}</strong><small>Reported by the upstream public feed</small></article><article><span>Weather events</span><strong>{osirisHazards.stats.weather.toLocaleString()}</strong><small>External event records available</small></article><article><span>Global incidents</span><strong>{osirisHazards.stats.incidents.toLocaleString()}</strong><small>Headline count from OSIRIS</small></article><article><span>Last sync</span><strong>{formatTime(osirisHazards.fetchedAt)}</strong><small>Server-normalized advisory snapshot</small></article></div><div className="global-advisory__content"><article className="panel global-advisory__events"><div className="panel-header"><div><p className="panel-kicker">CURRENT SAMPLE</p><h2>Signals to review</h2></div><span className="data-chip">EXTERNAL ONLY</span></div><div className="global-event-grid">{osirisHazards.events.map((event, index) => <a key={`${event.kind}-${index}`} href={event.sourceUrl ?? 'https://osirisai.live/'} target="_blank" rel="noreferrer"><i className={`osiris-kind osiris-kind--${event.kind}`}>{event.kind === 'fire' ? '♨' : event.kind === 'weather' ? '☁' : '⌁'}</i><span><strong>{event.summary}</strong><small>{titleCase(event.kind)} · {event.severity}</small><small>{event.latitude.toFixed(2)}, {event.longitude.toFixed(2)} · {event.time ? formatTime(event.time) : 'time unavailable'}</small></span><b>↗</b></a>)}</div></article><aside className="global-advisory__safety"><p className="panel-kicker">HOW TO USE THIS SPACE</p><h3>Observe, verify, then decide.</h3><p>These are public global signals—not validated local incidents or emergency alerts.</p><ul><li>No signal is written to the CrisisGrid database automatically.</li><li>Nothing here dispatches people, vehicles or supplies.</li><li>Confirm information with official local sources before acting.</li></ul><a href="https://osirisai.live/docs" target="_blank" rel="noreferrer">View source documentation ↗</a></aside></div><article className="nasa-events"><header><div><p className="panel-kicker">NASA EONET · OPEN NATURAL EVENTS</p><h3>Independent global event reference</h3></div><a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noreferrer">NASA EONET ↗</a></header>{nasaEvents?.events.length ? <div>{nasaEvents.events.slice(0, 4).map((event) => <a key={event.id} href={event.sourceUrl} target="_blank" rel="noreferrer"><span>{event.category}</span><strong>{event.title}</strong><small>{event.time ? formatTime(event.time) : 'time unavailable'} · {event.latitude !== null ? `${event.latitude.toFixed(2)}, ${event.longitude?.toFixed(2)}` : 'area geometry'}</small></a>)}</div> : <p>NASA EONET is currently unavailable; local operations are unaffected.</p>}</article></> : <div className="global-advisory__empty"><strong>Global advisory feed unavailable.</strong><span>Local database-backed operations remain available; use Refresh to try the public source again.</span></div>}</section>
      </>}{showReporter && <IncidentReporter accessToken={accessToken} onClose={() => setShowReporter(false)} onCreated={() => { setShowReporter(false); void load(); }} />}{showSosReporter && <SosReporter accessToken={accessToken} location={{ ...liveLocation, placeName }} onClose={() => setShowSosReporter(false)} onCreated={() => { setShowSosReporter(false); setSosSuccess('SOS saved at the reported location. It is now available in coordination notifications and the request queue.'); setNotificationRefresh((value) => value + 1); void load(); }} />}{showRequestComposer && overview && <RequestComposer accessToken={accessToken} incidents={overview.incidents} onClose={() => setShowRequestComposer(false)} onCreated={() => { setShowRequestComposer(false); void load(); }} />}
    </main>
  </div>;
}
