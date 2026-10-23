import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CreateGlobalChatMessageDto } from './dto/create-global-chat-message.dto';

export type GlobalChatMessage = { authorName: string; body: string; createdAt: string; id: string; mine: boolean; roleLabel: string };

@Injectable()
export class GlobalChatService {
  constructor(private readonly database: DatabaseService) {}

  async list(actor: AuthenticatedUser): Promise<{ items: GlobalChatMessage[] }> {
    const result = await this.database.query<{ author_id: string | null; author_name: string | null; body: string; created_at: Date; id: string; role_label: string | null }>(
      `SELECT m.id, m.body, m.created_at, m.author_id, u.display_name AS author_name,
        (SELECT string_agg(replace(ur.role_code::text, '_', ' '), ' · ' ORDER BY ur.role_code) FROM user_roles ur WHERE ur.user_id = m.author_id) AS role_label
       FROM global_chat_messages m LEFT JOIN users u ON u.id = m.author_id
       ORDER BY m.created_at DESC LIMIT 100`,
    );
    return { items: result.rows.reverse().map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at.toISOString(), authorName: row.author_name ?? 'Former local user', roleLabel: row.role_label ?? 'local participant', mine: row.author_id === actor.sub })) };
  }

  async create(actor: AuthenticatedUser, dto: CreateGlobalChatMessageDto): Promise<GlobalChatMessage> {
    const result = await this.database.query<{ author_name: string; body: string; created_at: Date; id: string; role_label: string }>(
      `WITH inserted AS (
        INSERT INTO global_chat_messages (author_id, body) VALUES ($1, $2) RETURNING id, body, created_at
       ) SELECT inserted.id, inserted.body, inserted.created_at, u.display_name AS author_name,
         (SELECT string_agg(replace(ur.role_code::text, '_', ' '), ' · ' ORDER BY ur.role_code) FROM user_roles ur WHERE ur.user_id = $1) AS role_label
       FROM inserted JOIN users u ON u.id = $1`, [actor.sub, dto.body.trim()],
    );
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'global_chat_message_created', 'global_chat', $2)`, [actor.sub, result.rows[0].id]);
    const row = result.rows[0];
    return { id: row.id, body: row.body, createdAt: row.created_at.toISOString(), authorName: row.author_name, roleLabel: row.role_label, mine: true };
  }

  async clear(actor: AuthenticatedUser): Promise<{ deleted: number }> {
    const result = await this.database.query<{ deleted: string }>(`WITH removed AS (DELETE FROM global_chat_messages RETURNING id) SELECT count(*)::text AS deleted FROM removed`);
    const deleted = Number(result.rows[0]?.deleted ?? 0);
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, details) VALUES ($1, 'global_chat_cleared', 'global_chat', jsonb_build_object('deleted_count', $2))`, [actor.sub, deleted]);
    return { deleted };
  }
}
