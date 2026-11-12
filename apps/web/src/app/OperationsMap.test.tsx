import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import type { OperationsOverview } from '../lib/api';
import { OperationsMap } from './OperationsMap';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); delete window.L; });
it('centres a selected SOS on its reported place rather than the viewer GPS position', () => {
  vi.stubGlobal('localStorage', { getItem: () => null });
  const map = { setView: vi.fn().mockReturnThis(), fitBounds: vi.fn().mockReturnThis(), getCenter: () => ({ lat: 27.92, lng: 85.16 }), on: vi.fn(), remove: vi.fn() };
  const layer = { addTo: vi.fn().mockReturnThis(), bindTooltip: vi.fn().mockReturnThis(), on: vi.fn().mockReturnThis() };
  window.L = { map: vi.fn().mockReturnValue(map), tileLayer: vi.fn().mockReturnValue(layer), circleMarker: vi.fn().mockReturnValue(layer), latLngBounds: vi.fn() } as unknown as NonNullable<Window['L']>;
  const overview: OperationsOverview = { generatedAt: new Date().toISOString(), activeDisaster: null, incidents: [], requests: [], resources: [], summary: { activeAssignments: 0, availableShelterSpaces: 0, availableSupplyUnits: 0, availableVehicles: 0, openIncidents: 0, openRequests: 0 } };
  render(<OperationsMap overview={overview} location={{ position: { latitude: 12.97, longitude: 77.59 }, error: '', retry: vi.fn() }} focus={{ latitude: 27.92, longitude: 85.16, label: 'Nuwakot', incidentId: 'incident', requestId: 'request' }} onClearFocus={vi.fn()} />);
  expect(map.setView).toHaveBeenLastCalledWith([27.92, 85.16], 14);
  expect(screen.getByText('Nuwakot')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Return to live location' })).toBeInTheDocument();
});
