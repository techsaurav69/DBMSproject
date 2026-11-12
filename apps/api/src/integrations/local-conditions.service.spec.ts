import { BadRequestException, ServiceUnavailableException } from '@nestjs/common';
import { LocalConditionsService } from './local-conditions.service';

describe('Live location conditions', () => {
  const epoch = Math.floor(Date.now() / 1000);
  const weather = { timezone: 'Asia/Kolkata', current: { time: epoch, temperature_2m: 23.5, relative_humidity_2m: 78, is_day: 0, weather_code: 2 } };
  const air = { timezone: 'Asia/Kolkata', current: { time: epoch, us_aqi: 82 } };
  let fetchMock: jest.SpyInstance;
  beforeEach(() => {
    fetchMock = jest.spyOn(globalThis, 'fetch').mockImplementation(async (url) => ({ ok: true, json: async () => String(url).includes('air-quality-api') ? air : weather }) as Response);
  });
  afterEach(() => jest.restoreAllMocks());
  it('requests both feeds for the supplied location and preserves source timestamps', async () => {
    const result = await new LocalConditionsService().current(12.9876, 77.5432);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    for (const [url] of fetchMock.mock.calls) { expect(String(url)).toContain('latitude=12.988&longitude=77.543'); expect(String(url)).toContain('timeformat=unixtime'); }
    expect(result.weather).toMatchObject({ temperatureC: 23.5, humidityPercent: 78, isDay: false, time: new Date(epoch * 1000).toISOString() });
    expect(result.airQuality?.usAqi).toBe(82);
    expect(result.timezone).toBe('Asia/Kolkata');
  });
  it.each([[NaN, 77], [91, 77], [12, 181]])('rejects invalid coordinates without calling a provider', async (lat, lon) => {
    await expect(new LocalConditionsService().current(lat, lon)).rejects.toBeInstanceOf(BadRequestException);
    expect(fetchMock).not.toHaveBeenCalled();
  });
  it('caches and deduplicates only the same neighbourhood', async () => {
    const service = new LocalConditionsService();
    await Promise.all([service.current(12.98, 77.54), service.current(12.98, 77.54)]);
    await service.current(12.98, 77.54);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    await service.current(13.0, 77.6);
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });
  it('continues weather when AQI is unavailable', async () => {
    fetchMock.mockImplementation(async (url) => { if (String(url).includes('air-quality-api')) throw new Error('Offline'); return { ok: true, json: async () => weather } as Response; });
    const result = await new LocalConditionsService().current(12, 77);
    expect(result.weather?.humidityPercent).toBe(78);
    expect(result.airQuality).toBeNull();
  });
  it('does not turn missing data into zero readings', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({ current: { time: epoch, temperature_2m: null, relative_humidity_2m: null, us_aqi: null } }) } as Response);
    await expect(new LocalConditionsService().current(12, 77)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
