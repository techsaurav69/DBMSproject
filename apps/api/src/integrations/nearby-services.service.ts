import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

type Place = { id: string; name: string; category: string; latitude: number; longitude: number; distanceMeters: number; address: string; phone: string | null };
export type NearbyResult = { items: Place[]; source: string; fetchedAt: string; mode?: 'live' | 'cached' | 'directory'; dataDate?: string; notice?: string };
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };
type Directory = { source: string; release: string; bounds: number[]; items: Array<Omit<Place, 'distanceMeters'>> };
const amenities = ['hospital', 'clinic', 'police', 'fire_station'];
const emergencies = ['ambulance_station', 'rescue_station', 'disaster_response', 'lifeguard'];

@Injectable()
export class NearbyServicesService {
  private readonly logger = new Logger(NearbyServicesService.name);
  private readonly cache = new Map<string, { expires: number; result: NearbyResult }>();
  private readonly pending = new Map<string, Promise<NearbyResult>>();
  private providersRetryAt = 0;
  private readonly directory: Directory | null;

  constructor() {
    try { this.directory = JSON.parse(readFileSync(join(__dirname, 'data/bengaluru-services.json'), 'utf8')) as Directory; }
    catch { this.directory = null; this.logger.warn('Regional nearby directory not packaged; live providers remain available.'); }
  }

  async search(latitude: number, longitude: number, radius: number, category = 'all'): Promise<NearbyResult> {
    if (!['all', ...amenities, ...emergencies].includes(category)) throw new BadRequestException('Choose a valid service type.');
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180 || ![1000, 2000, 5000, 10000].includes(radius)) throw new BadRequestException('Choose valid coordinates and a radius of 1, 2, 5, or 10 km.');
    const key = `${latitude},${longitude},${radius},${category}`;
    let stale: NearbyResult | undefined;
    for (const [candidateKey, candidate] of this.cache) {
      const [lat, lon, coverage, type] = candidateKey.split(',');
      if (Number(lat) === latitude && Number(lon) === longitude && (type === category || type === 'all') && Number(coverage) >= radius) {
        const result = { ...candidate.result, items: candidate.result.items.filter((item) => item.distanceMeters <= radius && (category === 'all' || item.category === category)) };
        if (candidate.expires > Date.now()) return result;
        if (candidate.result.mode !== 'directory' && Date.now() - new Date(candidate.result.fetchedAt).getTime() < 86400000) stale = result;
      }
    }
    const pending = this.pending.get(key);
    if (pending) return pending;
    const request = this.load(latitude, longitude, radius, category, stale).then((result) => {
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: Date.now() + (result.mode === 'live' ? 300000 : 0), result });
      return result;
    }).finally(() => this.pending.delete(key));
    this.pending.set(key, request);
    return request;
  }

  private distance(latitude: number, longitude: number, lat: number, lon: number): number {
    const rad = Math.PI / 180;
    const a = Math.sin((lat - latitude) * rad / 2) ** 2 + Math.cos(latitude * rad) * Math.cos(lat * rad) * Math.sin((lon - longitude) * rad / 2) ** 2;
    return 6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a)));
  }

  private sorted(items: Place[]): Place[] {
    const unique: Place[] = [];
    for (const item of items.sort((a, b) => a.distanceMeters - b.distanceMeters)) {
      if (unique.some((other) => other.id === item.id || (other.name.toLowerCase().trim() === item.name.toLowerCase().trim() && other.category === item.category && this.distance(other.latitude, other.longitude, item.latitude, item.longitude) < 30))) continue;
      unique.push(item);
    }
    return unique;
  }

  private directoryResult(latitude: number, longitude: number, radius: number, category: string): NearbyResult | null {
    if (!this.directory) return null;
    const [west, south, east, north] = this.directory.bounds;
    const dy = radius / 110574; const dx = radius / (111320 * Math.max(.0001, Math.cos(latitude * Math.PI / 180)));
    // Never mistake a search outside the bundled region for an empty directory.
    if (longitude - dx < west || longitude + dx > east || latitude - dy < south || latitude + dy > north) return null;
    const items = this.directory.items.filter((item) => category === 'all' || item.category === category)
      .map((item) => ({ ...item, distanceMeters: this.distance(latitude, longitude, item.latitude, item.longitude) }))
      .filter((item) => item.distanceMeters <= radius);
    // The regional snapshot only covers these categories. Other categories must not
    // become a false 'no services' response when the live provider is unavailable.
    if (!['all', 'hospital', 'police', 'fire_station'].includes(category)) return null;
    const dataDate = this.directory.release.slice(0, 10);
    return { items: this.sorted(items), source: this.directory.source, mode: 'directory', dataDate, fetchedAt: new Date().toISOString(), notice: `Live map providers are unavailable. Showing the Bengaluru directory dated ${dataDate}, covering hospitals, police and fire stations. Listings may be incomplete; Refresh now retries the live search.` };
  }

  private async load(latitude: number, longitude: number, radius: number, category: string, stale?: NearbyResult): Promise<NearbyResult> {
    const dy = radius / 110574; const dx = radius / (111320 * Math.max(.0001, Math.cos(latitude * Math.PI / 180)));
    // A bounding box is cheaper for Overpass to evaluate. Apply exact circular
    // distance checks below, including when serving the regional directory.
    const box = `(${Math.max(-90, latitude - dy)},${Math.max(-180, longitude - dx)},${Math.min(90, latitude + dy)},${Math.min(180, longitude + dx)})`;
    const selectors = category === 'all'
      ? `nwr[amenity~"^(hospital|clinic|police|fire_station)$"]${box};nwr[emergency~"^(ambulance_station|rescue_station|disaster_response|lifeguard)$"]${box};`
      : `nwr[${amenities.includes(category) ? 'amenity' : 'emergency'}="${category}"]${box};`;
    const query = `[out:json][timeout:8];(${selectors});out center tags qt;`;
    try {
      const payload = await this.fetchPlaces(query);
      const items: Place[] = [];
      for (const element of payload.elements) {
        const lat = element.lat ?? element.center?.lat; const lon = element.lon ?? element.center?.lon;
        if (typeof lat !== 'number' || typeof lon !== 'number' || !Number.isFinite(lat) || !Number.isFinite(lon)) continue;
        const tags = element.tags ?? {}; const kind = tags.amenity ?? tags.emergency;
        if (!kind || ![...amenities, ...emergencies].includes(kind) || (category !== 'all' && kind !== category)) continue;
        const distanceMeters = this.distance(latitude, longitude, lat, lon);
        if (distanceMeters > radius) continue;
        items.push({ id: `${element.type}/${element.id}`, name: tags.name ?? tags['name:en'] ?? kind.replaceAll('_', ' '), category: kind, latitude: lat, longitude: lon, distanceMeters, address: tags['addr:full'] ?? [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '), phone: tags.phone ?? tags['contact:phone'] ?? null });
      }
      return { items: this.sorted(items), source: 'OpenStreetMap / Overpass', mode: 'live', fetchedAt: new Date().toISOString() };
    } catch {
      if (stale) return { ...stale, mode: 'cached', notice: 'Live map providers are unavailable. Showing the last successful search with its original timestamp.' };
      const directory = this.directoryResult(latitude, longitude, radius, category);
      if (directory) return directory;
      throw new ServiceUnavailableException('The public map providers are temporarily unavailable for this search. Please retry shortly or use the map-search link below.');
    }
  }

  private async fetchPlaces(query: string): Promise<{ elements: Element[] }> {
    if (Date.now() < this.providersRetryAt) throw new Error('Public providers are cooling down after an outage');
    const endpoints = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
    // Short sequential attempts respect public-provider capacity and keep the
    // entire request well below Vercel's execution limit. No retry storm.
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}?${new URLSearchParams({ data: query })}`, { headers: { Accept: 'application/json', 'User-Agent': 'CrisisGrid/1.0 (https://crisisgrid-murex.vercel.app)' }, signal: AbortSignal.timeout(10000) });
        if (!response.ok) { this.logger.warn(`Nearby provider ${new URL(endpoint).hostname} returned HTTP ${response.status}`); continue; }
        const payload = await response.json() as { elements?: Element[]; remark?: string };
        if (Array.isArray(payload?.elements) && !payload.remark) { this.providersRetryAt = 0; return { elements: payload.elements }; }
      } catch { this.logger.warn(`Nearby provider ${new URL(endpoint).hostname} unavailable`); }
    }
    this.providersRetryAt = Date.now() + 30000;
    throw new Error('Public nearby-service providers unavailable');
  }
}
