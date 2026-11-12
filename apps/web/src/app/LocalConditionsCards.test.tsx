import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { api, ApiRequestError, type LocalConditions } from '../lib/api';
import { LocalConditionsCards, aqiCategory } from './LocalConditionsCards';

const snapshot: LocalConditions = { timezone: 'Asia/Kolkata', fetchedAt: '2026-11-12T12:00:00Z', weather: { temperatureC: 24.3, humidityPercent: 76, weatherCode: 2, isDay: true, time: '2026-11-12T12:00:00Z' }, airQuality: { usAqi: 83, time: '2026-11-12T12:00:00Z' } };
const location = { position: { latitude: 12.9876, longitude: 77.5432 }, placeName: 'Bengaluru', error: '', retry: vi.fn() };
afterEach(() => { cleanup(); vi.restoreAllMocks(); vi.useRealTimers(); });

it('shows actual location readings with units, the AQI scale and source times', async () => {
  vi.spyOn(api, 'localConditions').mockResolvedValue(snapshot);
  render(<LocalConditionsCards accessToken="token" location={location} />);
  expect(await screen.findByText('24.3°C')).toBeInTheDocument();
  expect(screen.getByText('76%')).toBeInTheDocument();
  expect(screen.getByText('83')).toBeInTheDocument();
  expect(screen.getByText('Moderate')).toBeInTheDocument();
  expect(screen.getByText('Air quality · US AQI')).toBeInTheDocument();
  expect(api.localConditions).toHaveBeenCalledWith('token', 12.988, 77.543);
  expect(screen.getAllByText(/Data:/)).toHaveLength(3);
});
it('does not query a default city when location permission is denied', () => {
  const query = vi.spyOn(api, 'localConditions');
  render(<LocalConditionsCards accessToken="token" location={{ position: null, error: 'Allow location access.', retry: vi.fn() }} />);
  expect(query).not.toHaveBeenCalled();
  expect(screen.getByText('Allow location access.')).toBeInTheDocument();
  expect(screen.getAllByText('—')).toHaveLength(3);
});
it('shows available weather when AQI is unavailable', async () => {
  vi.spyOn(api, 'localConditions').mockResolvedValue({ ...snapshot, airQuality: null });
  render(<LocalConditionsCards accessToken="token" location={location} />);
  expect(await screen.findByText('24.3°C')).toBeInTheDocument();
  expect(screen.getByText(/AQI is temporarily unavailable/)).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});
it('clears the old location readings immediately when GPS moves', async () => {
  const query = vi.spyOn(api, 'localConditions').mockResolvedValueOnce(snapshot).mockImplementation(() => new Promise(() => {}));
  const view = render(<LocalConditionsCards accessToken="token" location={location} />);
  await screen.findByText('24.3°C');
  view.rerender(<LocalConditionsCards accessToken="token" location={{ ...location, position: { latitude: 14, longitude: 78 } }} />);
  expect(screen.queryByText('24.3°C')).not.toBeInTheDocument();
  await waitFor(() => expect(query).toHaveBeenLastCalledWith('token', 14, 78));
});
it('refreshes each minute and labels retained values when refresh fails', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T12:00:00Z'));
  const query = vi.spyOn(api, 'localConditions').mockResolvedValueOnce(snapshot).mockRejectedValueOnce(new ApiRequestError('Provider unavailable.'));
  render(<LocalConditionsCards accessToken="token" location={location} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(query).toHaveBeenCalledTimes(1);
  await act(async () => { await vi.advanceTimersByTimeAsync(60000); });
  expect(query).toHaveBeenCalledTimes(2);
  expect(screen.getByText('24.3°C')).toBeInTheDocument();
  expect(screen.getByText(/Showing last known values/)).toBeInTheDocument();
  expect(screen.getAllByText(/Last known · Data:/)).toHaveLength(3);
});
it('uses the location timezone and updates the weekday at midnight', async () => {
  vi.useFakeTimers(); vi.setSystemTime(new Date('2026-11-12T18:29:50Z'));
  vi.spyOn(api, 'localConditions').mockResolvedValue(snapshot);
  render(<LocalConditionsCards accessToken="token" location={location} />);
  await act(async () => { await vi.advanceTimersByTimeAsync(0); });
  expect(screen.getByText('Thursday')).toBeInTheDocument();
  await act(async () => { await vi.advanceTimersByTimeAsync(30000); });
  expect(screen.getByText('Friday')).toBeInTheDocument();
});
it('classifies US AQI boundary values consistently', () => {
  expect([50, 51, 100, 101, 150, 151, 200, 201, 300, 301].map(aqiCategory)).toEqual(['Good', 'Moderate', 'Moderate', 'Unhealthy for sensitive groups', 'Unhealthy for sensitive groups', 'Unhealthy', 'Unhealthy', 'Very unhealthy', 'Very unhealthy', 'Hazardous']);
});
