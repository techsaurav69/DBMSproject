import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import type { AuthenticatedUser } from '../auth/auth.types';
import { DatabaseService } from '../database/database.service';
import type { DispatchVehicleDto, ReserveInventoryDto, ReserveShelterDto, UpdateAssignmentStatusDto } from './dto/coordination.dto';

export type CoordinationCandidates = {
  request: { id: string; label: string | null; status: string; urgency: string };
  radiusMeters: number;
  vehicles: Array<{ distanceMetres: number; id: string; providerName: string; registrationCode: string; vehicleType: string }>;
  inventory: Array<{ availableQuantity: number; id: string; providerName: string; resourceName: string; unit: string }>;
  shelters: Array<{ availableSpaces: number; id: string; name: string; providerName: string | null }>;
};
export type SupplyTracking = { assignments: Array<{ assignmentId: string; currentLatitude: number; currentLongitude: number; destinationLabel: string | null; destinationLatitude: number; destinationLongitude: number; etaMinutes: number; originLatitude: number; originLongitude: number; progress: number; providerName: string; registrationCode: string; status: string; supplies: string; vehicleType: string }> };

@Injectable()
export class CoordinationService {
  constructor(private readonly database: DatabaseService) {}

  async candidates(requestId: string, requestedRadius?: string): Promise<CoordinationCandidates> {
    const radiusMeters = this.radius(requestedRadius);
    const request = await this.database.query<{ id: string; label: string | null; status: string; urgency: string; location_id: string }>(
      `SELECT r.id, r.status, r.urgency, l.label, l.id AS location_id
       FROM emergency_requests r
       JOIN emergency_incidents i ON i.id = r.incident_id
       JOIN locations l ON l.id = i.location_id
       WHERE r.id = $1`, [requestId],
    );
    const current = request.rows[0];
    if (!current) throw new NotFoundException('Assistance request not found.');

    const [vehicles, inventory, shelters] = await Promise.all([
      this.database.query<{ distance_metres: string; id: string; provider_name: string; registration_code: string; vehicle_type: string }>(
        `WITH origin AS (SELECT coordinates FROM locations WHERE id = $1)
         SELECT v.id, v.registration_code, v.vehicle_type, p.name AS provider_name,
           ST_Distance(vl.coordinates, origin.coordinates) AS distance_metres
         FROM vehicles v
         JOIN service_providers p ON p.id = v.provider_id
         JOIN locations vl ON vl.id = v.location_id
         CROSS JOIN origin
         WHERE p.verification_status = 'verified' AND p.operational_status = 'operational'
           AND v.operational_status = 'available'
           AND NOT EXISTS (SELECT 1 FROM assignments a WHERE a.vehicle_id = v.id AND a.status IN ('assigned', 'accepted', 'en_route', 'on_scene'))
           AND ST_DWithin(vl.coordinates, origin.coordinates, $2)
         ORDER BY distance_metres ASC LIMIT 12`, [current.location_id, radiusMeters],
      ),
      this.database.query<{ available_quantity: string; id: string; provider_name: string; resource_name: string; unit: string }>(
        `SELECT ri.id, p.name AS provider_name, rt.display_name AS resource_name, rt.default_unit AS unit,
           ri.on_hand_quantity - ri.reserved_quantity AS available_quantity
         FROM resource_inventory ri
         JOIN service_providers p ON p.id = ri.provider_id
         JOIN resource_types rt ON rt.id = ri.resource_type_id
         WHERE p.verification_status = 'verified' AND p.operational_status = 'operational'
           AND ri.on_hand_quantity > ri.reserved_quantity
         ORDER BY resource_name ASC`),
      this.database.query<{ available_spaces: string; id: string; name: string; provider_name: string | null }>(
        `SELECT s.id, s.name, p.name AS provider_name, s.approved_capacity - s.occupied_count - s.reserved_count AS available_spaces
         FROM shelters s LEFT JOIN service_providers p ON p.id = s.provider_id
         WHERE s.is_operational AND s.approved_capacity > s.occupied_count + s.reserved_count
         ORDER BY available_spaces DESC`),
    ]);
    return {
      request: { id: current.id, label: current.label, status: current.status, urgency: current.urgency }, radiusMeters,
      vehicles: vehicles.rows.map((row) => ({ id: row.id, registrationCode: row.registration_code, vehicleType: row.vehicle_type, providerName: row.provider_name, distanceMetres: Math.round(Number(row.distance_metres)) })),
      inventory: inventory.rows.map((row) => ({ id: row.id, providerName: row.provider_name, resourceName: row.resource_name, unit: row.unit, availableQuantity: Number(row.available_quantity) })),
      shelters: shelters.rows.map((row) => ({ id: row.id, name: row.name, providerName: row.provider_name, availableSpaces: Number(row.available_spaces) })),
    };
  }

  async dispatch(actor: AuthenticatedUser, dto: DispatchVehicleDto): Promise<{ assignmentId: string; requestStatus: string }> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const request = await client.query<{ status: string }>('SELECT status FROM emergency_requests WHERE id = $1 FOR UPDATE', [dto.requestId]);
      if (!request.rows[0]) throw new NotFoundException('Assistance request not found.');
      if (request.rows[0].status !== 'triaged') throw new ConflictException('Only triaged requests can receive a vehicle dispatch.');
      const vehicle = await client.query<{ id: string }>(
        `SELECT v.id FROM vehicles v JOIN service_providers p ON p.id = v.provider_id
         WHERE v.id = $1 AND v.operational_status = 'available' AND p.verification_status = 'verified' AND p.operational_status = 'operational'
         FOR UPDATE`, [dto.vehicleId],
      );
      if (!vehicle.rows[0]) throw new ConflictException('This vehicle is not eligible for dispatch.');
      const active = await client.query<{ id: string }>(`SELECT id FROM assignments WHERE vehicle_id = $1 AND status IN ('assigned', 'accepted', 'en_route', 'on_scene') FOR UPDATE`, [dto.vehicleId]);
      if (active.rows[0]) throw new ConflictException('This vehicle already has an active assignment.');
      const assignment = await client.query<{ id: string }>(`INSERT INTO assignments (request_id, vehicle_id, assigned_by, notes) VALUES ($1, $2, $3, $4) RETURNING id`, [dto.requestId, dto.vehicleId, actor.sub, dto.notes?.trim() || null]);
      await client.query(`UPDATE emergency_requests SET status = 'assigned' WHERE id = $1`, [dto.requestId]);
      await client.query(`INSERT INTO request_events (request_id, actor_id, previous_status, new_status, event_type, reason) VALUES ($1, $2, 'triaged', 'assigned', 'vehicle_dispatched', 'Vehicle dispatch recorded through the local planner')`, [dto.requestId, actor.sub]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'vehicle_dispatched', 'assignment', $2, jsonb_build_object('request_id', $3, 'vehicle_id', $4))`, [actor.sub, assignment.rows[0].id, dto.requestId, dto.vehicleId]);
      await client.query('COMMIT');
      return { assignmentId: assignment.rows[0].id, requestStatus: 'assigned' };
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async reserveInventory(actor: AuthenticatedUser, dto: ReserveInventoryDto): Promise<{ allocationId: string; availableQuantity: number }> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await this.lockActionableRequest(client, dto.requestId);
      const inventory = await client.query<{ available_quantity: string }>('SELECT on_hand_quantity - reserved_quantity AS available_quantity FROM resource_inventory WHERE id = $1 FOR UPDATE', [dto.inventoryId]);
      const available = Number(inventory.rows[0]?.available_quantity);
      if (!inventory.rows[0]) throw new NotFoundException('Inventory item not found.');
      if (available < dto.quantity) throw new ConflictException('Not enough unreserved inventory is available.');
      const allocation = await client.query<{ id: string }>(`INSERT INTO resource_allocations (request_id, inventory_id, allocated_by, quantity) VALUES ($1, $2, $3, $4) RETURNING id`, [dto.requestId, dto.inventoryId, actor.sub, dto.quantity]);
      const updated = await client.query<{ available_quantity: string }>(`UPDATE resource_inventory SET reserved_quantity = reserved_quantity + $1 WHERE id = $2 RETURNING on_hand_quantity - reserved_quantity AS available_quantity`, [dto.quantity, dto.inventoryId]);
      await client.query(`INSERT INTO request_events (request_id, actor_id, event_type, reason) VALUES ($1, $2, 'inventory_reserved', $3)`, [dto.requestId, actor.sub, `Reserved ${dto.quantity} supply units`]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'inventory_reserved', 'resource_allocation', $2, jsonb_build_object('request_id', $3, 'inventory_id', $4, 'quantity', $5))`, [actor.sub, allocation.rows[0].id, dto.requestId, dto.inventoryId, dto.quantity]);
      await client.query('COMMIT');
      return { allocationId: allocation.rows[0].id, availableQuantity: Number(updated.rows[0].available_quantity) };
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async reserveShelter(actor: AuthenticatedUser, dto: ReserveShelterDto): Promise<{ reservationId: string; availableSpaces: number }> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      await this.lockActionableRequest(client, dto.requestId);
      const shelter = await client.query<{ available_spaces: string }>('SELECT approved_capacity - occupied_count - reserved_count AS available_spaces FROM shelters WHERE id = $1 AND is_operational FOR UPDATE', [dto.shelterId]);
      const available = Number(shelter.rows[0]?.available_spaces);
      if (!shelter.rows[0]) throw new NotFoundException('Operational shelter not found.');
      if (available < dto.peopleCount) throw new ConflictException('The shelter does not have enough available spaces.');
      const reservation = await client.query<{ id: string }>(`INSERT INTO shelter_reservations (request_id, shelter_id, reserved_by, people_count) VALUES ($1, $2, $3, $4) RETURNING id`, [dto.requestId, dto.shelterId, actor.sub, dto.peopleCount]);
      const updated = await client.query<{ available_spaces: string }>(`UPDATE shelters SET reserved_count = reserved_count + $1 WHERE id = $2 RETURNING approved_capacity - occupied_count - reserved_count AS available_spaces`, [dto.peopleCount, dto.shelterId]);
      await client.query(`INSERT INTO request_events (request_id, actor_id, event_type, reason) VALUES ($1, $2, 'shelter_reserved', $3)`, [dto.requestId, actor.sub, `Reserved ${dto.peopleCount} shelter spaces`]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details) VALUES ($1, 'shelter_reserved', 'shelter_reservation', $2, jsonb_build_object('request_id', $3, 'shelter_id', $4, 'people_count', $5))`, [actor.sub, reservation.rows[0].id, dto.requestId, dto.shelterId, dto.peopleCount]);
      await client.query('COMMIT');
      return { reservationId: reservation.rows[0].id, availableSpaces: Number(updated.rows[0].available_spaces) };
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  async supplyTracking(): Promise<SupplyTracking> {
    const result = await this.database.query<{ assignment_id: string; current_latitude: string; current_longitude: string; destination_label: string | null; destination_latitude: string; destination_longitude: string; origin_latitude: string; origin_longitude: string; provider_name: string; registration_code: string; status: string; supplies: string; vehicle_type: string }>(
      `SELECT a.id AS assignment_id, a.status, v.registration_code, v.vehicle_type, p.name AS provider_name,
        ST_Y(origin.coordinates::geometry) AS origin_latitude, ST_X(origin.coordinates::geometry) AS origin_longitude,
        ST_Y(destination.coordinates::geometry) AS destination_latitude, ST_X(destination.coordinates::geometry) AS destination_longitude, destination.label AS destination_label,
        COALESCE(ST_Y(last_seen.coordinates::geometry), ST_Y(origin.coordinates::geometry)) AS current_latitude,
        COALESCE(ST_X(last_seen.coordinates::geometry), ST_X(origin.coordinates::geometry)) AS current_longitude,
        COALESCE((SELECT string_agg(rt.display_name || ' · ' || ra.quantity::text || ' ' || rt.default_unit, ', ')
          FROM resource_allocations ra JOIN resource_inventory ri ON ri.id = ra.inventory_id JOIN resource_types rt ON rt.id = ri.resource_type_id
          WHERE ra.request_id = r.id AND ra.status = 'reserved'), 'Vehicle response kit') AS supplies
       FROM assignments a
       JOIN vehicles v ON v.id = a.vehicle_id
       JOIN service_providers p ON p.id = v.provider_id
       JOIN locations origin ON origin.id = v.location_id
       JOIN emergency_requests r ON r.id = a.request_id
       JOIN emergency_incidents i ON i.id = r.incident_id
       JOIN locations destination ON destination.id = i.location_id
       LEFT JOIN LATERAL (SELECT coordinates FROM vehicle_locations WHERE vehicle_id = v.id ORDER BY observed_at DESC LIMIT 1) last_seen ON true
       WHERE a.status IN ('assigned', 'accepted', 'en_route', 'on_scene') ORDER BY a.assigned_at DESC`,
    );
    return { assignments: result.rows.map((row) => {
      const progress = this.progress(row.status);
      return { assignmentId: row.assignment_id, currentLatitude: Number(row.current_latitude), currentLongitude: Number(row.current_longitude), destinationLabel: row.destination_label, destinationLatitude: Number(row.destination_latitude), destinationLongitude: Number(row.destination_longitude), etaMinutes: Math.max(0, Math.round((1 - progress) * 22)), originLatitude: Number(row.origin_latitude), originLongitude: Number(row.origin_longitude), progress, providerName: row.provider_name, registrationCode: row.registration_code, status: row.status, supplies: row.supplies, vehicleType: row.vehicle_type };
    }) };
  }

  async updateAssignmentStatus(actor: AuthenticatedUser, assignmentId: string, dto: UpdateAssignmentStatusDto): Promise<{ status: string }> {
    const client = await this.database.connect();
    try {
      await client.query('BEGIN');
      const assignment = await client.query<{ current_status: string; destination_latitude: string; destination_longitude: string; origin_latitude: string; origin_longitude: string; request_id: string; vehicle_id: string }>(
        `SELECT a.status AS current_status, a.request_id, a.vehicle_id,
          ST_Y(origin.coordinates::geometry) AS origin_latitude, ST_X(origin.coordinates::geometry) AS origin_longitude,
          ST_Y(destination.coordinates::geometry) AS destination_latitude, ST_X(destination.coordinates::geometry) AS destination_longitude
         FROM assignments a JOIN vehicles v ON v.id = a.vehicle_id JOIN locations origin ON origin.id = v.location_id
         JOIN emergency_requests r ON r.id = a.request_id JOIN emergency_incidents i ON i.id = r.incident_id JOIN locations destination ON destination.id = i.location_id
         WHERE a.id = $1 FOR UPDATE OF a`, [assignmentId],
      );
      const current = assignment.rows[0];
      if (!current) throw new NotFoundException('Assignment not found.');
      const allowed: Record<string, string[]> = { assigned: ['accepted', 'en_route', 'cancelled'], accepted: ['en_route', 'cancelled'], en_route: ['on_scene', 'failed'], on_scene: ['completed', 'failed'], completed: [], cancelled: [], failed: [] };
      if (!allowed[current.current_status]?.includes(dto.status)) throw new ConflictException(`Cannot change a ${current.current_status} assignment to ${dto.status}.`);
      await client.query(`UPDATE assignments SET status = $1, completed_at = CASE WHEN $1 IN ('completed', 'cancelled', 'failed') THEN now() ELSE NULL END WHERE id = $2`, [dto.status, assignmentId]);
      const progress = this.progress(dto.status);
      const latitude = Number(current.origin_latitude) + (Number(current.destination_latitude) - Number(current.origin_latitude)) * progress;
      const longitude = Number(current.origin_longitude) + (Number(current.destination_longitude) - Number(current.origin_longitude)) * progress;
      await client.query(`INSERT INTO vehicle_locations (vehicle_id, coordinates, source, observed_at) VALUES ($1, make_wgs84_geography($2, $3), 'simulated', now())`, [current.vehicle_id, longitude, latitude]);
      if (dto.status === 'en_route' || dto.status === 'on_scene') await client.query(`UPDATE emergency_requests SET status = 'in_progress' WHERE id = $1 AND status = 'assigned'`, [current.request_id]);
      if (dto.status === 'completed') await client.query(`UPDATE emergency_requests SET status = 'fulfilled', closed_at = now() WHERE id = $1 AND status IN ('assigned', 'in_progress')`, [current.request_id]);
      if (['completed', 'cancelled', 'failed'].includes(dto.status)) await client.query(`UPDATE vehicles SET operational_status = 'available' WHERE id = $1`, [current.vehicle_id]);
      await client.query(`INSERT INTO audit_logs (actor_id, action, entity_type, entity_id) VALUES ($1, 'assignment_tracking_updated', 'assignment', $2)`, [actor.sub, assignmentId]);
      await client.query('COMMIT');
      return { status: dto.status };
    } catch (error: unknown) { await client.query('ROLLBACK'); throw error; } finally { client.release(); }
  }

  private async lockActionableRequest(client: PoolClient, requestId: string): Promise<void> {
    const result = await client.query<{ id: string }>('SELECT id FROM emergency_requests WHERE id = $1 AND status IN (\'triaged\', \'assigned\', \'in_progress\') FOR UPDATE', [requestId]);
    if (!result.rows[0]) throw new ConflictException('Only triaged or active requests can receive a reservation.');
  }

  private radius(value?: string): number {
    if (!value) return 5000;
    const parsed = Number(value);
    if (!Number.isInteger(parsed) || parsed < 250 || parsed > 50000) throw new BadRequestException('radiusMeters must be an integer between 250 and 50000.');
    return parsed;
  }

  private progress(status: string): number { return ({ assigned: 0.08, accepted: 0.25, en_route: 0.58, on_scene: 1 } as Record<string, number>)[status] ?? 1; }
}
