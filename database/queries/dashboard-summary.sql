SELECT
  (SELECT count(*) FROM emergency_incidents WHERE status IN ('reported', 'verified', 'in_progress')) AS open_incidents,
  (SELECT count(*) FROM emergency_requests WHERE status IN ('open', 'triaged', 'assigned', 'in_progress')) AS open_requests,
  (SELECT count(*) FROM vehicles WHERE operational_status = 'available') AS available_vehicles,
  (SELECT count(*) FROM assignments WHERE status IN ('assigned', 'accepted', 'en_route', 'on_scene')) AS active_assignments,
  (SELECT coalesce(sum(on_hand_quantity - reserved_quantity), 0) FROM resource_inventory) AS available_supply_units,
  (SELECT coalesce(sum(approved_capacity - occupied_count - reserved_count), 0) FROM shelters WHERE is_operational) AS available_shelter_spaces;
