import type { AuthenticatedUser } from '../auth/auth.types';
import { SosService } from './sos.service';

describe('SOS location and transaction', () => {
  const actor: AuthenticatedUser = { sub: 'reporter', email: 'reporter@example.test', roles: ['citizen'] };
  const dto = { emergencyType: 'flood' as const, category: 'rescue' as const, severity: 'high' as const, description: 'Rescue assistance is needed', locationLabel: 'Reported place', latitude: 27.92, longitude: 85.16, peopleCount: 4, locationSource: 'manual' as const };
  it('matches the disaster by actual geography and records a notification-producing SOS event atomically', async () => {
    const client = { release: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [] }) };
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [{ id: 'location' }] }).mockResolvedValueOnce({ rows: [{ id: 'incident' }] }).mockResolvedValueOnce({ rows: [{ id: 'request' }] });
    const service = new SosService({ connect: async () => client } as never);
    await expect(service.create(actor, dto)).resolves.toEqual({ incidentId: 'incident', requestId: 'request', status: 'open' });
    expect(client.query.mock.calls[1][0]).toContain('ST_Covers');
    expect(client.query.mock.calls[1][1]).toEqual([85.16, 27.92, 'flood']);
    expect(client.query.mock.calls[2][1]).toEqual(['Reported place', null, 85.16, 27.92, 'manual']);
    expect(client.query.mock.calls[3][1][0]).toBeNull();
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'sos_created'"), ['request', actor.sub]);
    expect(client.query).toHaveBeenLastCalledWith('COMMIT');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
  it('rolls back instead of recording a partial SOS when a write fails', async () => {
    const client = { release: jest.fn(), query: jest.fn().mockResolvedValue({ rows: [] }) };
    client.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce(new Error('Write failed'));
    await expect(new SosService({ connect: async () => client } as never).create(actor, dto)).rejects.toThrow('Write failed');
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
