import { Injectable } from '@nestjs/common';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';

export type NotificationItem = { id: string; kind: 'assignment' | 'inventory' | 'request' | 'sos'; message: string; read: boolean; severity: 'critical' | 'high' | 'medium'; timestamp: string; title: string };

@Injectable()
export class NotificationsService {
  constructor(private readonly database: DatabaseService) {}

  async list(actor: AuthenticatedUser): Promise<{ items: NotificationItem[]; unreadCount: number }> {
    const result = await this.database.query<{ id: string; kind: NotificationItem['kind']; message: string; read: boolean; severity: NotificationItem['severity']; timestamp: Date; title: string }>(
      `WITH notices AS (
        SELECT 'sos:' || r.id AS id, 'sos'::text AS kind, r.urgency::text AS severity,
          coalesce(l.label, 'An unlabelled location') || ' needs ' || r.category || ' support for ' || coalesce(r.people_count::text, 'an unknown number of') || ' people.' AS message,
          'New SOS request' AS title, r.created_at AS timestamp
        FROM emergency_requests r
        JOIN emergency_incidents i ON i.id = r.incident_id
        JOIN locations l ON l.id = i.location_id
        WHERE r.status = 'open' AND r.urgency IN ('high', 'critical')
          AND EXISTS (SELECT 1 FROM request_events re WHERE re.request_id = r.id AND re.event_type = 'sos_created')
        UNION ALL
        SELECT 'request:' || r.id AS id, 'request'::text AS kind, r.urgency::text AS severity,
          'Request at ' || coalesce(l.label, 'an unlabelled location') || ' is ready for dispatch planning.' AS message,
          'Vehicle dispatch needed' AS title, r.updated_at AS timestamp
        FROM emergency_requests r JOIN emergency_incidents i ON i.id = r.incident_id JOIN locations l ON l.id = i.location_id
        WHERE r.status = 'triaged'
        UNION ALL
        SELECT 'assignment:' || a.id, 'assignment'::text, 'high'::text,
          v.registration_code || ' is assigned and awaiting the next operational update.' AS message,
          'Active vehicle assignment' AS title, a.updated_at
        FROM assignments a JOIN vehicles v ON v.id = a.vehicle_id
        WHERE a.status IN ('assigned', 'accepted', 'en_route', 'on_scene')
        UNION ALL
        SELECT 'inventory:' || ri.id, 'inventory'::text,
          CASE WHEN ri.on_hand_quantity - ri.reserved_quantity <= 10 THEN 'high' ELSE 'medium' END,
          rt.display_name || ' has ' || (ri.on_hand_quantity - ri.reserved_quantity)::text || ' ' || rt.default_unit || ' remaining.' AS message,
          'Supply level to review' AS title, ri.updated_at
        FROM resource_inventory ri JOIN resource_types rt ON rt.id = ri.resource_type_id
        WHERE ri.on_hand_quantity - ri.reserved_quantity <= 20
      )
      SELECT n.*, receipt.read_at IS NOT NULL AS read
      FROM notices n LEFT JOIN notification_receipts receipt ON receipt.notification_key = n.id AND receipt.user_id = $1
      ORDER BY n.timestamp DESC LIMIT 20`, [actor.sub],
    );
    const items = result.rows.map((row) => ({ id: row.id, kind: row.kind, severity: row.severity, title: row.title, message: row.message, timestamp: row.timestamp.toISOString(), read: row.read }));
    return { items, unreadCount: items.filter((item) => !item.read).length };
  }

  async markRead(actor: AuthenticatedUser, id: string): Promise<void> {
    await this.database.query(`INSERT INTO notification_receipts (user_id, notification_key) VALUES ($1, $2) ON CONFLICT (user_id, notification_key) DO UPDATE SET read_at = now()`, [actor.sub, id]);
  }

  async markAllRead(actor: AuthenticatedUser): Promise<void> {
    const { items } = await this.list(actor);
    if (!items.length) return;
    await this.database.query(`INSERT INTO notification_receipts (user_id, notification_key) SELECT $1, unnest($2::text[]) ON CONFLICT (user_id, notification_key) DO UPDATE SET read_at = now()`, [actor.sub, items.map((item) => item.id)]);
  }
}
