import { NearbyServicesService } from './nearby-services.service';

describe('NearbyServicesService', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });

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
    await expect(new NearbyServicesService().search(12, 77, 5000)).rejects.toThrow('could not be loaded');
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
});
