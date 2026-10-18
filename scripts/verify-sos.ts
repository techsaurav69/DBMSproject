import { pool } from '../database/scripts/database';

async function verify(): Promise<void> {
  const actor = await pool.query<{ id: string }>(`SELECT u.id FROM users u JOIN user_roles ur ON ur.user_id = u.id WHERE ur.role_code = 'coordinator' LIMIT 1`);
  if (!actor.rows[0]) throw new Error('A coordinator account is required for SOS verification.');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const disaster = await client.query<{ id: string }>(`SELECT id FROM disasters WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`);
    const location = await client.query<{ id: string }>(`INSERT INTO locations (label, coordinates, source) VALUES ($1, make_wgs84_geography($2, $3), 'operator') RETURNING id`, ['SOS verification only', 77.58, 12.92]);
    const incident = await client.query<{ id: string }>(`INSERT INTO emergency_incidents (disaster_id, location_id, reporter_id, source, emergency_type, severity, description) VALUES ($1, $2, $3, 'operator_report', 'medical_emergency', 'high', 'SOS transaction verification record') RETURNING id`, [disaster.rows[0]?.id ?? null, location.rows[0].id, actor.rows[0].id]);
    const request = await client.query<{ id: string }>(`INSERT INTO emergency_requests (incident_id, created_by, category, urgency, description, people_count) VALUES ($1, $2, 'medical', 'high', 'SOS transaction verification record', 1) RETURNING id`, [incident.rows[0].id, actor.rows[0].id]);
    await client.query(`INSERT INTO request_events (request_id, actor_id, event_type, reason) VALUES ($1, $2, 'sos_created', 'SOS report created through the local CrisisGrid interface')`, [request.rows[0].id, actor.rows[0].id]);
    await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'sos_created', 'request', $2, jsonb_build_object('incident_id', $3::uuid))`, [actor.rows[0].id, request.rows[0].id, incident.rows[0].id]);
    await client.query('ROLLBACK');
    console.log('SOS transaction verified and rolled back.');
  } catch (error) { await client.query('ROLLBACK'); throw error; } finally { client.release(); await pool.end(); }
}

void verify();
