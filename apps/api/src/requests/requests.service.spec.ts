import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { RequestsService } from './requests.service';

describe('Assistance request deletion', () => {
  const actor: AuthenticatedUser = { sub: 'coordinator-id', email: 'coordinator@example.test', roles: ['coordinator'] };
  const record = { id: 'request-id', category: 'medical', status: 'open', description: 'Test request', people_count: 1, severity: 'high', created_at: new Date() };
  let client: { query: jest.Mock; release: jest.Mock };
  let database: { connect: jest.Mock };
  let service: RequestsService;

  beforeEach(() => {
    client = { query: jest.fn().mockResolvedValue({ rows: [] }), release: jest.fn() };
    database = { connect: jest.fn().mockResolvedValue(client) };
    service = new RequestsService(database as never);
  });

  function requestResult(status = 'open', linked = false): void {
    client.query.mockResolvedValueOnce({ rows: [] })
      .mockResolvedValueOnce({ rows: [{ ...record, status }] })
      .mockResolvedValueOnce({ rows: [{ linked }] });
  }

  it.each(['administrator', 'citizen', 'provider_operator', 'responder'] as const)('rejects %s accounts before accessing the database', async (role) => {
    await expect(service.remove({ ...actor, roles: [role] }, record.id)).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.connect).not.toHaveBeenCalled();
  });

  it.each(['open', 'triaged'])('deletes an unassigned %s request with an audit snapshot', async (status) => {
    requestResult(status);
    await expect(service.remove(actor, record.id)).resolves.toEqual({ deleted: true });
    const statements = client.query.mock.calls.map(([sql]) => sql as string);
    expect(statements[1]).toContain('FOR UPDATE');
    expect(statements[2]).toContain('shelter_reservations');
    expect(client.query).toHaveBeenCalledWith(expect.stringContaining("'request_deleted'"), [actor.sub, record.id, JSON.stringify({ ...record, status })]);
    expect(client.query).toHaveBeenCalledWith('DELETE FROM emergency_requests WHERE id = $1', [record.id]);
    expect(statements.at(-1)).toBe('COMMIT');
    expect(statements.some((sql) => sql.includes('DELETE FROM emergency_incidents'))).toBe(false);
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('protects requests linked to assignments or reservations', async () => {
    requestResult('open', true);
    await expect(service.remove(actor, record.id)).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('DELETE'), expect.anything());
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('protects assigned requests', async () => {
    requestResult('assigned');
    await expect(service.remove(actor, record.id)).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).not.toHaveBeenCalledWith(expect.stringContaining('DELETE'), expect.anything());
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('returns not found and rolls back a missing request', async () => {
    await expect(service.remove(actor, record.id)).rejects.toBeInstanceOf(NotFoundException);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('rolls back the audit entry if deletion encounters a foreign-key conflict', async () => {
    requestResult();
    client.query.mockResolvedValueOnce({ rows: [] }).mockRejectedValueOnce({ code: '23503' });
    await expect(service.remove(actor, record.id)).rejects.toBeInstanceOf(ConflictException);
    expect(client.query).toHaveBeenLastCalledWith('ROLLBACK');
    expect(client.release).toHaveBeenCalledTimes(1);
  });
});
