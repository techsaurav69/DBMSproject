import type { AuthenticatedUser } from '../auth/auth.types';
import { NotificationsService } from './notifications.service';

describe('SOS notifications', () => {
  const actor: AuthenticatedUser = { sub: 'reporter', email: 'reporter@example.test', roles: ['citizen'] };
  it('includes the saved place, request and incident for notification navigation', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [{ id: 'sos:request', kind: 'sos', severity: 'medium', title: 'New SOS request', message: 'Reported place needs rescue', timestamp: new Date(), read: false, latitude: 27.92, longitude: 85.16, location_label: 'Reported place', incident_id: 'incident', request_id: 'request' }] }) };
    const result = await new NotificationsService(database as never).list(actor);
    expect(result.items[0].location).toEqual({ latitude: 27.92, longitude: 85.16, label: 'Reported place', incidentId: 'incident', requestId: 'request' });
    expect(result.unreadCount).toBe(1);
    expect(database.query.mock.calls[0][1]).toEqual([actor.sub, false]);
    const sql = database.query.mock.calls[0][0] as string;
    expect(sql).toContain("re.event_type = 'sos_created'");
    expect(sql).not.toContain("r.urgency IN ('high', 'critical')");
    expect(sql).toContain('r.created_by = $1 OR $2::boolean');
  });
  it('allows coordination staff to receive SOS reports from other reporters', async () => {
    const database = { query: jest.fn().mockResolvedValue({ rows: [] }) };
    await new NotificationsService(database as never).list({ ...actor, roles: ['coordinator'] });
    expect(database.query.mock.calls[0][1]).toEqual([actor.sub, true]);
  });
});
