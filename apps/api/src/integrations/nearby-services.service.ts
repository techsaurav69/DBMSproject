import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

type Place = { id: string; name: string; category: string; latitude: number; longitude: number; distanceMeters: number; address: string; phone: string | null };
type Result = { items: Place[]; source: string; fetchedAt: string };
type Element = { type: string; id: number; lat?: number; lon?: number; center?: { lat: number; lon: number }; tags?: Record<string, string> };

@Injectable()
export class NearbyServicesService {
  private readonly cache = new Map<string, { expires: number; result: Result }>();

  async search(latitude: number, longitude: number, radius: number): Promise<Result> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180 || ![1000, 2000, 5000, 10000].includes(radius)) {
      throw new BadRequestException('Choose valid coordinates and a radius of 1, 2, 5, or 10 km.');
    }
    const key = `${latitude},${longitude},${radius}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return cached.result;
    const around = `(around:${radius},${latitude},${longitude})`;
    const query = `[out:json][timeout:18];(nwr[amenity~"^(hospital|clinic|police|fire_station)$"]${around};nwr[emergency~"^(ambulance_station|rescue_station|disaster_response|lifeguard)$"]${around};);out center tags;`;
    try {
      const response = await fetch('https://overpass-api.de/api/interpreter', { method: 'POST', body: new URLSearchParams({ data: query }), signal: AbortSignal.timeout(22000) });
      if (!response.ok) throw new Error('Upstream unavailable');
      const payload = await response.json() as { elements?: Element[]; remark?: string };
      if (!Array.isArray(payload.elements) || payload.remark) throw new Error('Incomplete response');
      const items: Place[] = [];
      for (const element of payload.elements) {
        const lat = element.lat ?? element.center?.lat;
        const lon = element.lon ?? element.center?.lon;
        if (lat == null || lon == null) continue;
        const tags = element.tags ?? {};
        const rad = Math.PI / 180;
        const a = Math.sin((lat - latitude) * rad / 2) ** 2 + Math.cos(latitude * rad) * Math.cos(lat * rad) * Math.sin((lon - longitude) * rad / 2) ** 2;
        const distanceMeters = Math.round(6371000 * 2 * Math.asin(Math.sqrt(Math.min(1, a))));
        if (distanceMeters > radius) continue;
        const category = tags.amenity ?? tags.emergency ?? 'rescue_station';
        items.push({ id: `${element.type}/${element.id}`, name: tags.name ?? tags['name:en'] ?? category.replaceAll('_', ' '), category, latitude: lat, longitude: lon, distanceMeters, address: tags['addr:full'] ?? [tags['addr:housenumber'], tags['addr:street'], tags['addr:suburb'], tags['addr:city']].filter(Boolean).join(', '), phone: tags.phone ?? tags['contact:phone'] ?? null });
      }
      const result = { items: items.sort((a, b) => a.distanceMeters - b.distanceMeters).slice(0, 60), source: 'OpenStreetMap / Overpass', fetchedAt: new Date().toISOString() };
      if (this.cache.size >= 100) this.cache.delete(this.cache.keys().next().value!);
      this.cache.set(key, { expires: Date.now() + 5 * 60000, result });
      return result;
    } catch {
      throw new ServiceUnavailableException('Nearby services could not be loaded. Please try searching again.');
    }
  }
}
