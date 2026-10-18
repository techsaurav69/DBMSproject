import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export type WeatherSnapshot = {
  advisory: true; fetchedAt: string; locationLabel: string; source: 'Open-Meteo';
  precipitationMm: number; riskLevel: 'low' | 'medium' | 'high'; riskSummary: string; temperatureC: number; weatherCode: number; windKph: number;
};
export type AdvisoryEarthquakeFeed = {
  advisory: true; events: Array<{ id: string; latitude: number | null; longitude: number | null; magnitude: number | null; place: string; time: string; url: string }>; fetchedAt: string; source: 'USGS';
};
export type OsirisHazards = {
  advisory: true;
  events: Array<{ kind: 'earthquake' | 'fire' | 'weather'; latitude: number; longitude: number; severity: string; sourceUrl: string | null; summary: string; time: string | null }>;
  fetchedAt: string;
  source: 'OSIRIS Intelligence';
  stats: { fires: number; incidents: number; weather: number };
};
export type NasaNaturalEvents = {
  advisory: true;
  events: Array<{ category: string; id: string; latitude: number | null; longitude: number | null; sourceUrl: string; time: string | null; title: string }>;
  fetchedAt: string;
  source: 'NASA EONET';
};
export type GdacsEvents = {
  advisory: true;
  events: Array<{ alertLevel: 'green' | 'orange' | 'red' | 'unknown'; eventType: string; id: string; latitude: number | null; longitude: number | null; sourceUrl: string; time: string | null; title: string }>;
  fetchedAt: string;
  source: 'GDACS';
};

type CacheEntry<T> = { expiresAt: number; value: T };

@Injectable()
export class IntegrationsService {
  private readonly cache = new Map<string, CacheEntry<WeatherSnapshot | AdvisoryEarthquakeFeed | OsirisHazards | NasaNaturalEvents | GdacsEvents>>();

  async weather(): Promise<WeatherSnapshot> {
    return this.cached('weather', 10 * 60_000, async () => {
      const payload = await this.fetchJson<{ current?: { precipitation?: number; temperature_2m?: number; weather_code?: number; wind_speed_10m?: number } }>(
        'https://api.open-meteo.com/v1/forecast?latitude=12.9200&longitude=77.5800&current=temperature_2m,weather_code,wind_speed_10m,precipitation&wind_speed_unit=kmh',
      );
      if (typeof payload.current?.temperature_2m !== 'number' || typeof payload.current.weather_code !== 'number' || typeof payload.current.wind_speed_10m !== 'number') {
        throw new ServiceUnavailableException('The advisory weather feed returned an unexpected response.');
      }
      const precipitationMm = payload.current.precipitation ?? 0;
      const weatherCode = payload.current.weather_code;
      const windKph = payload.current.wind_speed_10m;
      const high = weatherCode >= 95 || windKph >= 55 || precipitationMm >= 12;
      const medium = weatherCode >= 61 || windKph >= 35 || precipitationMm >= 4;
      const riskLevel = high ? 'high' : medium ? 'medium' : 'low';
      const riskSummary = high ? 'Elevated weather exposure: verify field conditions before deployment.' : medium ? 'Changing weather conditions: monitor outdoor and travel activities.' : 'No elevated condition is indicated by this advisory snapshot.';
      return { advisory: true, fetchedAt: new Date().toISOString(), locationLabel: 'Fictional Northbank operations point', source: 'Open-Meteo', precipitationMm, riskLevel, riskSummary, temperatureC: payload.current.temperature_2m, weatherCode, windKph };
    }) as Promise<WeatherSnapshot>;
  }

  async earthquakes(): Promise<AdvisoryEarthquakeFeed> {
    return this.cached('earthquakes', 5 * 60_000, async () => {
      const payload = await this.fetchJson<{ features?: Array<{ geometry?: { coordinates?: unknown }; id?: string; properties?: { mag?: number; place?: string; time?: number; url?: string } }> }>(
        'https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/2.5_day.geojson',
      );
      const events = (payload.features ?? []).slice(0, 12).map((feature) => {
        const coordinates = feature.geometry?.coordinates;
        const longitude = Array.isArray(coordinates) && typeof coordinates[0] === 'number' ? coordinates[0] : null;
        const latitude = Array.isArray(coordinates) && typeof coordinates[1] === 'number' ? coordinates[1] : null;
        return {
        id: feature.id ?? crypto.randomUUID(), latitude, longitude, magnitude: feature.properties?.mag ?? null,
        place: feature.properties?.place ?? 'Location unavailable', time: new Date(feature.properties?.time ?? Date.now()).toISOString(),
        url: feature.properties?.url ?? 'https://earthquake.usgs.gov/earthquakes/feed/v1.0/',
      }; });
      return { advisory: true, events, fetchedAt: new Date().toISOString(), source: 'USGS' };
    }) as Promise<AdvisoryEarthquakeFeed>;
  }

  async osirisHazards(): Promise<OsirisHazards> {
    return this.cached('osiris-hazards', 60_000, async () => {
      const [stats, earthquakes, fires, weather] = await Promise.all([
        this.fetchJson<{ stats?: { fires?: number; incidents?: number; weather?: number } }>('https://osirisai.live/api/stats'),
        this.fetchJson<{ earthquakes?: Array<{ id?: string; lat?: number; lng?: number; magnitude?: number; place?: string; time?: number; url?: string; alert?: string | null }> }>('https://osirisai.live/api/earthquakes'),
        this.fetchJson<{ fires?: Array<{ lat?: number; lng?: number; confidence?: string; date?: string; time?: string; frp?: number }> }>('https://osirisai.live/api/fires'),
        this.fetchJson<{ events?: Array<{ id?: string; title?: string; lat?: number; lng?: number; severity?: string; date?: string; source?: string }> }>('https://osirisai.live/api/weather'),
      ]);
      const events: OsirisHazards['events'] = [
        ...(earthquakes.earthquakes ?? []).filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number').slice(0, 3).map((item) => ({ kind: 'earthquake' as const, latitude: item.lat!, longitude: item.lng!, severity: item.alert ?? (item.magnitude && item.magnitude >= 5 ? 'high' : 'medium'), sourceUrl: item.url ?? null, summary: `M${item.magnitude ?? '—'} · ${item.place ?? 'Location unavailable'}`, time: item.time ? new Date(item.time).toISOString() : null })),
        ...(fires.fires ?? []).filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number').slice(0, 3).map((item) => ({ kind: 'fire' as const, latitude: item.lat!, longitude: item.lng!, severity: item.confidence === 'high' ? 'high' : 'medium', sourceUrl: null, summary: `Fire hotspot · FRP ${item.frp ?? '—'}`, time: item.date ? new Date(`${item.date}T${item.time?.padStart(4, '0').slice(0, 2) ?? '00'}:${item.time?.padStart(4, '0').slice(2) ?? '00'}:00Z`).toISOString() : null })),
        ...(weather.events ?? []).filter((item) => typeof item.lat === 'number' && typeof item.lng === 'number').slice(0, 3).map((item) => ({ kind: 'weather' as const, latitude: item.lat!, longitude: item.lng!, severity: item.severity ?? 'medium', sourceUrl: item.source ?? null, summary: item.title ?? 'Weather event', time: item.date ?? null })),
      ];
      return { advisory: true, events, fetchedAt: new Date().toISOString(), source: 'OSIRIS Intelligence', stats: { fires: Number(stats.stats?.fires ?? 0), incidents: Number(stats.stats?.incidents ?? 0), weather: Number(stats.stats?.weather ?? 0) } };
    }) as Promise<OsirisHazards>;
  }

  async nasaNaturalEvents(): Promise<NasaNaturalEvents> {
    return this.cached('nasa-eonet', 5 * 60_000, async () => {
      const payload = await this.fetchJson<{ events?: Array<{ id?: string; title?: string; link?: string; categories?: Array<{ title?: string }>; geometry?: Array<{ coordinates?: unknown; date?: string }> }> }>(
        'https://eonet.gsfc.nasa.gov/api/v3/events?status=open&limit=8',
      );
      const events = (payload.events ?? []).map((event) => {
        const geometry = [...(event.geometry ?? [])].reverse().find((item) => Array.isArray(item.coordinates) && typeof item.coordinates[0] === 'number' && typeof item.coordinates[1] === 'number');
        const coordinates = geometry?.coordinates as number[] | undefined;
        return {
          id: event.id ?? crypto.randomUUID(), title: event.title ?? 'Natural event', category: event.categories?.[0]?.title ?? 'Natural event',
          sourceUrl: event.link ?? 'https://eonet.gsfc.nasa.gov/', latitude: coordinates?.[1] ?? null, longitude: coordinates?.[0] ?? null, time: geometry?.date ?? null,
        };
      });
      return { advisory: true, events, fetchedAt: new Date().toISOString(), source: 'NASA EONET' };
    }) as Promise<NasaNaturalEvents>;
  }

  async gdacsEvents(): Promise<GdacsEvents> {
    return this.cached('gdacs-events', 5 * 60_000, async () => {
      const payload = await this.fetchJson<{ features?: Array<{ geometry?: { coordinates?: unknown }; id?: string; properties?: Record<string, unknown> }> }>(
        'https://www.gdacs.org/gdacsapi/api/events/geteventlist/events4app',
      );
      const events = (payload.features ?? []).slice(0, 24).map((feature) => {
        const properties = feature.properties ?? {};
        const [longitude, latitude] = this.pointCoordinates(feature.geometry?.coordinates) ?? [null, null];
        const eventType = this.textValue(properties.eventtype) ?? this.textValue(properties.eventType) ?? 'Natural hazard';
        const title = this.textValue(properties.name) ?? this.textValue(properties.title) ?? `${eventType} event`;
        const eventId = this.textValue(properties.eventid) ?? feature.id ?? crypto.randomUUID();
        const suppliedLevel = (this.textValue(properties.alertlevel) ?? this.textValue(properties.alertLevel) ?? 'unknown').toLowerCase();
        const alertLevel: GdacsEvents['events'][number]['alertLevel'] = suppliedLevel === 'red' || suppliedLevel === 'orange' || suppliedLevel === 'green' ? suppliedLevel : 'unknown';
        const sourceUrl = this.reportUrl(properties.url) ?? `https://www.gdacs.org/report.aspx?eventid=${encodeURIComponent(eventId)}&eventtype=${encodeURIComponent(eventType)}`;
        const rawTime = this.textValue(properties.fromdate) ?? this.textValue(properties.todate) ?? this.textValue(properties.datetime);
        const parsedTime = rawTime && !Number.isNaN(Date.parse(rawTime)) ? new Date(rawTime).toISOString() : null;
        return { alertLevel, eventType, id: eventId, latitude, longitude, sourceUrl, time: parsedTime, title };
      });
      return { advisory: true, events, fetchedAt: new Date().toISOString(), source: 'GDACS' };
    }) as Promise<GdacsEvents>;
  }

  private pointCoordinates(value: unknown): [number, number] | null {
    if (!Array.isArray(value)) return null;
    if (typeof value[0] === 'number' && typeof value[1] === 'number') return Math.abs(value[0]) <= 180 && Math.abs(value[1]) <= 90 ? [value[0], value[1]] : null;
    for (const child of value) {
      const point = this.pointCoordinates(child);
      if (point) return point;
    }
    return null;
  }

  private textValue(value: unknown): string | null {
    if (typeof value === 'number' && Number.isFinite(value)) return String(value);
    return typeof value === 'string' && value.trim() ? value.trim() : null;
  }

  private reportUrl(value: unknown): string | null {
    if (typeof value === 'string') return this.textValue(value);
    if (!value || typeof value !== 'object') return null;
    return this.textValue((value as Record<string, unknown>).report);
  }

  private async cached<T extends WeatherSnapshot | AdvisoryEarthquakeFeed | OsirisHazards | NasaNaturalEvents | GdacsEvents>(key: string, ttlMs: number, load: () => Promise<T>): Promise<T> {
    const cached = this.cache.get(key);
    if (cached && cached.expiresAt > Date.now()) return cached.value as T;
    const value = await load();
    this.cache.set(key, { value, expiresAt: Date.now() + ttlMs });
    return value;
  }

  private async fetchJson<T>(url: string): Promise<T> {
    try {
      const response = await fetch(url, { headers: { Accept: 'application/json' }, signal: AbortSignal.timeout(7_000) });
      if (!response.ok) throw new Error(`Feed returned ${response.status}`);
      return await response.json() as T;
    } catch {
      throw new ServiceUnavailableException('The external advisory feed is currently unavailable. Local CrisisGrid data remains available.');
    }
  }
}
