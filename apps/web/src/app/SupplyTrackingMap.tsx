import { useEffect, useRef, useState } from 'react';
import type { SupplyTracking } from '../lib/api';

export function SupplyTrackingMap({ tracking }: { tracking: SupplyTracking }): React.ReactElement {
  const elementRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(Boolean(window.L));
  useEffect(() => { if (window.L) return; const timer = window.setTimeout(() => setIsReady(Boolean(window.L)), 600); return () => window.clearTimeout(timer); }, []);
  useEffect(() => {
    const element = elementRef.current; const leaflet = window.L;
    if (!element || !leaflet || !tracking.assignments.length) return;
    const map = leaflet.map(element, { zoomControl: true }).setView([tracking.assignments[0].originLatitude, tracking.assignments[0].originLongitude], 13);
    leaflet.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '&copy; OpenStreetMap contributors', maxZoom: 19 }).addTo(map);
    const points: Array<[number, number]> = [];
    tracking.assignments.forEach((item) => {
      const origin: [number, number] = [item.originLatitude, item.originLongitude]; const current: [number, number] = [item.currentLatitude, item.currentLongitude]; const destination: [number, number] = [item.destinationLatitude, item.destinationLongitude];
      points.push(origin, current, destination);
      leaflet.polyline([origin, destination], { color: '#6e9c91', dashArray: '7 8', weight: 3, opacity: .72 }).addTo(map);
      leaflet.polyline([origin, current], { color: '#2bb391', weight: 4, opacity: .95 }).addTo(map);
      leaflet.circleMarker(origin, { color: '#fff', fillColor: '#6c7f7a', fillOpacity: 1, radius: 6, weight: 2 }).addTo(map).bindTooltip(`${item.registrationCode} · departure point`);
      leaflet.circleMarker(current, { color: '#fff', fillColor: '#f0a43a', fillOpacity: 1, radius: 9, weight: 2 }).addTo(map).bindTooltip(`${item.registrationCode} · ${item.status.replaceAll('_', ' ')}`);
      leaflet.circleMarker(destination, { color: '#fff', fillColor: '#d25362', fillOpacity: 1, radius: 7, weight: 2 }).addTo(map).bindTooltip(`Destination · ${item.destinationLabel ?? 'location pending'}`);
    });
    map.fitBounds(leaflet.latLngBounds(points), { padding: [36, 36] });
    return () => map.remove();
  }, [tracking]);
  if (!isReady) return <div className="map-fallback supply-map"><span>↗</span><strong>Map provider is unavailable</strong><p>Delivery status remains visible in the tracking list.</p></div>;
  if (!tracking.assignments.length) return <div className="map-fallback supply-map"><span>▣</span><strong>No active supply delivery</strong><p>Dispatch a vehicle and reserve supplies to see its simulated local route here.</p></div>;
  return <div ref={elementRef} className="supply-map" aria-label="Map showing simulated supply-delivery routes" />;
}
