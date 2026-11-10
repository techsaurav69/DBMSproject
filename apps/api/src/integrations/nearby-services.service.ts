import { BadRequestException, Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';

type Place = { id: string; name: string; category: string; latitude: number; longitude: number; distanceMeters: number; address: string; phone: string | null };
type Result = { items: Place[]; source: string; fetchedAt: string };
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

@Injectable()
export class NearbyServicesService {
  private readonly logger = new Logger(NearbyServicesService.name);
  private readonly cache = new Map<string, { expires: number; result: Result }>();

  async search(latitude: number, longitude: number, radius: number, category = 'all'): Promise<Result> {
    const amenities = ['hospital', 'clinic', 'police', 'fire_station'];
    const emergencies = ['ambulance_station', 'rescue_station', 'disaster_response', 'lifeguard'];
    if (!['all', ...amenities, ...emergencies].includes(category)) throw new BadRequestException('Choose a valid service type.');
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || ![1000, 2000, 5000, 10000].includes(radius)) {
      throw new BadRequestException('Choose valid coordinates and a radius of 1, 2, 5, or 10 km.');
    }
    const key = `${latitude},${longitude},${radius},${category}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.result;
    // A wider successful search already contains every result for a smaller
    // radius. Avoid another slow provider query when narrowing the search.
    for (const [candidateKey, candidate] of this.cache) {
      const [lat, lon, coverage, type] = candidateKey.split(',');
      if (lat === String(latitude) && lon === String(longitude) && type === category && Number(coverage) >= radius && candidate.expires > Date.now()) {
        return { ...candidate.result, items: candidate.result.items.filter((item) => item.distanceMeters <= radius) };
      }
    }
    const coverageRadius = Math.max(5000, radius);
    const around = `(around:${coverageRadius},${latitude},${longitude})`;
    const selectors = category === 'all' ? `nwr[amenity~"^(hospital|clinic|police|fire_station)$"]${around};nwr[emergency~"^(ambulance_station|rescue_station|disaster_response|lifeguard)$"]${around};` : `nwr[${amenities.includes(category) ? 'amenity' : 'emergency'}="${category}"]${around};`;
    const query = `[out:json][timeout:20];${category === 'all' ? `(${selectors});` : selectors}out center tags;`;
    try {
      const payload = await this.fetchPlaces(query);
      const items: Place[] = [];
      for (const element of payload.elements) {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (lat == null || lon == null) continue;
        const tags = element.tags ?? {};
        const rad = Math.PI / 180;
        const a = Math.sin((lat - latitude) * rad / 2) ** 2 + Math.cos(latitude * rad) * Math.cos(lat * rad) * Math.sin((lon - longitude) * rad / 2) ** 2;
        const distanceMeters = Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a))));
        if (distanceMeters > coverageRadius) continue;
        const category = tags.amenity ?? tags.emergency ?? 'rescue_station';
        items.push({ id: `${element.type}/${element.id}`, name: tags.name ?? tags['name:en'] ?? category.replaceAll('_', ' '), category, latitude: lat, longitude: lon, distanceMeters, address: tags['addr:full'] ?? [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '), phone: tags.phone ?? tags['contact:phone'] ?? null });
      }
      const result = { items: items.sort((a, b) => a.distanceMeters - b.distanceMeters), source: 'OpenStreetMap / Overpass', fetchedAt: new Date().toISOString() };
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(`${latitude},${longitude},${coverageRadius},${category}`, { expires: Date.now() + 5 * 60000, result });
      return { ...result, items: result.items.filter((item) => item.distanceMeters <= radius) };
    } catch {
      throw new ServiceUnavailableException('Nearby services could not be loaded. Please try searching again.');
    }
  }

  private async fetchPlaces(query: string): Promise<{ elements: Element[] }> {
    // Allow time for public query queues; keep both attempts below the
    // deployment's 60-second execution limit, including cold startup.
    const endpoints = ['https://maps.mail.ru/osm/tools/overpass/api/interpreter', 'https://overpass.private.coffee/api/interpreter'];
    for (const endpoint of endpoints) {
      try {
        const response = await fetch(`${endpoint}?${new URLSearchParams({ data: query })}`, { headers: { Accept: 'application/json', 'User-Agent': 'CrisisGrid/1.0 (https://crisisgrid-murex.vercel.app)' }, signal: AbortSignal.timeout(25000) });
        if (!response.ok) { this.logger.warn(`Nearby provider ${new URL(endpoint).hostname} returned HTTP ${response.status}`); continue; }
        const payload = await response.json() as { elements?: Element[]; remark?: string };
        if (Array.isArray(payload.elements) && !payload.remark) return { elements: payload.elements };
      } catch (error) {
        const failure = error as { name?: string; cause?: { code?: string } };
        this.logger.warn(`Nearby provider ${new URL(endpoint).hostname} failed: ${failure.name ?? 'error'} ${failure.cause?.code ?? ''}`);
      }
    }
    throw new Error('All nearby-service providers are unavailable');
  }
}
