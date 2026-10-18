import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('returns a successful status when the database is reachable', async () => {
    const database = { query: jest.fn().mockResolvedValue({}) };
    await expect(new HealthController(database as never).getHealth()).resolves.toEqual({
      status: 'ok',
      service: 'crisisgrid-api',
      database: 'reachable',
    });
    expect(database.query).toHaveBeenCalledWith('SELECT 1');
  });
});

