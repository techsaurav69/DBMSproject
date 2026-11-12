import { act, cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api } from '../lib/api';
import { NearbyServices } from './NearbyServices';

afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });
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
