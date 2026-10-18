import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import { CreateSosDto } from './dto/create-sos.dto';

export type SosSubmission = { incidentId: string; requestId: string; status: 'open' };

@Injectable()
export class SosService {
  constructor(private readonly database: DatabaseService) {}

  async create(actor: AuthenticatedUser, dto: CreateSosDto): Promise<SosSubmission> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const disaster = await client.query<{ id: string }>(`SELECT id FROM disasters WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
      const location = await client.query<{ id: string }>(`INSERT INTO locations (label, address_text, coordinates, source) VALUES ($1, $2, make_wgs84_geography($3, $4), $5) RETURNING id`, [dto.locationLabel.trim(), dto.addressText?.trim() || null, dto.longitude, dto.latitude, actor.roles.includes('citizen') ? 'gps' : 'operator']);
      const incident = await client.query<{ id: string }>(`INSERT INTO emergency_incidents (disaster_id, location_id, reporter_id, source, emergency_type, severity, description) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`, [disaster.rows[0]?.id ?? null, location.rows[0].id, actor.sub, actor.roles.includes('citizen') ? 'citizen_report' : 'operator_report', dto.emergencyType, dto.severity, dto.description.trim()]);
      const request = await client.query<{ id: string }>(`INSERT INTO emergency_requests (incident_id, created_by, category, urgency, description, people_count) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`, [incident.rows[0].id, actor.sub, dto.category, dto.severity, dto.description.trim(), dto.peopleCount ?? null]);
      await client.query(`INSERT INTO request_events (request_id, actor_id, event_type, reason) VALUES ($1, $2, 'sos_created', 'SOS report created through the local CrisisGrid interface')`, [request.rows[0].id, actor.sub]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'sos_created', 'request', $2, jsonb_build_object('incident_id', $3::uuid))`, [actor.sub, request.rows[0].id, incident.rows[0].id]);
      await client.query('COMMIT');
      return { incidentId: incident.rows[0].id, requestId: request.rows[0].id, status: 'open' };
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }
}
