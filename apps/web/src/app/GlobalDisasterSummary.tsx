import type { AdvisoryEarthquakes, GdacsEvents, NasaNaturalEvents, OsirisHazards } from '../lib/api';

type Props = { earthquakes: AdvisoryEarthquakes | null; gdacs: GdacsEvents | null; nasa: NasaNaturalEvents | null; hazards: OsirisHazards | null; failedSources: string[]; loading: boolean };
type Report = { id: string; title: string; kind: string; severity: string; priority: number; source: string; published: string | null; fetchedAt: string; url: string | null; latitude: number; longitude: number };
const hasPoint = (event: { latitude: number | null; longitude: number | null }) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
const time = (value: string) => Number.isFinite(Date.parse(value)) ? new Date(value).toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Time unavailable';
const eventTypes: Record<string, string> = { EQ: 'Earthquake', FL: 'Flood', TC: 'Tropical cyclone', DR: 'Drought', WF: 'Wildfire', VO: 'Volcano', TS: 'Tsunami' };
function sourceLink(value: string | null): string | undefined { try { const url = new URL(value ?? ''); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; } }
function DisasterIcon({ kind }: { kind: string }): React.ReactElement {
  const path = /flood|water|tsunami/i.test(kind) ? 'M3 10c3-4 5 4 9 0s6 4 9 0M3 16c3-4 5 4 9 0s6 4 9 0M12 3v3' : /cyclone|storm/i.test(kind) ? 'M20 7a8 8 0 1 0 1 9M4 17A8 8 0 1 0 3 8M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0' : /fire|volcano/i.test(kind) ? 'M12 3c1 5 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 4-7 0 4 2 5 3 5 2-3 0-6 0-10Z' : /drought/i.test(kind) ? 'M12 2v2m0 16v2M2 12h2m16 0h2M5 5l2 2m10 10 2 2M5 19l2-2M17 7l2-2M17 12a5 5 0 1 1-10 0 5 5 0 0 1 10 0' : 'M2 12h4l3-7 4 14 3-7h6';
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={path} /></svg>;
}

export function GlobalDisasterSummary({ earthquakes, gdacs, nasa, hazards, failedSources, loading }: Props): React.ReactElement {
  const alerts = gdacs?.events.filter(hasPoint) ?? [];
  const quakes = earthquakes?.events.filter(hasPoint) ?? [];
  const naturalEvents = nasa?.events.filter(hasPoint) ?? [];
  const signals = hazards?.events.filter(hasPoint) ?? [];
  const priorities = { red: 4, orange: 3, green: 2, unknown: 1 };
  const candidates: Report[] = [
    ...alerts.map((e) => ({ id: `gdacs:${e.id}`, title: e.title, kind: eventTypes[e.eventType.toUpperCase()] ?? e.eventType, severity: `${e.alertLevel} alert`, priority: priorities[e.alertLevel], source: 'GDACS', published: e.time, fetchedAt: gdacs!.fetchedAt, url: e.sourceUrl, latitude: e.latitude!, longitude: e.longitude! })),
    ...naturalEvents.map((e) => ({ id: `nasa:${e.id}`, title: e.title, kind: e.category, severity: 'Open event', priority: 1, source: 'NASA EONET', published: e.time, fetchedAt: nasa!.fetchedAt, url: e.sourceUrl, latitude: e.latitude!, longitude: e.longitude! })),
    ...quakes.map((e) => ({ id: `usgs:${e.id}`, title: `M${e.magnitude?.toFixed(1) ?? '—'} · ${e.place}`, kind: 'Earthquake', severity: 'Seismic report', priority: (e.magnitude ?? 0) >= 6 ? 3 : 0, source: 'USGS', published: e.time, fetchedAt: earthquakes!.fetchedAt, url: e.url, latitude: e.latitude!, longitude: e.longitude! })),
    ...signals.map((e, i) => ({ id: `osiris:${i}`, title: e.summary, kind: e.kind, severity: 'Hazard signal', priority: 0, source: 'OSIRIS', published: e.time, fetchedAt: hazards!.fetchedAt, url: e.sourceUrl, latitude: e.latitude, longitude: e.longitude })),
  ];
  const seen = new Set<string>();
  const ranked = candidates.sort((a, b) => b.priority - a.priority || (Date.parse(b.published ?? '') || 0) - (Date.parse(a.published ?? '') || 0)).filter((e) => {
    const key = `${e.source}:${e.title.toLowerCase()}:${e.latitude.toFixed(2)},${e.longitude.toFixed(2)}`;
    if (seen.has(key)) return false;
    seen.add(key); return true;
  });
  const featured: Report[] = [];
  const kinds = new Set<string>();
  const kindKey = (value: string) => /cyclone|storm/i.test(value) ? 'storm' : /wildfire|fire/i.test(value) ? 'fire' : /flood/i.test(value) ? 'flood' : value.toLowerCase();
  for (const event of ranked) {
    const key = kindKey(event.kind);
    if (!kinds.has(key) && featured.length < 4) { featured.push(event); kinds.add(key); }
  }
  for (const event of ranked) {
    if (featured.length >= 4) break;
    if (!featured.includes(event)) featured.push(event);
  }
  const feeds = [
    { source: 'GDACS', label: 'Global disaster alerts', value: gdacs ? alerts.length : null, updated: gdacs?.fetchedAt },
    { source: 'USGS', label: 'Earthquakes on world map', value: earthquakes ? quakes.length : null, updated: earthquakes?.fetchedAt },
    { source: 'NASA EONET', label: 'Open natural events', value: nasa ? naturalEvents.length : null, updated: nasa?.fetchedAt },
    { source: 'OSIRIS', label: 'Additional hazard signals', value: hazards ? signals.length : null, updated: hazards?.fetchedAt },
  ];
  const available = feeds.filter((feed) => feed.value !== null).length;
  return <section id="overview" className="disaster-watch" aria-label="Real-world disaster overview">
    <header className="disaster-watch__hero"><div><div className="disaster-watch__eyebrow"><span className="disaster-watch__pulse" />GLOBAL INTELLIGENCE <span>/</span> DISASTER WATCH</div><h2>Eyes on the world.<br /><span>Ready for what matters.</span></h2><p>Four priority reports from the world disaster map.<br />Major hazard types, ranked by alert level and report time.</p><div className="disaster-watch__hero-footer"><span>{loading ? 'Refreshing feeds…' : 'Auto-refresh · every 60 seconds'}</span><a href="#global-map">Explore world map <span aria-hidden="true">↗</span></a></div></div><div className="disaster-watch__globe" aria-hidden="true"><svg viewBox="0 0 280 200" fill="none"><ellipse cx="140" cy="100" rx="86" ry="86" /><ellipse cx="140" cy="100" rx="42" ry="86" /><ellipse cx="140" cy="100" rx="70" ry="86" /><ellipse cx="140" cy="100" rx="86" ry="32" /><ellipse cx="140" cy="100" rx="86" ry="63" /><path d="M54 100h172M140 14v172" /><circle cx="180" cy="65" r="5" /><circle cx="104" cy="124" r="4" /></svg><span>WORLDWIDE COVERAGE</span></div><div className="disaster-watch__feed-health"><strong>{available}<small>/ 4</small></strong><span>feeds connected</span></div></header>
    <div className="disaster-watch__section-heading"><h3>Priority disaster reports <span>{featured.length.toString().padStart(2, '0')}</span></h3><span>Source reports · no simulated events</span></div>
    <div className="disaster-watch__events" aria-label="Four priority disaster reports">{Array.from({ length: 4 }, (_, index) => {
      const event = featured[index];
      if (!event) return <article key={`empty-${index}`} className="disaster-event disaster-event--empty"><span className="disaster-event__number">0{index + 1}</span><h3>{loading ? 'Connecting to live feeds…' : 'No additional report available'}</h3><p>{loading ? 'Fetching the latest source reports.' : 'New events appear when the source feeds return data.'}</p></article>;
      const tone = event.priority >= 4 ? 'red' : event.priority >= 3 ? 'orange' : event.priority >= 2 ? 'green' : 'blue';
      const stale = failedSources.includes(event.source);
      return <article className={`disaster-event disaster-event--${tone}`} key={event.id}><div className="disaster-event__top"><span className="disaster-event__icon"><DisasterIcon kind={event.kind} /></span><span className="disaster-event__badge">{event.severity}</span><span className="disaster-event__number">0{index + 1}</span></div><p className="disaster-event__kind">{event.kind}</p><h3 title={event.title}>{event.title}</h3><p className="disaster-event__coordinates">{Math.abs(event.latitude).toFixed(2)}°{event.latitude < 0 ? 'S' : 'N'} <span> / </span> {Math.abs(event.longitude).toFixed(2)}°{event.longitude < 0 ? 'W' : 'E'}</p><dl><div><dt>Reported</dt><dd>{event.published ? time(event.published) : 'Not provided by source'}</dd></div><div><dt>Feed checked</dt><dd>{time(event.fetchedAt)}</dd></div></dl>{stale && <p className="disaster-event__stale">Refresh failed · last successful report</p>}<footer><span><i className={stale ? 'is-stale' : ''} />{event.source}</span>{sourceLink(event.url) ? <a href={sourceLink(event.url)} target="_blank" rel="noreferrer" aria-label={`Read report: ${event.title}`}>Read report <span aria-hidden="true">↗</span></a> : <a href="#global-map">View map ↗</a>}</footer></article>;
    })}</div>
    {!available && !loading && <p role="status" className="disaster-watch__notice">Worldwide disaster feeds unavailable. Retrying automatically.</p>}
    <div className="disaster-watch__feeds" aria-label="World disaster feed counts">{feeds.map((feed) => <article key={feed.source}><div><span className={`disaster-watch__dot ${feed.value === null || failedSources.includes(feed.source) ? 'is-stale' : ''}`} /><strong>{feed.source}</strong><b>{feed.value ?? '—'}</b></div><p>{feed.label}</p><small>{feed.updated ? `Updated ${time(feed.updated)}` : loading ? 'Connecting…' : 'Unavailable'}</small>{failedSources.includes(feed.source) && feed.updated && <small className="disaster-event__stale">Refresh failed · showing last successful data</small>}</article>)}</div>
    <p className="disaster-watch__note">Public advisory data, refreshed automatically. Feed counts represent loaded map records; reports can overlap. Source report times may precede the latest feed check.</p>
  </section>;
}
