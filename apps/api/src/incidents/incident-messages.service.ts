import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CreateIncidentMessageDto } from './dto/create-incident-message.dto';

export type IncidentMessage = { authorName: string; body: string; createdAt: string; id: string; mine: boolean };

@Injectable()
export class IncidentMessagesService {
  constructor(private readonly database: DatabaseService) {}

  async list(actor: AuthenticatedUser, incidentId: string): Promise<{ items: IncidentMessage[] }> {
    await this.assertCanAccess(actor, incidentId);
    const result = await this.database.query<{ author_name: string | null; author_id: string | null; body: string; created_at: Date; id: string }>(
      `SELECT m.id, m.body, m.created_at, m.author_id, u.display_name AS author_name
       FROM incident_messages m LEFT JOIN users u ON u.id = m.author_id
       WHERE m.incident_id = $1 ORDER BY m.created_at ASC LIMIT 100`, [incidentId],
    );
    return { items: result.rows.map((row) => ({ id: row.id, body: row.body, createdAt: row.created_at.toISOString(), authorName: row.author_name ?? 'Former local user', mine: row.author_id === actor.sub })) };
  }

  async create(actor: AuthenticatedUser, incidentId: string, dto: CreateIncidentMessageDto): Promise<IncidentMessage> {
    await this.assertCanAccess(actor, incidentId);
    const result = await this.database.query<{ author_name: string; body: string; created_at: Date; id: string }>(
      `WITH inserted AS (
        INSERT INTO incident_messages (incident_id, author_id, body) VALUES ($1, $2, $3) RETURNING id, body, created_at
       ) SELECT inserted.id, inserted.body, inserted.created_at, u.display_name AS author_name FROM inserted JOIN users u ON u.id = $2`,
      [incidentId, actor.sub, dto.body.trim()],
    );
    await this.database.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'incident_message_created', 'incident', $2)`, [actor.sub, incidentId]);
    const row = result.rows[0];
    return { id: row.id, body: row.body, createdAt: row.created_at.toISOString(), authorName: row.author_name, mine: true };
  }

  private async assertCanAccess(actor: AuthenticatedUser, incidentId: string): Promise<void> {
    const result = await this.database.query<{ reporter_id: string | null }>('SELECT reporter_id FROM emergency_incidents WHERE id = $1', [incidentId]);
    if (!result.rows[0]) throw new NotFoundException('Incident not found.');
    if (actor.roles.includes('citizen') && result.rows[0].reporter_id !== actor.sub) throw new ForbiddenException('Citizens can access messages only for their own incident reports.');
  }
}
