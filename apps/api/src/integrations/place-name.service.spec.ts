import { PlaceNameService } from './place-name.service';

describe('PlaceNameService', () => {
  const originalFetch = global.fetch;
  afterEach(() => { global.fetch = originalFetch; });
  it('returns a locality name and caches lookups within the same approximate location', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ address: { suburb: 'Kasavanahalli', city: 'Bengaluru', state: 'Karnataka', country: 'India' } }) });
    global.fetch = fetchMock;
    const service = new PlaceNameService();
    const result = await service.reverse(12.8978, 77.6762);
    expect(result.name).toBe('Kasavanahalli, Bengaluru, Karnataka, India');
    await service.reverse(12.89781, 77.67621);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('rejects invalid coordinates without calling a third party', async () => {
    global.fetch = jest.fn();
    await expect(new PlaceNameService().reverse(NaN, 77)).rejects.toThrow('Valid location');
    expect(global.fetch).not.toHaveBeenCalled();
  });
  it('searches an explicitly submitted place name and returns selectable coordinates', async () => {
    const fetchMock = jest.fn().mockResolvedValue({ ok: true, json: async () => [{ display_name: 'Nuwakot, Nepal', lat: '27.92', lon: '85.16' }] });
    global.fetch = fetchMock;
    const service = new PlaceNameService();
    const result = await service.search('Nuwakot Nepal');
    expect(result.items).toEqual([{ name: 'Nuwakot, Nepal', latitude: 27.92, longitude: 85.16 }]);
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('q')).toBe('Nuwakot Nepal');
    await service.search('Nuwakot Nepal');
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
  it('does not geocode short or empty text', async () => {
    global.fetch = jest.fn();
    await expect(new PlaceNameService().search(' ')).rejects.toThrow('place name');
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
