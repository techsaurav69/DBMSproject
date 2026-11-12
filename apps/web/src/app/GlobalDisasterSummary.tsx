import type { AdvisoryEarthquakes, GdacsEvents, NasaNaturalEvents, OsirisHazards } from '../lib/api';

type Props = { earthquakes: AdvisoryEarthquakes | null; gdacs: GdacsEvents | null; nasa: NasaNaturalEvents | null; hazards: OsirisHazards | null; failedSources: string[]; loading: boolean };
const hasPoint = (event: { latitude: number | null; longitude: number | null }) => Number.isFinite(event.latitude) && Number.isFinite(event.longitude);
const time = (value: string) => new Date(value).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
function sourceLink(value: string): string | undefined { try { const url = new URL(value); return ['https:', 'http:'].includes(url.protocol) ? url.href : undefined; } catch { return undefined; } }

export function GlobalDisasterSummary({ earthquakes, gdacs, nasa, hazards, failedSources, loading }: Props): React.ReactElement {
  const alerts = gdacs?.events.filter(hasPoint) ?? [];
  const quakes = earthquakes?.events.filter(hasPoint) ?? [];
  const naturalEvents = nasa?.events.filter(hasPoint) ?? [];
  const signals = hazards?.events.filter(hasPoint) ?? [];
  const priority = { red: 3, orange: 2, green: 1, unknown: 0 };
  const headline = [...alerts].sort((a, b) => priority[b.alertLevel] - priority[a.alertLevel] || Date.parse(b.time ?? '') - Date.parse(a.time ?? ''))[0];
  const latestNatural = [...naturalEvents].sort((a, b) => Date.parse(b.time ?? '') - Date.parse(a.time ?? ''))[0];
  const latestQuake = [...quakes].sort((a, b) => Date.parse(b.time) - Date.parse(a.time))[0];
  const title = headline?.title ?? latestNatural?.title ?? (latestQuake ? `M${latestQuake.magnitude?.toFixed(1) ?? '—'} earthquake · ${latestQuake.place}` : signals[0]?.summary);
  const featuredSource = headline ? 'GDACS' : latestNatural ? 'NASA EONET' : latestQuake ? 'USGS' : signals.length ? 'OSIRIS' : null;
  const published = headline ? headline.time : latestNatural ? latestNatural.time : latestQuake ? latestQuake.time : signals[0]?.time;
  const report = headline ? headline.sourceUrl : latestNatural ? latestNatural.sourceUrl : latestQuake ? latestQuake.url : signals[0]?.sourceUrl;
  const cards = [
    { source: 'GDACS', label: 'Global disaster alerts', value: gdacs ? alerts.length : null, updated: gdacs?.fetchedAt, detail: 'Geolocated alerts in the current GDACS feed', tone: 'critical', icon: '!' },
    { source: 'USGS', label: 'Earthquakes on world map', value: earthquakes ? quakes.length : null, updated: earthquakes?.fetchedAt, detail: 'M2.5+ events loaded from the past-day feed', tone: 'request', icon: '⌁' },
    { source: 'NASA EONET', label: 'Open natural events', value: nasa ? naturalEvents.length : null, updated: nasa?.fetchedAt, detail: 'Geolocated open events loaded from NASA', tone: 'resource', icon: '◎' },
    { source: 'OSIRIS', label: 'Additional hazard signals', value: hazards ? signals.length : null, updated: hazards?.fetchedAt, detail: 'Earthquake, fire and weather records on the map', tone: 'shelter', icon: '◌' },
  ];
  const available = cards.filter((card) => card.value !== null).length;
  return <section id="overview" className="global-disaster-summary" aria-label="Real-world disaster overview">
    <div className="incident-strip"><div><span className="live-tag"><i />WORLD DISASTER WATCH</span><h2>{title ?? (loading ? 'Loading worldwide disaster reports…' : available ? 'No geolocated events in the loaded feeds' : 'Worldwide disaster feeds unavailable')}</h2><p>{featuredSource ? `${featuredSource}${headline ? ` · ${headline.alertLevel.toUpperCase()} alert` : ''}${published ? ` · Reported ${time(published)}` : ''}` : 'Current public reports from the same sources as the world map.'}</p><div className="global-disaster-summary__actions"><a href="#global-map">View world disaster map ↓</a>{report && sourceLink(report) && <a href={sourceLink(report)} target="_blank" rel="noreferrer">Read source report ↗</a>}</div></div><div className="exercise-stat"><span>World map records</span><strong>{available ? alerts.length + quakes.length + naturalEvents.length + signals.length : '—'}</strong><small>{available}/4 feeds loaded</small></div></div>
    <div className="metrics-grid" aria-label="World disaster feed counts">{cards.map((card) => <article className="metric-card" key={card.source}><div className={`metric-icon metric-icon--${card.tone}`} aria-hidden="true">{card.icon}</div><p>{card.label}</p><strong>{card.value === null ? '—' : card.value.toLocaleString()}</strong><small>{card.detail}</small><small>{card.source} · {card.updated ? `Updated ${time(card.updated)}` : loading ? 'Connecting…' : 'Unavailable'}</small>{failedSources.includes(card.source) && card.updated && <small className="global-disaster-summary__stale">Refresh failed · showing last successful data</small>}</article>)}</div>
    <p className="global-disaster-summary__note">Refreshes every minute. Counts reflect the records loaded on the world map, not worldwide totals; sources may report overlapping events.</p>
  </section>;
}
