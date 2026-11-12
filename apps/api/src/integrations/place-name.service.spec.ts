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
});
