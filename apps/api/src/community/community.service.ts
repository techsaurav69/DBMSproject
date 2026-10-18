import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CreateCommunityGroupDto } from './dto/create-community-group.dto';
import { CreateCommunityPledgeDto } from './dto/create-community-pledge.dto';

export type CommunityGroup = { createdAt: string; creatorName: string; focusArea: string; id: string; joined: boolean; memberCount: number; name: string; pledgeCount: number; summary: string };
export type CommunityPledge = { contributorName: string; createdAt: string; details: string; groupId: string; groupName: string; id: string; kind: string; quantity: number; unitLabel: string };

@Injectable()
export class CommunityService {
  constructor(private readonly database: DatabaseService) {}

  async overview(actor: AuthenticatedUser): Promise<{ groups: CommunityGroup[]; pledges: CommunityPledge[] }> {
    const [groups, pledges] = await Promise.all([
      this.database.query<{ created_at: Date; creator_name: string; focus_area: string; id: string; joined: boolean; member_count: string; name: string; pledge_count: string; summary: string }>(
        `SELECT g.id, g.name, g.focus_area, g.summary, g.created_at, creator.display_name AS creator_name,
          (SELECT count(*) FROM community_group_members m WHERE m.group_id = g.id)::text AS member_count,
          (SELECT count(*) FROM community_pledges p WHERE p.group_id = g.id)::text AS pledge_count,
          EXISTS (SELECT 1 FROM community_group_members mine WHERE mine.group_id = g.id AND mine.user_id = $1) AS joined
         FROM community_groups g JOIN users creator ON creator.id = g.created_by
         ORDER BY g.created_at DESC LIMIT 30`, [actor.sub],
      ),
      this.database.query<{ contributor_name: string; created_at: Date; details: string; group_id: string; group_name: string; id: string; kind: string; quantity: string; unit_label: string }>(
        `SELECT p.id, p.group_id, g.name AS group_name, p.contribution_kind AS kind, p.quantity::text, p.unit_label, p.details, p.created_at,
          users.display_name AS contributor_name
         FROM community_pledges p JOIN community_groups g ON g.id = p.group_id JOIN users ON users.id = p.pledged_by
         ORDER BY p.created_at DESC LIMIT 24`,
      ),
    ]);
    return {
      groups: groups.rows.map((row) => ({ id: row.id, name: row.name, focusArea: row.focus_area, summary: row.summary, createdAt: row.created_at.toISOString(), creatorName: row.creator_name, memberCount: Number(row.member_count), pledgeCount: Number(row.pledge_count), joined: row.joined })),
      pledges: pledges.rows.map((row) => ({ id: row.id, groupId: row.group_id, groupName: row.group_name, kind: row.kind, quantity: Number(row.quantity), unitLabel: row.unit_label, details: row.details, createdAt: row.created_at.toISOString(), contributorName: row.contributor_name })),
    };
  }

  async createGroup(actor: AuthenticatedUser, dto: CreateCommunityGroupDto): Promise<CommunityGroup> {
    const name = dto.name.trim();
    const existing = await this.database.query<{ id: string }>('SELECT id FROM community_groups WHERE lower(name) = lower($1)', [name]);
    if (existing.rows[0]) throw new BadRequestException('A community with this name already exists.');
    const created = await this.database.query<{ created_at: Date; id: string }>(
      `WITH group_created AS (
        INSERT INTO community_groups (name, focus_area, summary, created_by) VALUES ($1, $2, $3, $4) RETURNING id, created_at
       ), membership AS (
        INSERT INTO community_group_members (group_id, user_id, member_role) SELECT id, $4, 'founder' FROM group_created
       ) SELECT id, created_at FROM group_created`, [name, dto.focusArea, dto.summary.trim(), actor.sub],
    );
    const row = created.rows[0];
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'community_group_created', 'community_group', $2, jsonb_build_object('focus_area', $3))`, [actor.sub, row.id, dto.focusArea]);
    const user = await this.database.query<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [actor.sub]);
    return { id: row.id, name, focusArea: dto.focusArea, summary: dto.summary.trim(), createdAt: row.created_at.toISOString(), creatorName: user.rows[0].display_name, memberCount: 1, pledgeCount: 0, joined: true };
  }

  async joinGroup(actor: AuthenticatedUser, groupId: string): Promise<{ joined: boolean }> {
    const result = await this.database.query('INSERT INTO community_group_members (group_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [groupId, actor.sub]);
    if (!result.rowCount) {
      const group = await this.database.query<{ id: string }>('SELECT id FROM community_groups WHERE id = $1', [groupId]);
      if (!group.rows[0]) throw new NotFoundException('This community no longer exists.');
      return { joined: false };
    }
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'community_group_joined', 'community_group', $2)`, [actor.sub, groupId]);
    return { joined: true };
  }

  async createPledge(actor: AuthenticatedUser, groupId: string, dto: CreateCommunityPledgeDto): Promise<CommunityPledge> {
    const group = await this.database.query<{ name: string }>('SELECT name FROM community_groups WHERE id = $1', [groupId]);
    if (!group.rows[0]) throw new NotFoundException('This community no longer exists.');
    const inserted = await this.database.query<{ created_at: Date; id: string }>(
      `INSERT INTO community_pledges (group_id, pledged_by, contribution_kind, quantity, unit_label, details)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, created_at`, [groupId, actor.sub, dto.contributionKind, dto.quantity, dto.unitLabel.trim(), dto.details.trim()],
    );
    const user = await this.database.query<{ display_name: string }>('SELECT display_name FROM users WHERE id = $1', [actor.sub]);
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'community_pledge_created', 'community_pledge', $2, jsonb_build_object('group_id', $3, 'kind', $4))`, [actor.sub, inserted.rows[0].id, groupId, dto.contributionKind]);
    return { id: inserted.rows[0].id, groupId, groupName: group.rows[0].name, kind: dto.contributionKind, quantity: dto.quantity, unitLabel: dto.unitLabel.trim(), details: dto.details.trim(), createdAt: inserted.rows[0].created_at.toISOString(), contributorName: user.rows[0].display_name };
  }
}
