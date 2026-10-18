type LeafletMap = { remove: () => void; fitBounds: (bounds: unknown, options?: { padding?: [number, number] }) => void; setView: (center: [number, number], zoom: number) => LeafletMap };
type LeafletLayer = { addTo: (map: LeafletMap) => LeafletLayer; bindTooltip: (content: string, options?: { direction?: string }) => LeafletLayer; on: (event: 'click', handler: () => void) => LeafletLayer };

declare global {
  interface Window {
    L?: {
      circleMarker: (position: [number, number], options: { color: string; fillColor: string; fillOpacity: number; radius: number; weight: number }) => LeafletLayer;
      polyline: (positions: Array<[number, number]>, options: { color: string; dashArray?: string; opacity?: number; weight: number }) => LeafletLayer;
      latLngBounds: (positions: Array<[number, number]>) => unknown;
      map: (element: HTMLElement, options?: { zoomControl?: boolean }) => LeafletMap;
      tileLayer: (url: string, options: { attribution: string; maxZoom: number }) => LeafletLayer;
    };
  }
}

export {};
