/* Run after npm run build: verifies the real service against an isolated, rolled-back schema. */
require('dotenv').config();
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { readFileSync } = require('node:fs');
const { Pool } = require('pg');
const { CommunityService } = require('../apps/api/dist/community/community.service');

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL and the provider CA before verifying community persistence.');
  const url = new URL(process.env.DATABASE_URL);
  for (const key of ['sslmode', 'sslrootcert', 'sslcert', 'sslkey']) url.searchParams.delete(key);
  const ca = process.env.DATABASE_SSL_CA_FILE ? readFileSync(process.env.DATABASE_SSL_CA_FILE, 'utf8') : process.env.DATABASE_SSL_CA_PEM?.replace(/\\n/g, '\n');
  const pool = new Pool({ connectionString: url.toString(), ssl: { rejectUnauthorized: true, ...(ca ? { ca } : {}) } });
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const schema = `community_verify_${randomUUID().replaceAll('-', '')}`;
    await client.query(`CREATE SCHEMA "${schema}"`);
    await client.query(`SET LOCAL search_path TO "${schema}", public`);
    await client.query('CREATE TABLE users (id uuid PRIMARY KEY, display_name text NOT NULL)');
    await client.query('CREATE TABLE audit_logs (actor_id uuid REFERENCES users(id), action text, entity_type text, entity_id uuid, details jsonb)');
    await client.query(readFileSync('database/migrations/011_community_aid.sql', 'utf8'));
    await client.query(readFileSync('database/migrations/012_community_approval_and_chat.sql', 'utf8'));
    const owner = { sub: randomUUID(), email: 'owner@example.test', roles: ['citizen'] };
    const member = { sub: randomUUID(), email: 'member@example.test', roles: ['citizen'] };
    const coordinator = { sub: randomUUID(), email: 'coordinator@example.test', roles: ['coordinator'] };
    for (const [user, name] of [[owner, 'Owner'], [member, 'Member'], [coordinator, 'Coordinator']]) await client.query('INSERT INTO users VALUES ($1, $2)', [user.sub, name]);
    let sequence = 0;
    const database = {
      query: (sql, values) => client.query(sql, values),
      connect: async () => {
        const savepoint = `service_${++sequence}`;
        return { release: () => {}, query: async (sql, values) => {
          if (sql === 'BEGIN') return client.query(`SAVEPOINT ${savepoint}`);
          if (sql === 'COMMIT') return client.query(`RELEASE SAVEPOINT ${savepoint}`);
          if (sql === 'ROLLBACK') return client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          return client.query(sql, values);
        } };
      },
    };
    const service = new CommunityService(database);
    const logo = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a5ioAAAAASUVORK5CYII=';
    const group = await service.createGroup(owner, { name: 'Verification aid', focusArea: 'food', summary: 'Neighbourhood support verification', location: 'Test locality', logo, qr: logo, qrCaption: 'Volunteer registration' });
    assert.equal(group.status, 'pending'); assert.equal(group.joined, true);
    assert.equal((await service.overview(member)).groups.length, 0);
    assert.equal((await service.overview(owner)).groups.length, 1);
    assert.equal((await service.overview(coordinator)).groups.length, 1);
    await assert.rejects(service.group(member, group.id), /not found/);
    await assert.rejects(service.image(member, group.id, 'qr'), /not found/);
    await assert.rejects(service.joinGroup(owner, group.id), /approval/);
    await assert.rejects(service.sendMessage(owner, group.id, 'Not approved yet'), /Join/);
    await assert.rejects(service.review(owner, group.id, { status: 'approved' }), /Only coordinators/);
    assert.equal((await service.review(coordinator, group.id, { status: 'approved' })).status, 'approved');
    await assert.rejects(service.messages(coordinator, group.id), /Join/);
    await assert.rejects(service.sendMessage(member, group.id, 'Not a member'), /Join/);
    await service.joinGroup(member, group.id);
    const sent = await service.sendMessage(member, group.id, 'A persisted member message');
    assert.equal((await service.messages(owner, group.id)).items[0].body, sent.body);
    assert.equal((await service.messages(owner, group.id)).items[0].mine, false);
    // Populate older history in one query to verify stable 50-message pagination.
    await client.query(`INSERT INTO community_messages (group_id, author_id, body, created_at) SELECT $1, $2, 'Earlier message ' || n, now() - n * interval '1 second' FROM generate_series(1, 55) n`, [group.id, owner.sub]);
    const first = await service.messages(member, group.id);
    assert.equal(first.items.length, 50); assert.equal(first.hasMore, true);
    const older = await service.messages(member, group.id, first.items[0].id);
    assert.equal(older.items.length, 6); assert.equal(older.hasMore, false);
    assert.equal(new Set([...first.items, ...older.items].map((item) => item.id)).size, 56);
    assert.equal((await service.image(owner, group.id, 'logo')).dataUrl, logo);
    await assert.rejects(service.updateMedia(member, group.id, { qrCaption: 'Unauthorized' }), /Only the community owner/);
    await service.updateMedia(coordinator, group.id, { logo: null, qrCaption: 'Updated purpose' });
    assert.equal((await service.group(member, group.id)).hasLogo, false);
    assert.equal((await service.image(member, group.id, 'qr')).dataUrl, logo);
    await service.pin(owner, group.id, 'Volunteer meeting tomorrow');
    assert.equal((await service.group(member, group.id)).announcement, 'Volunteer meeting tomorrow');
    await assert.rejects(service.pin(member, group.id, 'Unauthorized'), /Only the owner/);
    await service.pin(coordinator, group.id, '');
    assert.equal((await service.group(member, group.id)).announcement, '');
    await service.createPledge(member, group.id, { contributionKind: 'volunteer_time', quantity: 2, unitLabel: 'hours', details: 'Available tomorrow' });
    assert.equal((await service.overview(member)).pledges.length, 1);
    const rejected = await service.createGroup(owner, { name: 'Rejected aid', focusArea: 'other', summary: 'A separate review request', location: 'Test locality' });
    const review = await service.review(coordinator, rejected.id, { status: 'rejected', reason: 'Needs clearer location details' });
    assert.equal(review.rejectionReason, 'Needs clearer location details');
    assert.equal((await service.overview(member)).groups.length, 1);
    console.log('PASS: pending privacy, approval/rejection, membership, persistent chat/pagination, image permissions/storage, announcements and Offer help.');
  } finally {
    await client.query('ROLLBACK'); client.release(); await pool.end();
    console.log('Verification schema and fixtures rolled back; existing community data untouched.');
  }
}
main().catch((error) => { console.error(error.message); process.exitCode = 1; });
