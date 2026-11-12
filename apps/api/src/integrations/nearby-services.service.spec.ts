import { NearbyServicesService } from './nearby-services.service';

describe('NearbyServicesService', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; jest.restoreAllMocks(); });

  it('rejects invalid coordinates and unbounded radii before contacting the provider', async () => {
    const fetchMock = jest.fn(); global.fetch = fetchMock;
    const service = new NearbyServicesService();
    await expect(service.search(NaN, 77, 5000)).rejects.toThrow('valid coordinates');
    await expect(service.search(12, 77, 500000)).rejects.toThrow('valid coordinates');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('sorts results by distance, filters out-of-radius centres, and caches results', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [
      { type: 'node', id: 1, lat: 0.005, lon: 0, tags: { amenity: 'police', name: 'Police' } },
      { type: 'way', id: 2, center: { lat: 0, lon: 0 }, tags: { amenity: 'hospital', name: 'Hospital', phone: '123' } },
      { type: 'node', id: 3, lat: 1, lon: 0, tags: { amenity: 'hospital' } },
    ] }) });
    global.fetch = fetchMock;
    const service = new NearbyServicesService();
    const result = await service.search(0, 0, 1000);
    expect(result.items.map((item) => item.name)).toEqual(['Hospital', 'Police']);
    expect(result.items[0].distanceMeters).toBe(0);
    expect(result.items[1].distanceMeters).toBeGreaterThan(500);
    await service.search(0, 0, 1000);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('reports upstream timeouts as unavailable rather than empty results', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('timeout'));
    await expect(new NearbyServicesService().search(12, 77, 5000)).rejects.toThrow('temporarily unavailable');
  });

  it('uses the second provider when the first rejects the request', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: false, status: 406 }).mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [] }) });
    global.fetch = fetchMock;
    await expect(new NearbyServicesService().search(12, 77, 5000)).resolves.toMatchObject({ items: [] });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).not.toBe(fetchMock.mock.calls[1][0]);
  });

  it('requests hospitals only and returns more than sixty nearby hospitals', async () => {
    const elements = Array.from({ length: 75 }, (_, id) => ({ type: 'node', id, lat: 12, lon: 77, tags: { amenity: 'hospital', name: `Hospital ${id}` } }));
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ elements }) });
    global.fetch = fetchMock;
    const result = await new NearbyServicesService().search(12, 77, 5000, 'hospital');
    expect(result.items).toHaveLength(75);
    const query = new URL(fetchMock.mock.calls[0][0]).searchParams.get('data');
    expect(query).toContain('amenity="hospital"');
    expect(query).not.toContain('police');
  });

  it('narrows a successful 5 km search to 2 km without contacting the provider again', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [
      { type: 'node', id: 1, lat: 0.005, lon: 0, tags: { amenity: 'hospital', name: 'Near hospital' } },
      { type: 'node', id: 2, lat: 0.03, lon: 0, tags: { amenity: 'hospital', name: 'Far hospital' } },
    ] }) });
    global.fetch = fetchMock;
    const service = new NearbyServicesService();
    expect((await service.search(0, 0, 5000, 'hospital')).items).toHaveLength(2);
    const smaller = await service.search(0, 0, 2000, 'hospital');
    expect(smaller.items.map((item) => item.name)).toEqual(['Near hospital']);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([1000, 2000, 5000, 10000])('returns real regional directory entries within %i metres during a provider outage', async (radius) => {
    global.fetch = jest.fn().mockRejectedValue(new Error('provider offline'));
    const result = await new NearbyServicesService().search(12.97, 77.59, radius, 'hospital');
    expect(result.mode).toBe('directory');
    expect(result.source).toBe('Overture Maps Places');
    expect(result.dataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.items.every((item) => item.category === 'hospital' && item.name.length > 0 && item.distanceMeters <= radius && item.id.startsWith('overture/'))).toBe(true);
    expect(result.notice).toContain('directory dated');
  });

  it('does not present missing snapshot categories as an empty successful search', async () => {
    global.fetch = jest.fn().mockRejectedValue(new Error('provider offline'));
    await expect(new NearbyServicesService().search(12.97, 77.59, 2000, 'ambulance_station')).rejects.toThrow('temporarily unavailable');
  });

  it('retains the original successful search timestamp during a later outage', async () => {
    const fetchMock = jest.fn().mockResolvedValueOnce({ ok: true, json: async () => ({ elements: [{ type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'hospital', name: 'Existing hospital' } }] }) }).mockRejectedValue(new Error('offline'));
    global.fetch = fetchMock;
    const service = new NearbyServicesService();
    const first = await service.search(0, 0, 1000, 'hospital');
    const later = Date.now() + 6 * 60000;
    jest.spyOn(Date, 'now').mockReturnValue(later);
    const result = await service.search(0, 0, 1000, 'hospital');
    expect(result.mode).toBe('cached');
    expect(result.fetchedAt).toBe(first.fetchedAt);
    expect(result.items[0].name).toBe('Existing hospital');
  });

  it('deduplicates concurrent identical searches and excludes wrong-category records', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ elements: [
      { type: 'node', id: 1, lat: 0, lon: 0, tags: { amenity: 'hospital', name: 'Hospital' } },
      { type: 'way', id: 2, center: { lat: 0, lon: 0 }, tags: { amenity: 'hospital', name: 'Hospital' } },
      { type: 'node', id: 3, lat: 0, lon: 0, tags: { amenity: 'police', name: 'Police' } },
    ] }) });
    global.fetch = fetchMock;
    const service = new NearbyServicesService();
    const [first, second] = await Promise.all([service.search(0, 0, 1000, 'hospital'), service.search(0, 0, 1000, 'hospital')]);
    expect(first.items.map((item) => item.name)).toEqual(['Hospital']);
    expect(second).toEqual(first);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const query = new URL(fetchMock.mock.calls[0][0]).searchParams.get('data');
    expect(query).not.toContain('around:');
  });
});
