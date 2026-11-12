import { ForbiddenException, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { CommunityService } from './community.service';
import { decodeCommunityImage } from './community-image';

describe('Community permissions and storage', () => {
  const actor: AuthenticatedUser = { sub: 'member', email: 'member@example.test', roles: ['citizen'] };
  const row = { id: 'group', created_by: 'owner', creator_name: 'Owner', name: 'Local aid', focus_area: 'food', summary: 'Food for neighbours', location: 'Bengaluru', status: 'approved', created_at: new Date(), member_count: '2', pledge_count: '0', joined: false, has_logo: false, has_qr: false, qr_caption: '', media_version: 1, announcement: '', announcement_at: null, rejection_reason: null };
  let database: { query: jest.Mock; connect: jest.Mock };
  let service: CommunityService;
  beforeEach(() => { database = { query: jest.fn().mockResolvedValue({ rows: [row] }), connect: jest.fn() }; service = new CommunityService(database as never); });

  it('filters private groups and their offers by requester/coordinator in SQL', async () => {
    database.query.mockResolvedValue({ rows: [] });
    await service.overview(actor);
    for (const [sql, values] of database.query.mock.calls) {
      expect(sql).toContain("g.status = 'approved' OR g.created_by = $1 OR $2::boolean");
      expect(values).toEqual([actor.sub, false]);
    }
  });
  it('does not disclose a hidden pending group through its details endpoint', async () => {
    database.query.mockResolvedValue({ rows: [] });
    await expect(service.group(actor, 'private-group')).rejects.toBeInstanceOf(NotFoundException);
    expect(database.query).toHaveBeenCalledWith(expect.stringContaining("g.status = 'approved' OR g.created_by = $1 OR $3::boolean"), [actor.sub, 'private-group', false]);
  });
  it.each(['administrator', 'citizen', 'responder', 'provider_operator'] as const)('rejects approval by a %s', async (role) => {
    await expect(service.review({ ...actor, roles: [role] }, 'group', { status: 'approved' })).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.connect).not.toHaveBeenCalled();
  });
  it('blocks reading and sending messages for nonmembers, including coordinators', async () => {
    for (const user of [actor, { ...actor, roles: ['coordinator'] } as AuthenticatedUser]) {
      await expect(service.messages(user, 'group')).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.sendMessage(user, 'group', 'Hello')).rejects.toBeInstanceOf(ForbiddenException);
    }
    expect(database.query.mock.calls.every(([sql]) => !sql.includes('FROM community_messages') && !sql.includes('INSERT INTO community_messages'))).toBe(true);
  });
  it('blocks founder chat and joins before community approval', async () => {
    database.query.mockResolvedValue({ rows: [{ ...row, created_by: actor.sub, joined: true, status: 'pending' }] });
    await expect(service.messages(actor, 'group')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.sendMessage(actor, 'group', 'Hello')).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.joinGroup(actor, 'group')).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('blocks nonowners from changing images or pinning announcements', async () => {
    await expect(service.updateMedia(actor, 'group', {})).rejects.toBeInstanceOf(ForbiddenException);
    await expect(service.pin(actor, 'group', 'Update')).rejects.toBeInstanceOf(ForbiddenException);
    expect(database.connect).not.toHaveBeenCalled();
  });
  it('requires membership for support offers', async () => {
    await expect(service.createPledge(actor, 'group', { contributionKind: 'volunteer_time', quantity: 1, unitLabel: 'hour', details: 'Available tomorrow' })).rejects.toBeInstanceOf(ForbiddenException);
  });
  it('loads member history in pages and marks the sender correctly', async () => {
    database.query.mockResolvedValueOnce({ rows: [{ ...row, joined: true }] }).mockResolvedValueOnce({ rows: [{ id: 'message', body: 'Hello', author_id: actor.sub, sender_name: 'Member', created_at: new Date() }] });
    const result = await service.messages(actor, 'group');
    expect(result.items[0]).toMatchObject({ body: 'Hello', mine: true, senderName: 'Member' });
    expect(database.query.mock.calls[1][0]).toContain('LIMIT 51');
  });
});

describe('Community image validation', () => {
  const png = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ioAAAAASUVORK5CYII=';
  it('accepts a valid raster image', () => { expect(decodeCommunityImage(png).mime).toBe('image/png'); });
  it.each(['data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=', 'data:image/png;base64,PGh0bWw+bm90IGFuIGltYWdlPC9odG1sPg==', png.replace('image/png', 'image/jpeg')])('rejects active content and mismatched types', (value) => { expect(() => decodeCommunityImage(value)).toThrow(); });
  it('rejects oversized images', () => { expect(() => decodeCommunityImage(`data:image/png;base64,${Buffer.alloc(524289).toString('base64')}`)).toThrow('512 KB'); });
});
