import { BadRequestException, Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CreateCoordinatorUpdateDto } from './dto/create-coordinator-update.dto';

const updateScopes = ['workflow', 'request_queue', 'dispatch', 'supply_tracking'] as const;
export type CoordinatorUpdateScope = typeof updateScopes[number];
export type CoordinatorUpdate = { authorName: string; body: string; createdAt: string; id: string; repeatCount: number; scope: CoordinatorUpdateScope };

@Injectable()
export class CoordinatorUpdatesService {
  constructor(private readonly database: DatabaseService) {}

  async list(scopeInput: string): Promise<{ items: CoordinatorUpdate[] }> {
    const scope = this.scope(scopeInput);
    const result = await this.database.query<{ author_name: string; body: string; created_at: Date; id: string; scope: CoordinatorUpdateScope }>(
      `SELECT u.id, u.scope, u.body, u.created_at, users.display_name AS author_name
       FROM coordinator_updates u JOIN users ON users.id = u.author_id
       WHERE u.scope = $1 ORDER BY u.created_at DESC LIMIT 30`, [scope],
    );
    const grouped: CoordinatorUpdate[] = [];
    for (const row of result.rows.reverse()) {
      const previous = grouped.at(-1);
      const createdAt = row.created_at.toISOString();
      const isRecentDuplicate = previous
        && previous.authorName === row.author_name
        && previous.body === row.body
        && Date.parse(createdAt) - Date.parse(previous.createdAt) <= 5 * 60_000;
      if (isRecentDuplicate) {
        previous.id = row.id;
        previous.createdAt = createdAt;
        previous.repeatCount += 1;
      } else {
        grouped.push({ id: row.id, scope: row.scope, body: row.body, createdAt, authorName: row.author_name, repeatCount: 1 });
      }
    }
    return { items: grouped };
  }

  async create(actor: AuthenticatedUser, scopeInput: string, dto: CreateCoordinatorUpdateDto): Promise<CoordinatorUpdate> {
    const scope = this.scope(scopeInput);
    const body = dto.body.trim();
    const existing = await this.database.query<{ author_name: string; body: string; created_at: Date; id: string; scope: CoordinatorUpdateScope }>(
      `SELECT u.id, u.scope, u.body, u.created_at, users.display_name AS author_name
       FROM coordinator_updates u JOIN users ON users.id = u.author_id
       WHERE u.scope = $1 AND u.author_id = $2 AND u.body = $3 AND u.created_at >= now() - interval '30 seconds'
       ORDER BY u.created_at DESC LIMIT 1`, [scope, actor.sub, body],
    );
    if (existing.rows[0]) {
      const row = existing.rows[0];
      return { id: row.id, scope: row.scope, body: row.body, createdAt: row.created_at.toISOString(), authorName: row.author_name, repeatCount: 1 };
    }
    const result = await this.database.query<{ author_name: string; body: string; created_at: Date; id: string; scope: CoordinatorUpdateScope }>(
      `WITH inserted AS (
        INSERT INTO coordinator_updates (scope, author_id, body) VALUES ($1, $2, $3)
        RETURNING id, scope, body, created_at
       ) SELECT inserted.id, inserted.scope, inserted.body, inserted.created_at, users.display_name AS author_name
       FROM inserted JOIN users ON users.id = $2`, [scope, actor.sub, body],
    );
    const row = result.rows[0];
    await this.database.query(
      `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
       VALUES ($1, 'coordinator_update_created', 'coordinator_update', $2, jsonb_build_object('scope', $3))`, [actor.sub, row.id, scope],
    );
    return { id: row.id, scope: row.scope, body: row.body, createdAt: row.created_at.toISOString(), authorName: row.author_name, repeatCount: 1 };
  }

  private scope(value: string): CoordinatorUpdateScope {
    if ((updateScopes as readonly string[]).includes(value)) return value as CoordinatorUpdateScope;
    throw new BadRequestException('Unknown coordinator-update section.');
  }
}
