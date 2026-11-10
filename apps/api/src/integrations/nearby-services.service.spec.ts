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
});
