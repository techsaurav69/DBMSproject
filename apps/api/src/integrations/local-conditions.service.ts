import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

export type LocalConditions = {
  fetchedAt: string;
  timezone: string | null;
  weather: { temperatureC: number; humidityPercent: number; weatherCode: number | null; isDay: boolean | null; time: string } | null;
  airQuality: { usAqi: number; time: string } | null;
};
type Payload = { timezone?: string; current?: Record<string, unknown> };
const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value);

@Injectable()
export class LocalConditionsService {
  private readonly cache = new Map<string, { expires: number; value: LocalConditions }>();
  private readonly pending = new Map<string, Promise<LocalConditions>>();

  async current(latitude: number, longitude: number): Promise<LocalConditions> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new BadRequestException('Provide a valid live latitude and longitude.');
    // Round to a neighbourhood, consistent with the upstream model resolution.
    const lat = latitude.toFixed(3); const lon = longitude.toFixed(3); const key = `${lat},${lon}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.load(lat, lon).then((value) => {
      if (this.cache.size >= 200) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: Date.now() + (value.weather && value.airQuality ? 60000 : 15000), value });
      return value;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private async json(url: string): Promise<Payload> {
    const response = await fetch(url, { signal: AbortSignal.timeout(12000), headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error('Weather provider unavailable.');
    const payload: unknown = await response.json();
    if (!payload || typeof payload !== 'object') throw new Error('Unexpected provider response.');
    return payload as Payload;
  }

  private timestamp(value: unknown): string | null {
    return numeric(value) && value > 0 && value < 8640000000000 ? new Date(value * 1000).toISOString() : null;
  }

  private async load(latitude: string, longitude: string): Promise<LocalConditions> {
    const query = `latitude=${latitude}&longitude=${longitude}&timezone=auto&timeformat=unixtime`;
    const [weatherResult, airResult] = await Promise.allSettled([
      this.json(`https://api.open-meteo.com/v1/forecast?${query}&current=temperature_2m,relative_humidity_2m,weather_code,is_day&forecast_days=1`),
      this.json(`https://air-quality-api.open-meteo.com/v1/air-quality?${query}&current=us_aqi&forecast_days=1`),
    ]);
    const value: LocalConditions = { fetchedAt: new Date().toISOString(), timezone: null, weather: null, airQuality: null };
    for (const result of [weatherResult, airResult]) {
      if (result.status === 'fulfilled' && typeof result.value.timezone === 'string') {
        try { new Intl.DateTimeFormat('en', { timeZone: result.value.timezone }); value.timezone = result.value.timezone; } catch { /* Fall back to the device's timezone. */ }
      }
    }
    const weather = weatherResult.status === 'fulfilled' ? weatherResult.value.current : undefined;
    const weatherTime = this.timestamp(weather?.time);
    if (weather && weatherTime && numeric(weather.temperature_2m) && numeric(weather.relative_humidity_2m) && weather.relative_humidity_2m >= 0 && weather.relative_humidity_2m <= 100) {
      value.weather = { temperatureC: weather.temperature_2m, humidityPercent: weather.relative_humidity_2m, weatherCode: numeric(weather.weather_code) ? weather.weather_code : null, isDay: weather.is_day === 1 ? true : weather.is_day === 0 ? false : null, time: weatherTime };
    }
    const air = airResult.status === 'fulfilled' ? airResult.value.current : undefined;
    const airTime = this.timestamp(air?.time);
    if (air && airTime && numeric(air.us_aqi) && air.us_aqi >= 0) value.airQuality = { usAqi: air.us_aqi, time: airTime };
    if (!value.weather && !value.airQuality) throw new ServiceUnavailableException('Local weather and AQI are temporarily unavailable. Please try refreshing.');
    return value;
  }
}
