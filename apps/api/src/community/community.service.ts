import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CreateCommunityGroupDto } from './dto/create-community-group.dto';
import { CreateCommunityPledgeDto } from './dto/create-community-pledge.dto';
import { CommunityMediaDto, ReviewCommunityDto } from './dto/community-actions.dto';
import { decodeCommunityImage } from './community-image';

export type CommunityGroup = { createdAt: string; creatorName: string; focusArea: string; id: string; joined: boolean; memberCount: number; name: string; pledgeCount: number; summary: string; location: string; status: 'pending' | 'approved' | 'rejected'; rejectionReason: string | null; canManage: boolean; hasLogo: boolean; hasQr: boolean; qrCaption: string; mediaVersion: number; announcement: string; announcementAt: string | null };
export type CommunityPledge = { contributorName: string; createdAt: string; details: string; groupId: string; groupName: string; id: string; kind: string; quantity: number; unitLabel: string };
export type CommunityMessage = { id: string; body: string; senderName: string; createdAt: string; mine: boolean };
type GroupRow = { id: string; name: string; focus_area: string; summary: string; created_at: Date; creator_name: string; created_by: string; member_count: string; pledge_count: string; joined: boolean; location: string; status: CommunityGroup['status']; rejection_reason: string | null; has_logo: boolean; has_qr: boolean; qr_caption: string; media_version: number; announcement: string; announcement_at: Date | null };
const groupSelect = `SELECT g.*, creator.display_name AS creator_name,
  (SELECT count(*) FROM community_group_members m WHERE m.group_id = g.id)::text AS member_count,
  (SELECT count(*) FROM community_pledges p WHERE p.group_id = g.id)::text AS pledge_count,
  EXISTS (SELECT 1 FROM community_group_members mine WHERE mine.group_id = g.id AND mine.user_id = $1) AS joined,
  EXISTS (SELECT 1 FROM community_group_images i WHERE i.group_id = g.id AND i.kind = 'logo') AS has_logo,
  EXISTS (SELECT 1 FROM community_group_images i WHERE i.group_id = g.id AND i.kind = 'qr') AS has_qr
  FROM community_groups g JOIN users creator ON creator.id = g.created_by`;

@Injectable()
export class CommunityService {
  constructor(private readonly database: DatabaseService) {}
  private coordinator(actor: AuthenticatedUser): boolean { return actor.roles.includes('coordinator'); }
  private toGroup(row: GroupRow, actor: AuthenticatedUser): CommunityGroup {
    return { id: row.id, name: row.name, focusArea: row.focus_area, summary: row.summary, createdAt: row.created_at.toISOString(), creatorName: row.creator_name, memberCount: Number(row.member_count), pledgeCount: Number(row.pledge_count), joined: row.joined, location: row.location, status: row.status, rejectionReason: row.rejection_reason, canManage: row.created_by === actor.sub || this.coordinator(actor), hasLogo: row.has_logo, hasQr: row.has_qr, qrCaption: row.qr_caption, mediaVersion: row.media_version, announcement: row.announcement, announcementAt: row.announcement_at?.toISOString() ?? null };
  }
  private async transaction<T>(operation: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.database.connect();
    try { await client.query('BEGIN'); const result = await operation(client); await client.query('COMMIT'); return result; }
    catch (error: unknown) { await client.query('ROLLBACK'); if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23505') throw new ConflictException('A community with this name already exists.'); throw error; }
    finally { client.release(); }
  }
  async overview(actor: AuthenticatedUser): Promise<{ groups: CommunityGroup[]; pledges: CommunityPledge[]; canModerate: boolean }> {
    try {
      const [groups, pledges] = await Promise.all([
        this.database.query<GroupRow>(`${groupSelect} WHERE g.status = 'approved' OR g.created_by = $1 OR $2::boolean ORDER BY g.created_at DESC`, [actor.sub, this.coordinator(actor)]),
        this.database.query<{ contributor_name: string; created_at: Date; details: string; group_id: string; group_name: string; id: string; kind: string; quantity: string; unit_label: string }>(
          `SELECT p.id, p.group_id, g.name AS group_name, p.contribution_kind AS kind, p.quantity::text, p.unit_label, p.details, p.created_at, users.display_name AS contributor_name
           FROM community_pledges p JOIN community_groups g ON g.id = p.group_id JOIN users ON users.id = p.pledged_by
           WHERE g.status = 'approved' OR g.created_by = $1 OR $2::boolean ORDER BY p.created_at DESC LIMIT 24`, [actor.sub, this.coordinator(actor)]),
      ]);
      return { canModerate: this.coordinator(actor), groups: groups.rows.map((row) => this.toGroup(row, actor)), pledges: pledges.rows.map((row) => ({ id: row.id, groupId: row.group_id, groupName: row.group_name, kind: row.kind, quantity: Number(row.quantity), unitLabel: row.unit_label, details: row.details, createdAt: row.created_at.toISOString(), contributorName: row.contributor_name })) };
    } catch (error: unknown) {
      if (typeof error === 'object' && error !== null && 'code' in error && ['42703', '42P01'].includes(String(error.code))) throw new ServiceUnavailableException('Community storage needs migration 012_community_approval_and_chat.sql. Run npm run db:migrate before using community approvals and chat.');
      throw error;
    }
  }
  async group(actor: AuthenticatedUser, id: string): Promise<CommunityGroup> {
    const result = await this.database.query<GroupRow>(`${groupSelect} WHERE g.id = $2 AND (g.status = 'approved' OR g.created_by = $1 OR $3::boolean)`, [actor.sub, id, this.coordinator(actor)]);
    if (!result.rows[0]) throw new NotFoundException('Community not found.');
    return this.toGroup(result.rows[0], actor);
  }
  private images(dto: CommunityMediaDto): Array<{ kind: string; image: ReturnType<typeof decodeCommunityImage> | null }> {
    return (['logo', 'qr'] as const).filter((kind) => dto[kind] !== undefined).map((kind) => ({ kind, image: dto[kind] === null ? null : decodeCommunityImage(dto[kind]!) }));
  }
  private async saveImages(client: PoolClient, id: string, images: ReturnType<CommunityService['images']>): Promise<void> {
    for (const { kind, image } of images) {
      if (image) await client.query(`INSERT INTO community_group_images (group_id, kind, mime_type, image_data) VALUES ($1, $2, $3, $4) ON CONFLICT (group_id, kind) DO UPDATE SET mime_type = EXCLUDED.mime_type, image_data = EXCLUDED.image_data`, [id, kind, image.mime, image.data]);
      else await client.query('DELETE FROM community_group_images WHERE group_id = $1 AND kind = $2', [id, kind]);
    }
  }
  async createGroup(actor: AuthenticatedUser, dto: CreateCommunityGroupDto): Promise<CommunityGroup> {
    if (dto.name.trim().length < 3 || dto.summary.trim().length < 10 || dto.location.trim().length < 2) throw new BadRequestException('Enter a community name, description and location.');
    const images = this.images(dto);
    const id = await this.transaction(async (client) => {
      const created = await client.query<{ id: string }>(`INSERT INTO community_groups (name, focus_area, summary, location, created_by, qr_caption) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [dto.name.trim(), dto.focusArea, dto.summary.trim(), dto.location.trim(), actor.sub, dto.qrCaption?.trim() ?? '']);
      const groupId = created.rows[0].id;
      await client.query(`INSERT INTO community_group_members (group_id, user_id, member_role) VALUES ($1, $2, 'founder')`, [groupId, actor.sub]);
      await this.saveImages(client, groupId, images);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'community_requested', 'community_group', $2)`, [actor.sub, groupId]);
      return groupId;
    });
    return this.group(actor, id);
  }
  async review(actor: AuthenticatedUser, id: string, dto: ReviewCommunityDto): Promise<CommunityGroup> {
    if (!this.coordinator(actor)) throw new ForbiddenException('Only coordinators can review communities.');
    await this.transaction(async (client) => {
      const result = await client.query<{ status: string }>('SELECT status FROM community_groups WHERE id = $1 FOR UPDATE', [id]);
      if (!result.rows[0]) throw new NotFoundException('Community not found.');
      if (result.rows[0].status !== 'pending') throw new ConflictException('This community has already been reviewed. Refresh to see its status.');
      await client.query(`UPDATE community_groups SET status = $2, rejection_reason = $3, reviewed_by = $4, reviewed_at = now() WHERE id = $1`, [id, dto.status, dto.status === 'rejected' ? dto.reason?.trim() || null : null, actor.sub]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'community_reviewed', 'community_group', $2, $3::jsonb)`, [actor.sub, id, JSON.stringify(dto)]);
    });
    return this.group(actor, id);
  }
  async updateMedia(actor: AuthenticatedUser, id: string, dto: CommunityMediaDto): Promise<CommunityGroup> {
    const group = await this.group(actor, id);
    if (!group.canManage) throw new ForbiddenException('Only the community owner or a coordinator can update images.');
    const images = this.images(dto);
    await this.transaction(async (client) => {
      await this.saveImages(client, id, images);
      await client.query('UPDATE community_groups SET qr_caption = COALESCE($2, qr_caption), media_version = media_version + 1 WHERE id = $1', [id, dto.qrCaption?.trim()]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'community_images_updated', 'community_group', $2)`, [actor.sub, id]);
    });
    return this.group(actor, id);
  }
  async image(actor: AuthenticatedUser, id: string, kind: string): Promise<{ dataUrl: string }> {
    await this.group(actor, id);
    if (!['logo', 'qr'].includes(kind)) throw new NotFoundException('Image not found.');
    const result = await this.database.query<{ mime_type: string; image_data: Buffer }>('SELECT mime_type, image_data FROM community_group_images WHERE group_id = $1 AND kind = $2', [id, kind]);
    if (!result.rows[0]) throw new NotFoundException('Image not found.');
    return { dataUrl: `data:${result.rows[0].mime_type};base64,${result.rows[0].image_data.toString('base64')}` };
  }
  async joinGroup(actor: AuthenticatedUser, groupId: string): Promise<{ joined: boolean }> {
    const group = await this.group(actor, groupId);
    if (group.status !== 'approved') throw new ForbiddenException('This community is awaiting coordinator approval.');
    // Self-joining an approved community grants membership; private chat requires this row.
    await this.database.query('INSERT INTO community_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, actor.sub]);
    return { joined: true };
  }
  private async requireMember(actor: AuthenticatedUser, id: string): Promise<CommunityGroup> {
    const group = await this.group(actor, id);
    if (group.status !== 'approved' || !group.joined) throw new ForbiddenException('Join this approved community to access its chat and offer help.');
    return group;
  }
  async messages(actor: AuthenticatedUser, id: string, before?: string): Promise<{ items: CommunityMessage[]; hasMore: boolean }> {
    await this.requireMember(actor, id);
    const result = await this.database.query<{ id: string; body: string; created_at: Date; sender_name: string; author_id: string }>(
      `SELECT m.id, m.body, m.created_at, m.author_id, u.display_name AS sender_name FROM community_messages m JOIN users u ON u.id = m.author_id
       WHERE m.group_id = $1 AND ($2::uuid IS NULL OR (m.created_at, m.id) < (SELECT created_at, id FROM community_messages WHERE id = $2 AND group_id = $1))
       ORDER BY m.created_at DESC, m.id DESC LIMIT 51`, [id, before ?? null]);
    return { hasMore: result.rows.length > 50, items: result.rows.slice(0, 50).reverse().map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at.toISOString(), senderName: row.sender_name, mine: row.author_id === actor.sub })) };
  }
  async sendMessage(actor: AuthenticatedUser, id: string, body: string): Promise<CommunityMessage> {
    await this.requireMember(actor, id);
    if (!body.trim()) throw new BadRequestException('Write a message first.');
    const result = await this.database.query<{ id: string; created_at: Date; sender_name: string }>(`WITH sent AS (INSERT INTO community_messages (group_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, created_at) SELECT sent.*, u.display_name AS sender_name FROM sent JOIN users u ON u.id = $2`, [id, actor.sub, body.trim()]);
    return { id: result.rows[0].id, body: body.trim(), senderName: result.rows[0].sender_name, createdAt: result.rows[0].created_at.toISOString(), mine: true };
  }
  async pin(actor: AuthenticatedUser, id: string, body: string): Promise<CommunityGroup> {
    const group = await this.group(actor, id);
    if (!group.canManage || group.status !== 'approved') throw new ForbiddenException('Only the owner or a coordinator can pin an announcement in an approved community.');
    await this.transaction(async (client) => {
      await client.query('UPDATE community_groups SET announcement = $2, announcement_by = $3, announcement_at = now() WHERE id = $1', [id, body.trim(), actor.sub]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'community_announcement_updated', 'community_group', $2)`, [actor.sub, id]);
    });
    return this.group(actor, id);
  }
  async createPledge(actor: AuthenticatedUser, groupId: string, dto: CreateCommunityPledgeDto): Promise<CommunityPledge> {
    const group = await this.requireMember(actor, groupId);
    const inserted = await this.database.query<{ created_at: Date; id: string }>(`INSERT INTO community_pledges (group_id, pledged_by, contribution_kind, quantity, unit_label, details) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`, [groupId, actor.sub, dto.contributionKind, dto.quantity, dto.unitLabel.trim(), dto.details.trim()]);
    const user = await this.database.query<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [actor.sub]);
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'community_pledge_created', 'community_pledge', $2, jsonb_build_object('group_id', $3::uuid, 'kind', $4::text))`, [actor.sub, inserted.rows[0].id, groupId, dto.contributionKind]);
    return { id: inserted.rows[0].id, groupId, groupName: group.name, kind: dto.contributionKind, quantity: dto.quantity, unitLabel: dto.unitLabel.trim(), details: dto.details.trim(), createdAt: inserted.rows[0].created_at.toISOString(), contributorName: user.rows[0].display_name };
  }
}
