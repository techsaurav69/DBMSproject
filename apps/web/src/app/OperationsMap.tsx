import { useEffect, useMemo, useRef, useState } from 'react';
import type { OperationsOverview } from '../lib/api';
import { IncidentChat } from './IncidentChat';

type Props = { overview: OperationsOverview };
type Selection = { kind: 'incident'; value: OperationsOverview['incidents'][number] } | { kind: 'resource'; value: OperationsOverview['resources'][number] } | null;
const windows = [{ label: '1 hour', value: 1 }, { label: '24 hours', value: 24 }, { label: '7 days', value: 168 }, { label: 'All records', value: 8760 }];
function label(value: string): string { return value.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()); }

export function OperationsMap({ overview }: Props): React.ReactElement {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(Boolean(window.L));
  const [showIncidents, setShowIncidents] = useState(true);
  const [showResources, setShowResources] = useState(true);
  const [windowIndex, setWindowIndex] = useState(3);
  const [selection, setSelection] = useState<Selection>(null);
  const [chatIncident, setChatIncident] = useState<OperationsOverview['incidents'][number] | null>(null);
  const accessToken = localStorage.getItem('crisisgrid.local.auth-token');
  const visibleIncidents = useMemo(() => {
    const cutoff = Date.now() - windows[windowIndex].value * 60 * 60 * 1000;
    return overview.incidents.filter((incident) => new Date(incident.reportedAt).getTime() >= cutoff);
  }, [overview.incidents, windowIndex]);

  useEffect(() => { if (window.L) return; const timer = window.setTimeout(() => setIsReady(Boolean(window.L)), 600); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const element = elementRef.current; const leaflet = window.L;
    const incidents = showIncidents ? visibleIncidents : [];
    const resources = showResources ? overview.resources : [];
    if (!element || !leaflet || (!incidents.length && !resources.length)) return;
    const first = incidents[0] ?? resources[0];
    const map = leaflet.map(element, { zoomControl: false }).setView([first.latitude, first.longitude], 13);
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    const points: Array<[number, number]> = [];
    incidents.forEach((incident) => {
      const position: [number, number] = [incident.latitude, incident.longitude]; points.push(position);
      leaflet.circleMarker(position, { color: '#f7faf9', fillColor: incident.severity === 'critical' ? '#e85c68' : '#f4a340', fillOpacity: 1, radius: 8, weight: 2 }).addTo(map).bindTooltip(`${label(incident.emergencyType)} · ${incident.severity}`, { direction: 'top' }).on('click', () => setSelection({ kind: 'incident', value: incident }));
    });
    resources.forEach((resource) => {
      const position: [number, number] = [resource.latitude, resource.longitude]; points.push(position);
      leaflet.circleMarker(position, { color: '#e9fffa', fillColor: '#39c4a3', fillOpacity: 1, radius: 7, weight: 2 }).addTo(map).bindTooltip(`Available ${resource.vehicleType.replaceAll('_', ' ')}`, { direction: 'top' }).on('click', () => setSelection({ kind: 'resource', value: resource }));
    });
    if (points.length > 1) map.fitBounds(leaflet.latLngBounds(points), { padding: [40, 40] });
    return () => map.remove();
  }, [overview.resources, showIncidents, showResources, visibleIncidents]);

  return <><div className="operations-map-workspace"><div className="map-controls"><button type="button" className={showIncidents ? 'is-active' : ''} onClick={() => setShowIncidents((value) => !value)}>● Incidents</button><button type="button" className={showResources ? 'is-active' : ''} onClick={() => setShowResources((value) => !value)}>● Resources</button><label>Report window<input type="range" min="0" max="3" value={windowIndex} onChange={(event) => setWindowIndex(Number(event.target.value))} /><strong>{windows[windowIndex].label}</strong></label></div>{!isReady ? <div className="map-fallback"><span>⌁</span><strong>Map provider is unavailable</strong><p>Your operational data is still visible in the queues below.</p></div> : <div ref={elementRef} className="operations-map" aria-label="Interactive map showing fictional local incident and resource locations" />}{selection && <aside className="map-action-panel"><button type="button" className="map-action-panel__close" aria-label="Close map details" onClick={() => setSelection(null)}>×</button>{selection.kind === 'incident' ? <><p className="panel-kicker">INCIDENT SELECTED</p><h3>{label(selection.value.emergencyType)} · {label(selection.value.severity)}</h3><p>{selection.value.label ?? 'Location pending'}</p><small>{selection.value.description}</small><button type="button" onClick={() => setChatIncident(selection.value)}>Open coordination chat</button></> : <><p className="panel-kicker">RESOURCE SELECTED</p><h3>{selection.value.registrationCode}</h3><p>{label(selection.value.vehicleType)} · {selection.value.providerName}</p><small>Current local-demo availability: {label(selection.value.status)}.</small></>}</aside>}</div>{chatIncident && accessToken && <IncidentChat accessToken={accessToken} incident={chatIncident} onClose={() => setChatIncident(null)} />}</>;
}
