import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../database/database.service';

export type OperationsOverview = {
  generatedAt: string;
  activeDisaster: { id: string; name: string; status: string } | null;
  incidents: Array<{ id: string; description: string; emergencyType: string; label: string | null; latitude: number; longitude: number; reportedAt: string; severity: string; status: string }>;
  requests: Array<{ id: string; category: string; description: string; emergencyType: string; isSos: boolean; label: string | null; peopleCount: number | null; severity: string; status: string }>;
  resources: Array<{ id: string; latitude: number; longitude: number; providerName: string; registrationCode: string; status: string; vehicleType: string }>;
  summary: { activeAssignments: number; availableShelterSpaces: number; availableSupplyUnits: number; availableVehicles: number; openIncidents: number; openRequests: number };
};

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async overview(): Promise<OperationsOverview> {
    const [summaryResult, disasterResult, incidentResult, requestResult, resourceResult] = await Promise.all([
      this.database.query<{
        active_assignments: string; available_shelter_spaces: string; available_supply_units: string; available_vehicles: string; open_incidents: string; open_requests: string;
      }>(`SELECT
        (SELECT count(*) FROM emergency_incidents WHERE status IN ('reported', 'verified', 'in_progress')) AS open_incidents,
        (SELECT count(*) FROM emergency_requests WHERE status IN ('open', 'triaged', 'assigned', 'in_progress')) AS open_requests,
        (SELECT count(*) FROM vehicles v WHERE v.operational_status = 'available'
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.vehicle_id = v.id AND a.status IN ('assigned', 'accepted', 'en_route', 'on_scene'))) AS available_vehicles,
        (SELECT count(*) FROM assignments WHERE status IN ('assigned', 'accepted', 'en_route', 'on_scene')) AS active_assignments,
        (SELECT coalesce(sum(on_hand_quantity - reserved_quantity), 0) FROM resource_inventory) AS available_supply_units,
        (SELECT coalesce(sum(approved_capacity - occupied_count - reserved_count), 0) FROM shelters WHERE is_operational) AS available_shelter_spaces`),
      this.database.query<{ id: string; name: string; status: string }>(`SELECT id, name, status FROM disasters WHERE status = 'active' ORDER BY started_at DESC LIMIT 1`),
      this.database.query<{
        description: string; emergency_type: string; id: string; label: string | null; latitude: string; longitude: string; reported_at: Date; severity: string; status: string;
      }>(`SELECT i.id, i.description, i.emergency_type, i.severity, i.status, i.reported_at, l.label,
          ST_Y(l.coordinates::geometry) AS latitude, ST_X(l.coordinates::geometry) AS longitude
        FROM emergency_incidents i JOIN locations l ON l.id = i.location_id
        WHERE i.status IN ('reported', 'verified', 'in_progress') ORDER BY i.reported_at DESC LIMIT 12`),
      this.database.query<{
        category: string; description: string; emergency_type: string; id: string; is_sos: boolean; label: string | null; people_count: number | null; severity: string; status: string;
      }>(`SELECT r.id, r.category, r.urgency AS severity, r.status, r.description, r.people_count, i.emergency_type, l.label,
          EXISTS (SELECT 1 FROM request_events re WHERE re.request_id = r.id AND re.event_type = 'sos_created') AS is_sos
        FROM emergency_requests r
        JOIN emergency_incidents i ON i.id = r.incident_id
        JOIN locations l ON l.id = i.location_id
        WHERE r.status IN ('open', 'triaged', 'assigned', 'in_progress') ORDER BY r.created_at DESC LIMIT 12`),
      this.database.query<{
        id: string; latitude: string; longitude: string; provider_name: string; registration_code: string; status: string; vehicle_type: string;
      }>(`SELECT v.id, v.registration_code, v.vehicle_type, v.operational_status AS status, p.name AS provider_name,
          ST_Y(l.coordinates::geometry) AS latitude, ST_X(l.coordinates::geometry) AS longitude
        FROM vehicles v JOIN service_providers p ON p.id = v.provider_id JOIN locations l ON l.id = v.location_id
        WHERE v.operational_status = 'available'
          AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.vehicle_id = v.id AND a.status IN ('assigned', 'accepted', 'en_route', 'on_scene'))
        ORDER BY v.created_at ASC LIMIT 30`),
    ]);

    const summary = summaryResult.rows[0];
    return {
      generatedAt: new Date().toISOString(),
      activeDisaster: disasterResult.rows[0] ?? null,
      summary: {
        openIncidents: Number(summary.open_incidents), openRequests: Number(summary.open_requests),
        availableVehicles: Number(summary.available_vehicles), activeAssignments: Number(summary.active_assignments),
        availableSupplyUnits: Number(summary.available_supply_units), availableShelterSpaces: Number(summary.available_shelter_spaces),
      },
      incidents: incidentResult.rows.map((row) => ({
        id: row.id, description: row.description, emergencyType: row.emergency_type, label: row.label,
        latitude: Number(row.latitude), longitude: Number(row.longitude), reportedAt: row.reported_at.toISOString(), severity: row.severity, status: row.status,
      })),
      requests: requestResult.rows.map((row) => ({
        id: row.id, category: row.category, description: row.description, emergencyType: row.emergency_type,
        isSos: row.is_sos, label: row.label, peopleCount: row.people_count, severity: row.severity, status: row.status,
      })),
      resources: resourceResult.rows.map((row) => ({
        id: row.id, latitude: Number(row.latitude), longitude: Number(row.longitude), providerName: row.provider_name,
        registrationCode: row.registration_code, status: row.status, vehicleType: row.vehicle_type,
      })),
    };
  }
}
