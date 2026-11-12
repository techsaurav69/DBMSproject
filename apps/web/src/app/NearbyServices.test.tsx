import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, ApiRequestError } from '../lib/api';
import { NearbyServices } from './NearbyServices';

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal('localStorage', { getItem: (key: string) => storage.get(key) ?? null, setItem: (key: string, value: string) => storage.set(key, value), clear: () => storage.clear() });
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); vi.useRealTimers(); });
it('keeps service results without a timed refresh after five minutes', async () => {
  vi.useFakeTimers();
  const search = vi.spyOn(api, 'nearbyServices').mockResolvedValue({ items: [], source: 'OpenStreetMap', fetchedAt: '2026-11-12T10:00:00Z' });
  const position = { latitude: 12.8978, longitude: 77.6762 };
  render(<NearbyServices accessToken="test-token" centre={position} location={{ position, placeName: 'Kasavanahalli, Bengaluru', error: '', retry: vi.fn() }} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(search).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Kasavanahalli, Bengaluru/)).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(5 * 60000); });
  expect(search).toHaveBeenCalledTimes(1);
  expect(screen.queryByText(/Auto-refresh every minute/)).not.toBeInTheDocument();
});

const position = { latitude: 12.97, longitude: 77.59 };
const props = { accessToken: 'test-token', centre: position, location: { position, error: '', retry: vi.fn() } };
const hospital = { id: 'node/1', name: 'Real saved hospital', category: 'hospital', latitude: 12.97, longitude: 77.59, distanceMeters: 500, address: 'City centre', phone: null };

it('restores the last real results after a reload when the provider is offline', async () => {
  vi.useFakeTimers();
  const search = vi.spyOn(api, 'nearbyServices').mockResolvedValueOnce({ items: [hospital], source: 'OpenStreetMap', fetchedAt: new Date().toISOString() }).mockRejectedValue(new ApiRequestError('Provider unavailable'));
  render(<NearbyServices {...props} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(screen.getByText('Real saved hospital')).toBeInTheDocument();
  cleanup();
  render(<NearbyServices {...props} />);
  expect(screen.getByText('Real saved hospital')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(search).toHaveBeenCalledTimes(2);
  expect(screen.getByText(/Showing the last successful results/)).toBeInTheDocument();
  expect(screen.getByText('Real saved hospital')).toBeInTheDocument();
});

it('filters saved wider results to the exact selected radius', async () => {
  vi.useFakeTimers();
  const search = vi.spyOn(api, 'nearbyServices').mockResolvedValue({ items: [hospital, { ...hospital, id: 'node/2', name: 'Far hospital', distanceMeters: 3000 }], source: 'OpenStreetMap', fetchedAt: new Date().toISOString() });
  render(<NearbyServices {...props} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(screen.getByText('Far hospital')).toBeInTheDocument();
  fireEvent.change(screen.getByLabelText('Search radius'), { target: { value: '2000' } });
  expect(screen.getByText('Real saved hospital')).toBeInTheDocument();
  expect(screen.queryByText('Far hospital')).not.toBeInTheDocument();
  expect(search).toHaveBeenCalledTimes(1);
});

it('labels dated directory results instead of presenting them as live', async () => {
  vi.useFakeTimers();
  vi.spyOn(api, 'nearbyServices').mockResolvedValue({ items: [hospital], source: 'Overture Maps Places', fetchedAt: new Date().toISOString(), mode: 'directory', dataDate: '2026-10-21', notice: 'Live providers unavailable. Directory dated 2026-10-21.' });
  render(<NearbyServices {...props} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(500); });
  expect(screen.getByText('Real saved hospital')).toBeInTheDocument();
  expect(screen.getByText(/Directory dated 2026-10-21/)).toBeInTheDocument();
});
