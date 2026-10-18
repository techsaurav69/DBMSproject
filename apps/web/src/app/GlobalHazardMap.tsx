import { useEffect, useRef, useState } from 'react';
import type { AdvisoryEarthquakes, GdacsEvents, NasaNaturalEvents, OsirisHazards } from '../lib/api';

type Props = { earthquakes: AdvisoryEarthquakes | null; gdacsEvents: GdacsEvents | null; hazards: OsirisHazards | null; nasaEvents: NasaNaturalEvents | null };

const markerStyle = {
  earthquake: { fillColor: '#8265d4', label: 'Earthquake signal' },
  fire: { fillColor: '#e66d45', label: 'Fire hotspot signal' },
  weather: { fillColor: '#2d91bd', label: 'Weather-event signal' },
} as const;

export function GlobalHazardMap({ earthquakes, gdacsEvents, hazards, nasaEvents }: Props): React.ReactElement {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(Boolean(window.L));

  useEffect(() => {
    if (window.L) return;
    const timer = window.setTimeout(() => setIsReady(Boolean(window.L)), 600);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    const element = elementRef.current;
    const leaflet = window.L;
    const liveEvents = [
      ...(hazards?.events ?? []).map((event) => ({ kind: event.kind, latitude: event.latitude, longitude: event.longitude, label: `${event.summary} · OSIRIS`, source: 'OSIRIS' })),
      ...(earthquakes?.events ?? []).filter((event) => event.latitude !== null && event.longitude !== null).map((event) => ({ kind: 'earthquake' as const, latitude: event.latitude!, longitude: event.longitude!, label: `M${event.magnitude?.toFixed(1) ?? '—'} · ${event.place} · USGS`, source: 'USGS' })),
      ...(gdacsEvents?.events ?? []).filter((event) => event.latitude !== null && event.longitude !== null).map((event) => ({ kind: 'gdacs' as const, latitude: event.latitude!, longitude: event.longitude!, label: `${event.title} · GDACS ${event.alertLevel.toUpperCase()} alert`, severity: event.alertLevel, source: 'GDACS' })),
      ...(nasaEvents?.events ?? []).filter((event) => event.latitude !== null && event.longitude !== null).map((event) => ({ kind: 'nasa' as const, latitude: event.latitude!, longitude: event.longitude!, label: `${event.category} · ${event.title} · NASA EONET`, source: 'NASA EONET' })),
    ];
    if (!element || !leaflet || !liveEvents.length) return;

    const map = leaflet.map(element, { zoomControl: true }).setView([20, 0], 2);
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors', maxZoom: 19,
    }).addTo(map);

    const points: Array<[number, number]> = [];
    liveEvents.forEach((event) => {
      const position: [number, number] = [event.latitude, event.longitude];
      points.push(position);
      const style = event.kind === 'nasa' ? { fillColor: '#3d9cc4', label: 'NASA natural event' } : event.kind === 'gdacs' ? { fillColor: event.severity === 'red' ? '#d64d5d' : event.severity === 'orange' ? '#e68b3f' : '#72aa65', label: 'GDACS disaster alert' } : markerStyle[event.kind];
      leaflet.circleMarker(position, { color: '#f7fbfa', fillColor: style.fillColor, fillOpacity: 0.96, radius: 8, weight: 2 })
        .addTo(map)
        .bindTooltip(event.label, { direction: 'top' });
    });
    if (points.length > 1) map.fitBounds(leaflet.latLngBounds(points), { padding: [55, 55] });
    return () => map.remove();
  }, [earthquakes, gdacsEvents, hazards, nasaEvents]);

  if (!isReady) return <div className="map-fallback global-map-fallback"><span>◌</span><strong>Global map provider is unavailable</strong><p>The public signal list remains available below.</p></div>;
  if (!hazards?.events.length && !earthquakes?.events.length && !gdacsEvents?.events.length && !nasaEvents?.events.length) return <div className="map-fallback global-map-fallback"><span>◌</span><strong>Global signals are unavailable</strong><p>Use Refresh signals to request a new advisory snapshot.</p></div>;
  return <div ref={elementRef} className="global-hazard-map" aria-label="World map showing external public disaster and hazard signals" />;
}
