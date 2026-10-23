import { type ReactElement, useCallback, useEffect, useState } from 'react';
import { ApiRequestError, api, type AdvisoryEarthquakes, type AdvisoryWeather, type CurrentUser, type GdacsEvents, type NasaNaturalEvents, type OperationsOverview, type OsirisHazards } from '../lib/api';
import { OperationsMap } from './OperationsMap';
import { GlobalHazardMap } from './GlobalHazardMap';
import { IncidentReporter } from './IncidentReporter';
import { RequestComposer } from './RequestComposer';
import { DispatchPlanner } from './DispatchPlanner';
import { NotificationCenter } from './NotificationCenter';
import { GlobalChat } from './GlobalChat';
import { SosReporter } from './SosReporter';
import { AlertCenter } from './AlertCenter';
import { WorkflowBoard } from './WorkflowBoard';
import { SupplyTracker } from './SupplyTracker';
import { CoordinatorUpdates } from './CoordinatorUpdates';
import { CommunityAid } from './CommunityAid';

type Props = { accessToken: string; onSignOut: () => void; theme: 'light' | 'dark'; onToggleTheme: () => void; user: CurrentUser };
type LoadState = 'idle' | 'loading' | 'ready' | 'error';
const navigation = [['overview', 'Overview'], ['alerts', 'Alert centre'], ['operations', 'Operations map'], ['workflow', 'Response workflow'], ['requests', 'Request queue'], ['dispatch', 'Dispatch planner'], ['supply-tracking', 'Supply tracking'], ['community', 'Community aid'], ['intelligence', 'Advisory intelligence'], ['global-map', 'Global live intelligence']] as const;

function titleCase(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function formatTime(value: string): string { return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value)); }
function weatherLabel(code: number): string {
  if (code === 0) return 'Clear conditions';
  if ([1, 2, 3].includes(code)) return 'Partly cloudy';
  if ([45, 48].includes(code)) return 'Low visibility';
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return 'Wet conditions';
  if ([95, 96, 99].includes(code)) return 'Thunderstorm risk';
  return 'Conditions reported';
}
function Metric({ detail, label, tone, value }: { detail: string; label: string; tone: string; value: number }): ReactElement {
  const icon = tone === 'critical' ? '!' : tone === 'resource' ? '↗' : tone === 'shelter' ? '⌂' : '◎';
  return <article className="metric-card"><div className={`metric-icon metric-icon--${tone}`} aria-hidden="true">{icon}</div><p>{label}</p><strong>{value.toLocaleString()}</strong><small>{detail}</small></article>;
}
function TelemetryMetric({ detail, label, tone, value }: { detail: string; label: string; tone: string; value: string | number }): ReactElement {
  return <article className={`command-telemetry__metric command-telemetry__metric--${tone}`}><span>{label}</span><strong>{value}</strong><small>{detail}</small></article>;
}

export function Workspace({ accessToken, onSignOut, theme, onToggleTheme, user }: Props): ReactElement {
  const [overview, setOverview] = useState<OperationsOverview | null>(null);
  const [weather, setWeather] = useState<AdvisoryWeather | null>(null);
  const [earthquakes, setEarthquakes] = useState<AdvisoryEarthquakes | null>(null);
  const [osirisHazards, setOsirisHazards] = useState<OsirisHazards | null>(null);
  const [nasaEvents, setNasaEvents] = useState<NasaNaturalEvents | null>(null);
  const [gdacsEvents, setGdacsEvents] = useState<GdacsEvents | null>(null);
  const [notificationRefresh, setNotificationRefresh] = useState(0);
  const [status, setStatus] = useState<LoadState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState('overview');
  const [showReporter, setShowReporter] = useState(false);
  const [showSosReporter, setShowSosReporter] = useState(false);
  const [showRequestComposer, setShowRequestComposer] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [updatingRequestId, setUpdatingRequestId] = useState<string | null>(null);
  const canPostCoordinatorUpdates = user.roles.some((role) => role === 'administrator' || role === 'coordinator');
  const load = useCallback(async () => {
    setStatus('loading'); setMessage(null);
    const [overviewResult, weatherResult, earthquakeResult, osirisResult, nasaResult, gdacsResult] = await Promise.allSettled([api.operationsOverview(accessToken), api.advisoryWeather(accessToken), api.advisoryEarthquakes(accessToken), api.osirisHazards(accessToken), api.nasaNaturalEvents(accessToken), api.gdacsEvents(accessToken)]);
    if (overviewResult.status === 'fulfilled') { setOverview(overviewResult.value); setStatus('ready'); }
    else { setStatus('error'); const reason = overviewResult.reason; setMessage(reason instanceof ApiRequestError ? reason.message : 'The local operational dashboard could not be loaded.'); }
    if (weatherResult.status === 'fulfilled') setWeather(weatherResult.value);
    if (earthquakeResult.status === 'fulfilled') setEarthquakes(earthquakeResult.value);
    if (osirisResult.status === 'fulfilled') setOsirisHazards(osirisResult.value);
    if (nasaResult.status === 'fulfilled') setNasaEvents(nasaResult.value);
    if (gdacsResult.status === 'fulfilled') setGdacsEvents(gdacsResult.value);
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

  return <div className="command-shell">
    <aside className="command-sidebar">
      <a className="brand" href="/"><span className="brand-mark">+</span><span>CrisisGrid<small>COMMAND</small></span></a>
      <nav aria-label="Command navigation">{navigation.map(([target, label], index) => <button key={target} type="button" className={activeSection === target ? 'is-active' : ''} onClick={() => scrollTo(target)}><i>{['◫', '◉', '⌖', '◫', '≡', '↗', '▣', '⌁', '◌', '✦'][index]}</i>{label}</button>)}</nav>
      <div className="sidebar-status"><span className="status-pulse" />Local PostGIS mode <b>ONLINE</b><small>Transactional demo data · no live dispatch</small></div>
      <div className="sidebar-account"><span className="avatar">{user.displayName.slice(0, 1).toUpperCase()}</span><span><strong>{user.displayName}</strong><small>{user.roles.map(titleCase).join(' · ')}</small></span><button type="button" aria-label="Sign out" onClick={onSignOut}>↪</button></div>
    </aside>
    <main className="command-main">
      <header className="command-topbar"><div><p className="eyebrow">OPERATIONS CONSOLE</p><h1>Good morning, {user.displayName.split(' ')[0]}.</h1></div><div className="topbar-right"><div className="topbar-utilities"><button type="button" className="theme-toggle" onClick={onToggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}>{theme === 'dark' ? '☀ Light' : '◐ Dark'}</button><GlobalChat accessToken={accessToken} canClear={user.roles.some((role) => role === 'administrator' || role === 'coordinator')} /><NotificationCenter accessToken={accessToken} refreshKey={notificationRefresh} /></div><div className="topbar-actions"><span className="sync-status"><i />{overview ? `Synced ${formatTime(overview.generatedAt)}` : 'Connecting to local data'}</span><button type="button" className="sos-button" onClick={() => setShowSosReporter(true)}>SOS request</button><button type="button" className="report-button report-button--quiet" onClick={() => setShowRequestComposer(true)} disabled={!overview?.incidents.length}>+ Assistance request</button><button type="button" className="report-button" onClick={() => setShowReporter(true)}>+ Report incident</button><button type="button" className="refresh-button" onClick={() => void load()} disabled={status === 'loading'}>{status === 'loading' ? 'Refreshing…' : '↻ Refresh'}</button></div></div></header>
      {status === 'error' && <div className="dashboard-error" role="alert"><strong>Local dashboard unavailable.</strong> {message}<button type="button" onClick={() => void load()}>Try again</button></div>}
      {status !== 'ready' && status !== 'error' && <div className="dashboard-loading"><span /><p>Loading the local operations picture…</p></div>}
      {actionError && <div className="dashboard-error" role="alert"><strong>Action unavailable.</strong> {actionError}</div>}
      {overview && <>
        <section className="command-telemetry" aria-label="Live command telemetry">
          <TelemetryMetric tone="critical" label="Incident watch" value={overview.summary.openIncidents} detail="Open local reports" />
          <TelemetryMetric tone="queue" label="Priority queue" value={overview.summary.openRequests} detail="Requests awaiting action" />
          <TelemetryMetric tone="fleet" label="Fleet ready" value={overview.summary.availableVehicles} detail="Resources available" />
          <TelemetryMetric tone="shelter" label="Shelter space" value={overview.summary.availableShelterSpaces.toLocaleString()} detail="Places currently free" />
          <TelemetryMetric tone="weather" label="Weather advisory" value={weather ? `${Math.round(weather.temperatureC)}°` : '—'} detail={weather ? weatherLabel(weather.weatherCode) : 'Feed connecting'} />
          <TelemetryMetric tone="seismic" label="Seismic watch" value={earthquakes?.events[0]?.magnitude != null ? `M${earthquakes.events[0].magnitude.toFixed(1)}` : '—'} detail={earthquakes?.events[0]?.place ?? 'No signal loaded'} />
        </section>
        <section id="overview" className="incident-strip"><div><span className="live-tag"><i />ACTIVE EXERCISE</span><h2>{overview.activeDisaster?.name ?? 'No active disaster record'}</h2><p>Database-backed view of the fictional local coordination exercise. Last server update {formatTime(overview.generatedAt)}.</p></div><div className="exercise-stat"><span>Open workload</span><strong>{overview.summary.openIncidents + overview.summary.openRequests}</strong><small>incidents + requests</small></div></section>
        <section className="metrics-grid" aria-label="Operational metrics"><Metric tone="critical" label="Open incidents" value={overview.summary.openIncidents} detail="Require review or active handling" /><Metric tone="request" label="Open requests" value={overview.summary.openRequests} detail="Awaiting action in the queue" /><Metric tone="resource" label="Available vehicles" value={overview.summary.availableVehicles} detail="Demo resources eligible for dispatch" /><Metric tone="shelter" label="Shelter capacity" value={overview.summary.availableShelterSpaces} detail="Spaces currently available" /></section>
        <AlertCenter weather={weather} earthquakes={earthquakes} hazards={osirisHazards} onRefresh={() => void load()} />
        <section id="operations" className="command-grid command-grid--map"><article className="panel map-panel"><div className="panel-header"><div><p className="panel-kicker">LIVE OPERATIONS MAP</p><h2>Fictional Northbank area</h2></div><div className="map-legend"><span><i className="legend-dot legend-dot--incident" />Incident</span><span><i className="legend-dot legend-dot--resource" />Available resource</span></div></div><OperationsMap overview={overview} /><footer className="map-footer"><span>Data from local PostGIS records</span><span>Straight-line positions only · not vehicle tracking</span></footer></article><article className="panel readiness-panel"><div className="panel-header"><div><p className="panel-kicker">READINESS</p><h2>Resource posture</h2></div><span className="data-chip">LOCAL DB</span></div><div className="readiness-metric"><span>Supply units available</span><strong>{overview.summary.availableSupplyUnits.toLocaleString()}</strong><div><i style={{ width: `${Math.min(100, overview.summary.availableSupplyUnits / 2)}%` }} /></div></div><div className="readiness-metric"><span>Active assignments</span><strong>{overview.summary.activeAssignments}</strong><div><i className="assignment-bar" style={{ width: `${overview.summary.activeAssignments ? 58 : 8}%` }} /></div></div><div className="resource-list">{overview.resources.map((resource) => <div key={resource.id}><span className="resource-avatar">↗</span><p><strong>{resource.registrationCode}</strong><small>{resource.providerName}</small></p><em>{titleCase(resource.status)}</em></div>)}</div></article></section>
        <section id="requests" className="command-grid command-grid--queue"><article className="panel request-panel"><div className="panel-header"><div><p className="panel-kicker">PRIORITY QUEUE</p><h2>Assistance requests</h2></div><button type="button" className="quiet-button" onClick={() => scrollTo('dispatch')}>Open planner</button></div><div className="request-list">{overview.requests.length ? overview.requests.map((request) => <article key={request.id}><span className={`severity-dot severity-dot--${request.severity}`} /><div><p><strong>{titleCase(request.category)} support</strong><span>{request.label ?? 'Location pending'}</span></p><small>{request.description}</small></div><aside><em className={`status-badge status-badge--${request.status}`}>{titleCase(request.status)}</em>{request.peopleCount && <small>{request.peopleCount} people</small>}{request.status === 'triaged' && <button className="advance-button" type="button" onClick={() => scrollTo('dispatch')}>Plan dispatch</button>}{['open', 'assigned', 'in_progress'].includes(request.status) && <button className="advance-button" type="button" disabled={updatingRequestId === request.id} onClick={() => void advanceRequest(request.id, request.status)}>{updatingRequestId === request.id ? 'Saving…' : `Mark ${request.status === 'open' ? 'triaged' : request.status === 'assigned' ? 'in progress' : 'fulfilled'}`}</button>}</aside></article>) : <p className="empty-copy">No open assistance requests in the local database.</p>}</div></article><article className="panel incident-panel"><div className="panel-header"><div><p className="panel-kicker">INCIDENT WATCH</p><h2>Open reports</h2></div><span className="count-bubble">{overview.incidents.length}</span></div><div className="incident-list">{overview.incidents.map((incident) => <div key={incident.id}><span className={`incident-symbol incident-symbol--${incident.severity}`}>!</span><p><strong>{titleCase(incident.emergencyType)} · {titleCase(incident.severity)}</strong><small>{incident.label ?? 'Location pending'} · {formatTime(incident.reportedAt)}</small></p><em>{titleCase(incident.status)}</em></div>)}</div></article></section>
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="request_queue" title="Request queue updates" />
        <WorkflowBoard requests={overview.requests} updatingId={updatingRequestId} onAdvance={(id, requestStatus) => void advanceRequest(id, requestStatus)} onPlan={() => scrollTo('dispatch')} />
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="workflow" title="Response workflow updates" />
        <DispatchPlanner accessToken={accessToken} requests={overview.requests} onChanged={() => void load()} />
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="dispatch" title="Dispatch planner updates" />
        <SupplyTracker accessToken={accessToken} onChanged={() => void load()} />
        <CoordinatorUpdates accessToken={accessToken} canPost={canPostCoordinatorUpdates} scope="supply_tracking" title="Supply tracking updates" />
        <CommunityAid accessToken={accessToken} />
        <section id="intelligence" className="command-grid command-grid--intelligence"><article className="panel weather-panel"><div className="panel-header"><div><p className="panel-kicker">ADVISORY WEATHER</p><h2>{weather?.locationLabel ?? 'Weather feed'}</h2></div><a href="https://open-meteo.com/" target="_blank" rel="noreferrer">Open-Meteo ↗</a></div>{weather ? <div className="weather-content"><span>{weather.weatherCode >= 95 ? 'ϟ' : weather.weatherCode >= 51 ? '☂' : weather.weatherCode >= 1 ? '☁' : '☀'}</span><strong>{Math.round(weather.temperatureC)}°</strong><div><b>{weatherLabel(weather.weatherCode)}</b><small>Wind {Math.round(weather.windKph)} km/h · refreshed {formatTime(weather.fetchedAt)}</small></div></div> : <p className="external-unavailable">The advisory weather feed is currently unavailable. It does not affect local operations data.</p>}<footer>Advisory only; this is not an emergency alert or forecast guarantee.</footer></article><article className="panel seismic-panel"><div className="panel-header"><div><p className="panel-kicker">GLOBAL SEISMIC FEED</p><h2>Recent M2.5+ events</h2></div><a href="https://earthquake.usgs.gov/" target="_blank" rel="noreferrer">USGS ↗</a></div>{earthquakes?.events.length ? <div className="seismic-list">{earthquakes.events.slice(0, 3).map((event) => <a key={event.id} href={event.url} target="_blank" rel="noreferrer"><b>M{event.magnitude?.toFixed(1) ?? '—'}</b><span>{event.place}</span><time>{formatTime(event.time)}</time></a>)}</div> : <p className="external-unavailable">The external earthquake feed is currently unavailable.</p>}<footer>External advisory feed only; events are never silently created as CrisisGrid incidents.</footer></article></section>
        <section id="global-map" className="global-map-section" aria-labelledby="global-map-title"><div className="global-map-section__heading"><div><p className="eyebrow">GLOBAL LIVE INTELLIGENCE · 60S REFRESH</p><h2 id="global-map-title">Live map and advisory signals</h2><p>Public earthquakes, natural events, disaster alerts, fire hotspots, and weather signals from multiple live reference feeds.</p></div><div className="global-map-section__legend"><span><i className="legend-dot legend-dot--quake" />USGS earthquake</span><span><i className="legend-dot legend-dot--gdacs" />GDACS alert</span><span><i className="legend-dot legend-dot--fire" />OSIRIS fire</span><span><i className="legend-dot legend-dot--weather" />Weather / NASA</span></div></div><GlobalHazardMap hazards={osirisHazards} earthquakes={earthquakes} nasaEvents={nasaEvents} gdacsEvents={gdacsEvents} /><footer><span>USGS + GDACS + NASA EONET + OSIRIS public advisory data · refreshes every 60 seconds</span><span>Not a local alert, dispatch, or verified incident record</span></footer></section>
        <section id="global-advisory" className="global-advisory" aria-labelledby="global-advisory-title"><div className="global-advisory__hero"><div><span className="live-tag"><i />PUBLIC DATA · 60S CACHE</span><p className="eyebrow">GLOBAL ADVISORY DESK</p><h2 id="global-advisory-title">Worldwide hazard signals, kept separate from local operations.</h2><p>OSIRIS aggregates public earthquake, fire and weather-event data into one external reference space for situation awareness.</p></div><div className="global-advisory__actions"><a href="https://osirisai.live/" target="_blank" rel="noreferrer">Open OSIRIS ↗</a><button type="button" className="refresh-button" onClick={() => void load()} disabled={status === 'loading'}>{status === 'loading' ? 'Refreshing…' : '↻ Refresh signals'}</button></div></div>{osirisHazards ? <><div className="global-advisory__stats"><article><span>Fire hotspots</span><strong>{osirisHazards.stats.fires.toLocaleString()}</strong><small>Reported by the upstream public feed</small></article><article><span>Weather events</span><strong>{osirisHazards.stats.weather.toLocaleString()}</strong><small>External event records available</small></article><article><span>Global incidents</span><strong>{osirisHazards.stats.incidents.toLocaleString()}</strong><small>Headline count from OSIRIS</small></article><article><span>Last sync</span><strong>{formatTime(osirisHazards.fetchedAt)}</strong><small>Server-normalized advisory snapshot</small></article></div><div className="global-advisory__content"><article className="panel global-advisory__events"><div className="panel-header"><div><p className="panel-kicker">CURRENT SAMPLE</p><h2>Signals to review</h2></div><span className="data-chip">EXTERNAL ONLY</span></div><div className="global-event-grid">{osirisHazards.events.map((event, index) => <a key={`${event.kind}-${index}`} href={event.sourceUrl ?? 'https://osirisai.live/'} target="_blank" rel="noreferrer"><i className={`osiris-kind osiris-kind--${event.kind}`}>{event.kind === 'fire' ? '♨' : event.kind === 'weather' ? '☁' : '⌁'}</i><span><strong>{event.summary}</strong><small>{titleCase(event.kind)} · {event.severity}</small><small>{event.latitude.toFixed(2)}, {event.longitude.toFixed(2)} · {event.time ? formatTime(event.time) : 'time unavailable'}</small></span><b>↗</b></a>)}</div></article><aside className="global-advisory__safety"><p className="panel-kicker">HOW TO USE THIS SPACE</p><h3>Observe, verify, then decide.</h3><p>These are public global signals—not validated local incidents or emergency alerts.</p><ul><li>No signal is written to the CrisisGrid database automatically.</li><li>Nothing here dispatches people, vehicles or supplies.</li><li>Confirm information with official local sources before acting.</li></ul><a href="https://osirisai.live/docs" target="_blank" rel="noreferrer">View source documentation ↗</a></aside></div><article className="nasa-events"><header><div><p className="panel-kicker">NASA EONET · OPEN NATURAL EVENTS</p><h3>Independent global event reference</h3></div><a href="https://eonet.gsfc.nasa.gov/" target="_blank" rel="noreferrer">NASA EONET ↗</a></header>{nasaEvents?.events.length ? <div>{nasaEvents.events.slice(0, 4).map((event) => <a key={event.id} href={event.sourceUrl} target="_blank" rel="noreferrer"><span>{event.category}</span><strong>{event.title}</strong><small>{event.time ? formatTime(event.time) : 'time unavailable'} · {event.latitude !== null ? `${event.latitude.toFixed(2)}, ${event.longitude?.toFixed(2)}` : 'area geometry'}</small></a>)}</div> : <p>NASA EONET is currently unavailable; local operations are unaffected.</p>}</article></> : <div className="global-advisory__empty"><strong>Global advisory feed unavailable.</strong><span>Local database-backed operations remain available; use Refresh to try the public source again.</span></div>}</section>
      </>}{showReporter && <IncidentReporter accessToken={accessToken} onClose={() => setShowReporter(false)} onCreated={() => { setShowReporter(false); void load(); }} />}{showSosReporter && <SosReporter accessToken={accessToken} onClose={() => setShowSosReporter(false)} onCreated={() => { setShowSosReporter(false); void load(); }} />}{showRequestComposer && overview && <RequestComposer accessToken={accessToken} incidents={overview.incidents} onClose={() => setShowRequestComposer(false)} onCreated={() => { setShowRequestComposer(false); void load(); }} />}
    </main>
  </div>;
}
