import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateRequestDto, UpdateRequestStatusDto } from './dto/create-request.dto';

type RequestRow = { category: string; created_at: Date; description: string; id: string; people_count: number | null; severity: string; status: string };
export type AssistanceRequest = { category: string; createdAt: string; description: string; id: string; peopleCount: number | null; severity: string; status: string };

const transitions: Record<string, string[]> = { open: ['triaged', 'cancelled'], triaged: ['assigned', 'cancelled'], assigned: ['in_progress', 'cancelled'], in_progress: ['fulfilled', 'closed', 'cancelled'], fulfilled: ['closed'], cancelled: [], closed: [] };

@Injectable()
export class RequestsService {
  constructor(private readonly database: DatabaseService) {}

  async create(actor: AuthenticatedUser, dto: CreateRequestDto): Promise<AssistanceRequest> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const incident = await client.query<{ id: string; reporter_id: string | null }>('SELECT id, reporter_id FROM emergency_incidents WHERE id = $1 FOR UPDATE', [dto.incidentId]);
      if (!incident.rows[0]) throw new NotFoundException('Incident not found.');
      if (actor.roles.includes('citizen') && incident.rows[0].reporter_id !== actor.sub) throw new ForbiddenException('Citizens can create requests only for their own incident reports.');
      const created = await client.query<RequestRow>(
        `INSERT INTO emergency_requests (incident_id, created_by, category, urgency, description, people_count)
         VALUES ($1, $2, $3, $4, $5, $6) RETURNING id, category, urgency AS severity, status, description, people_count, created_at`,
        [dto.incidentId, actor.sub, dto.category, dto.urgency, dto.description.trim(), dto.peopleCount ?? null],
      );
      await client.query(`INSERT INTO request_events (request_id, actor_id, event_type, reason) VALUES ($1, $2, 'request_created', 'Created through the local CrisisGrid interface')`, [created.rows[0].id, actor.sub]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'request_created', 'request', $2)`, [actor.sub, created.rows[0].id]);
      await client.query('COMMIT');
      return this.toRequest(created.rows[0]);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async updateStatus(actor: AuthenticatedUser, id: string, dto: UpdateRequestStatusDto): Promise<AssistanceRequest> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query<RequestRow>('SELECT id, category, urgency AS severity, status, description, people_count, created_at FROM emergency_requests WHERE id = $1 FOR UPDATE', [id]);
      const current = result.rows[0];
      if (!current) throw new NotFoundException('Assistance request not found.');
      if (!transitions[current.status]?.includes(dto.status)) throw new ForbiddenException(`Cannot change a ${current.status} request to ${dto.status}.`);
      const updated = await client.query<RequestRow>(
        `UPDATE emergency_requests SET status = $1, closed_at = CASE WHEN $1 IN ('fulfilled', 'cancelled', 'closed') THEN now() ELSE NULL END WHERE id = $2
         RETURNING id, category, urgency AS severity, status, description, people_count, created_at`, [dto.status, id],
      );
      await client.query(
        `INSERT INTO request_events (request_id, actor_id, previous_status, new_status, event_type, reason)
         VALUES ($1, $2, $3, $4, 'status_changed', 'Changed through the local CrisisGrid workflow board')`,
        [id, actor.sub, current.status, dto.status],
      );
      await client.query(
        `INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
         VALUES ($1, 'request_status_changed', 'request', $2, jsonb_build_object('from', $3, 'to', $4))`,
        [actor.sub, id, current.status, dto.status],
      );
      await client.query('COMMIT');
      return this.toRequest(updated.rows[0]);
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private toRequest(row: RequestRow): AssistanceRequest { return { id: row.id, category: row.category, severity: row.severity, status: row.status, description: row.description, peopleCount: row.people_count, createdAt: row.created_at.toISOString() }; }
}
