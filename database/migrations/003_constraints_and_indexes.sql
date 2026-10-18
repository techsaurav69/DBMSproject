CREATE INDEX affected_areas_boundary_gix ON affected_areas USING gist (boundary);
CREATE INDEX locations_coordinates_gix ON locations USING gist (coordinates);
CREATE INDEX vehicle_locations_coordinates_gix ON vehicle_locations USING gist (coordinates);

CREATE INDEX emergency_incidents_disaster_id_idx ON emergency_incidents (disaster_id);
CREATE INDEX emergency_incidents_location_id_idx ON emergency_incidents (location_id);
CREATE INDEX emergency_incidents_status_reported_at_idx ON emergency_incidents (status, reported_at DESC);
CREATE INDEX emergency_requests_incident_id_idx ON emergency_requests (incident_id);
CREATE INDEX emergency_requests_status_created_at_idx ON emergency_requests (status, created_at DESC);
CREATE INDEX emergency_requests_created_by_idx ON emergency_requests (created_by);
CREATE INDEX service_providers_operational_idx ON service_providers (verification_status, operational_status);
CREATE INDEX vehicles_provider_id_idx ON vehicles (provider_id);
CREATE INDEX vehicles_location_id_idx ON vehicles (location_id);
CREATE INDEX vehicles_operational_status_idx ON vehicles (operational_status);
CREATE INDEX resource_inventory_provider_id_idx ON resource_inventory (provider_id);
CREATE INDEX shelters_location_id_idx ON shelters (location_id);
CREATE INDEX assignments_request_id_idx ON assignments (request_id);
CREATE INDEX assignments_status_idx ON assignments (status);
CREATE INDEX resource_allocations_request_id_idx ON resource_allocations (request_id);
CREATE INDEX shelter_reservations_request_id_idx ON shelter_reservations (request_id);
CREATE INDEX vehicle_locations_vehicle_observed_at_idx ON vehicle_locations (vehicle_id, observed_at DESC);
CREATE INDEX request_events_request_created_at_idx ON request_events (request_id, created_at);
CREATE INDEX audit_logs_entity_occurred_at_idx ON audit_logs (entity_type, entity_id, occurred_at DESC);

CREATE UNIQUE INDEX assignments_one_active_vehicle_idx
  ON assignments (vehicle_id)
  WHERE status IN ('assigned', 'accepted', 'en_route', 'on_scene');

CREATE OR REPLACE FUNCTION enforce_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER disasters_set_updated_at BEFORE UPDATE ON disasters
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER incidents_set_updated_at BEFORE UPDATE ON emergency_incidents
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER requests_set_updated_at BEFORE UPDATE ON emergency_requests
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER providers_set_updated_at BEFORE UPDATE ON service_providers
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER vehicles_set_updated_at BEFORE UPDATE ON vehicles
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER inventory_set_updated_at BEFORE UPDATE ON resource_inventory
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER shelters_set_updated_at BEFORE UPDATE ON shelters
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER assignments_set_updated_at BEFORE UPDATE ON assignments
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER resource_allocations_set_updated_at BEFORE UPDATE ON resource_allocations
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
CREATE TRIGGER shelter_reservations_set_updated_at BEFORE UPDATE ON shelter_reservations
FOR EACH ROW EXECUTE FUNCTION enforce_updated_at();
