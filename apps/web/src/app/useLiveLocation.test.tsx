import { act, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useLiveLocation } from './useLiveLocation';

afterEach(() => vi.unstubAllGlobals());
describe('shared live location', () => {
  it('updates the location from GPS and stops watching on unmount', () => {
    let update!: PositionCallback;
    const clearWatch = vi.fn();
    const watchPosition = vi.fn((callback: PositionCallback) => { update = callback; return 7; });
    vi.stubGlobal('navigator', { geolocation: { watchPosition, clearWatch } });
    const { result, unmount } = renderHook(useLiveLocation);
    expect(result.current.position).toBeNull();
    act(() => update({ coords: { latitude: 12.897812, longitude: 77.676212 } } as GeolocationPosition));
    expect(result.current.position).toEqual({ latitude: 12.8978, longitude: 77.6762 });
    unmount();
    expect(clearWatch).toHaveBeenCalledWith(7);
  });
  it('shows a permission error rather than a fictional location', () => {
    let fail!: PositionErrorCallback;
    vi.stubGlobal('navigator', { geolocation: { watchPosition: vi.fn((_success: PositionCallback, failure: PositionErrorCallback) => { fail = failure; return 8; }), clearWatch: vi.fn() } });
    const { result, unmount } = renderHook(useLiveLocation);
    act(() => fail({ code: 1 } as GeolocationPositionError));
    expect(result.current.position).toBeNull();
    expect(result.current.error).toContain('Allow location access');
    unmount();
  });
});
