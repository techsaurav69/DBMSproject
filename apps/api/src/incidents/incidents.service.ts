import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';
import type { AuthenticatedUser } from '../auth/auth.types';
import type { CreateIncidentDto } from './dto/create-incident.dto';

type IncidentRow = { id: string; description: string; emergency_type: string; label: string | null; latitude: string; longitude: string; reported_at: Date; severity: string; status: string };

export type Incident = { id: string; description: string; emergencyType: string; label: string | null; latitude: number; longitude: number; reportedAt: string; severity: string; status: string };

@Injectable()
export class IncidentsService {
  constructor(private readonly database: DatabaseService) {}

  async create(actor: AuthenticatedUser, dto: CreateIncidentDto): Promise<Incident> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const disaster = await client.query<{ id: string }>(`SELECT id FROM disasters WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
      const location = await client.query<{ id: string }>(
        `INSERT INTO locations (label, address_text, coordinates, source)
         VALUES ($1, $2, make_wgs84_geography($3, $4), $5) RETURNING id`,
        [dto.locationLabel.trim(), dto.addressText?.trim() || null, dto.longitude, dto.latitude, actor.roles.includes('citizen') ? 'gps' : 'operator'],
      );
      const created = await client.query<{ id: string }>(
        `INSERT INTO emergency_incidents (disaster_id, location_id, reporter_id, source, emergency_type, severity, description)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
        [disaster.rows[0]?.id ?? null, location.rows[0].id, actor.sub, actor.roles.includes('citizen') ? 'citizen_report' : 'operator_report', dto.emergencyType, dto.severity, dto.description.trim()],
      );
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'incident_created', 'incident', $2, jsonb_build_object('source', $3))`, [actor.sub, created.rows[0].id, actor.roles.includes('citizen') ? 'citizen_report' : 'operator_report']);
      await client.query('COMMIT');
      return this.getById(created.rows[0].id);
    } catch (error: unknown) {
      await client.query('ROLLBACK');
      throw error;
    } finally { client.release(); }
  }

  async getById(id: string): Promise<Incident> {
    const result = await this.database.query<IncidentRow>(`${this.selectIncident()} WHERE i.id = $1`, [id]);
    const row = result.rows[0];
    if (!row) throw new NotFoundException('Incident not found.');
    return this.toIncident(row);
  }

  private selectIncident(): string {
    return `SELECT i.id, i.description, i.emergency_type, i.severity, i.status, i.reported_at, l.label,
      ST_Y(l.coordinates::geometry) AS latitude, ST_X(l.coordinates::geometry) AS longitude
      FROM emergency_incidents i JOIN locations l ON l.id = i.location_id`;
  }

  private toIncident(row: IncidentRow): Incident {
    return { id: row.id, description: row.description, emergencyType: row.emergency_type, label: row.label, latitude: Number(row.latitude), longitude: Number(row.longitude), reportedAt: row.reported_at.toISOString(), severity: row.severity, status: row.status };
  }
}
