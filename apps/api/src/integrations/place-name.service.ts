import { BadRequestException, Injectable, ServiceUnavailableException } from '@nestjs/common';

@Injectable()
export class PlaceNameService {
  private readonly cache = new Map<string, { name: string; expires: number }>();
  private readonly pending = new Map<string, Promise<{ name: string; source: string }>>();
  private nextRequest = 0;
  private readonly searchCache = new Map<string, { items: Array<{ name: string; latitude: number; longitude: number }>; expires: number }>();

  async search(query: string): Promise<{ items: Array<{ name: string; latitude: number; longitude: number }> }> {
    const text = query?.trim();
    if (!text || text.length < 3 || text.length > 180) throw new BadRequestException('Enter a place name between 3 and 180 characters.');
    const key = text.toLowerCase();
    const cached = this.searchCache.get(key);
    if (cached && cached.expires > Date.now()) return { items: cached.items };
    const wait = Math.max(0, this.nextRequest - Date.now());
    if (wait > 3000) throw new ServiceUnavailableException('Place lookup is busy. Please retry shortly or enter coordinates manually.');
    this.nextRequest = Date.now() + wait + 1100;
    try {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
      const params = new URLSearchParams({ format: 'jsonv2', q: text, limit: '5', 'accept-language': 'en' });
      const response = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, { headers: { Accept: 'application/json', 'User-Agent': 'CrisisGrid/1.0 (https://crisisgrid-murex.vercel.app)' }, signal: AbortSignal.timeout(8000) });
      if (!response.ok) throw new Error('Unavailable');
      const payload: unknown = await response.json();
      if (!Array.isArray(payload)) throw new Error('Unexpected response');
      const items = payload.filter((item) => typeof item.display_name === 'string' && Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lon)) && Math.abs(Number(item.lat)) <= 90 && Math.abs(Number(item.lon)) <= 180)
        .slice(0, 5).map((item) => ({ name: String(item.display_name).slice(0, 180), latitude: Number(item.lat), longitude: Number(item.lon) }));
      if (this.searchCache.size >= 200) this.searchCache.delete(this.searchCache.keys().next().value!);
      this.searchCache.set(key, { items, expires: Date.now() + 86400000 });
      return { items };
    } catch { throw new ServiceUnavailableException('Place lookup is unavailable. Retry or enter the correct coordinates manually.'); }
  }

  async reverse(latitude: number, longitude: number): Promise<{ name: string; source: string }> {
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) throw new BadRequestException('Valid location coordinates are required.');
    const lat = latitude.toFixed(3); const lon = longitude.toFixed(3);
    const key = `${lat},${lon}`;
    const cached = this.cache.get(key);
    if (cached && cached.expires > Date.now()) return { name: cached.name, source: 'OpenStreetMap / Nominatim' };
    const existing = this.pending.get(key);
    if (existing) return existing;
    const wait = Math.max(0, this.nextRequest - Date.now());
    if (wait > 3000) throw new ServiceUnavailableException('Location lookup is busy. Coordinates remain available.');
    this.nextRequest = Date.now() + wait + 1100;
    const request = (async () => {
      try {
        if (wait) await new Promise((resolve) => setTimeout(resolve, wait));
        const params = new URLSearchParams({ format: 'jsonv2', lat, lon, zoom: '14', 'accept-language': 'en' });
        const response = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, { headers: { Accept: 'application/json', 'User-Agent': 'CrisisGrid/1.0 (https://crisisgrid-murex.vercel.app)' }, signal: AbortSignal.timeout(8000) });
        if (!response.ok) throw new Error('Place lookup unavailable');
        const data = await response.json() as { address?: Record<string, string>; display_name?: string };
        const a = data.address ?? {};
        const parts = [a.neighbourhood ?? a.suburb ?? a.village, a.city ?? a.town ?? a.municipality, a.state, a.country].filter(Boolean);
        const name = [...new Set(parts)].join(', ') || data.display_name;
        if (!name) throw new Error('Place not found');
        if (this.cache.size >= 1000) this.cache.delete(this.cache.keys().next().value!);
        this.cache.set(key, { name, expires: Date.now() + 86400000 });
        return { name, source: 'OpenStreetMap / Nominatim' };
      } catch { throw new ServiceUnavailableException('Place name is unavailable. Coordinates remain available.'); }
      finally { this.pending.delete(key); }
    })();
    this.pending.set(key, request);
    return request;
  }
}
