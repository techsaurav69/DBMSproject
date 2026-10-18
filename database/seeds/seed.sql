-- Fictional local-development data only. It must never be used as production data.
INSERT INTO roles (code, description) VALUES
  ('citizen', 'Can report incidents and create their own assistance requests.'),
  ('coordinator', 'Coordinates incidents, requests, and eligible resources.'),
  ('provider_operator', 'Manages resources for their demo provider.'),
  ('responder', 'Views assigned operational work.'),
  ('administrator', 'Manages reference data and audits.')
ON CONFLICT (code) DO NOTHING;

INSERT INTO users (id, email, display_name, password_hash) VALUES
  ('00000000-0000-4000-8000-000000000001', 'citizen.demo@crisisgrid.local', 'Asha Demo', crypt('DemoOnly!ChangeBeforeProduction', gen_salt('bf', 12))),
  ('00000000-0000-4000-8000-000000000002', 'coordinator.demo@crisisgrid.local', 'Saurav Demo', crypt('DemoOnly!ChangeBeforeProduction', gen_salt('bf', 12))),
  ('00000000-0000-4000-8000-000000000003', 'provider.demo@crisisgrid.local', 'River Demo', crypt('DemoOnly!ChangeBeforeProduction', gen_salt('bf', 12))),
  ('00000000-0000-4000-8000-000000000004', 'responder.demo@crisisgrid.local', 'Mira Demo', crypt('DemoOnly!ChangeBeforeProduction', gen_salt('bf', 12))),
  ('00000000-0000-4000-8000-000000000005', 'admin.demo@crisisgrid.local', 'Admin Demo', crypt('DemoOnly!ChangeBeforeProduction', gen_salt('bf', 12)))
ON CONFLICT (id) DO NOTHING;

INSERT INTO user_roles (user_id, role_code) VALUES
  ('00000000-0000-4000-8000-000000000001', 'citizen'),
  ('00000000-0000-4000-8000-000000000002', 'coordinator'),
  ('00000000-0000-4000-8000-000000000003', 'provider_operator'),
  ('00000000-0000-4000-8000-000000000004', 'responder'),
  ('00000000-0000-4000-8000-000000000005', 'administrator')
ON CONFLICT (user_id, role_code) DO NOTHING;

INSERT INTO disasters (id, name, emergency_type, status, description, started_at) VALUES
  ('10000000-0000-4000-8000-000000000001', 'Northbank Flood Response Exercise', 'flood', 'active', 'A fictional local exercise used to demonstrate response coordination.', now() - interval '2 hours')
ON CONFLICT (id) DO NOTHING;

INSERT INTO locations (id, label, coordinates, source) VALUES
  ('20000000-0000-4000-8000-000000000001', 'Fictional Northbank operations point', ST_SetSRID(ST_MakePoint(77.5800, 12.9200), 4326)::geography, 'operator'),
  ('20000000-0000-4000-8000-000000000002', 'Fictional Riverside request point', ST_SetSRID(ST_MakePoint(77.5840, 12.9240), 4326)::geography, 'manual'),
  ('20000000-0000-4000-8000-000000000003', 'Fictional Hillview request point', ST_SetSRID(ST_MakePoint(77.5920, 12.9280), 4326)::geography, 'manual'),
  ('20000000-0000-4000-8000-000000000004', 'Fictional Harbor Aid base', ST_SetSRID(ST_MakePoint(77.5760, 12.9180), 4326)::geography, 'operator'),
  ('20000000-0000-4000-8000-000000000005', 'Fictional Skyway Response base', ST_SetSRID(ST_MakePoint(77.5990, 12.9310), 4326)::geography, 'operator'),
  ('20000000-0000-4000-8000-000000000006', 'Fictional Northbank shelter', ST_SetSRID(ST_MakePoint(77.5870, 12.9220), 4326)::geography, 'operator')
ON CONFLICT (id) DO NOTHING;

INSERT INTO affected_areas (id, disaster_id, name, boundary) VALUES
  ('30000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', 'Fictional Northbank affected area', ST_Multi(ST_GeomFromText('POLYGON((77.5700 12.9120,77.6060 12.9120,77.6060 12.9380,77.5700 12.9380,77.5700 12.9120))', 4326)))
ON CONFLICT (id) DO NOTHING;

INSERT INTO emergency_incidents (id, disaster_id, location_id, reporter_id, source, emergency_type, severity, status, description) VALUES
  ('40000000-0000-4000-8000-000000000001', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000002', '00000000-0000-4000-8000-000000000001', 'citizen_report', 'flood', 'high', 'verified', 'Fictional report of people unable to leave a flooded riverside access road.'),
  ('40000000-0000-4000-8000-000000000002', '10000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000003', NULL, 'operator_report', 'flood', 'medium', 'in_progress', 'Fictional report of a water distribution need near Hillview.')
ON CONFLICT (id) DO NOTHING;

INSERT INTO emergency_requests (id, incident_id, created_by, category, urgency, status, description, people_count) VALUES
  ('50000000-0000-4000-8000-000000000001', '40000000-0000-4000-8000-000000000001', '00000000-0000-4000-8000-000000000001', 'rescue', 'critical', 'open', 'Fictional rescue request for residents at the riverside access road.', 4),
  ('50000000-0000-4000-8000-000000000002', '40000000-0000-4000-8000-000000000002', NULL, 'water', 'high', 'triaged', 'Fictional potable-water request for the Hillview area.', 25)
ON CONFLICT (id) DO NOTHING;

INSERT INTO service_providers (id, name, location_id, verification_status, operational_status) VALUES
  ('60000000-0000-4000-8000-000000000001', 'Fictional Harbor Aid Cooperative', '20000000-0000-4000-8000-000000000004', 'verified', 'operational'),
  ('60000000-0000-4000-8000-000000000002', 'Fictional Skyway Response Group', '20000000-0000-4000-8000-000000000005', 'pending', 'operational')
ON CONFLICT (id) DO NOTHING;

INSERT INTO resource_types (id, code, display_name, category, default_unit) VALUES
  ('70000000-0000-4000-8000-000000000001', 'rescue_boat', 'Rescue boat', 'vehicle', 'vehicle'),
  ('70000000-0000-4000-8000-000000000002', 'water_pack', 'Water pack', 'supply', 'pack'),
  ('70000000-0000-4000-8000-000000000003', 'first_aid_kit', 'First-aid kit', 'supply', 'kit')
ON CONFLICT (id) DO NOTHING;

INSERT INTO vehicles (id, provider_id, resource_type_id, location_id, registration_code, vehicle_type, operational_status) VALUES
  ('80000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000004', 'DEMO-BOAT-01', 'rescue_boat', 'available'),
  ('80000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000002', '70000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000005', 'DEMO-BOAT-02', 'rescue_boat', 'available')
ON CONFLICT (id) DO NOTHING;

INSERT INTO responders (id, provider_id, display_name, specialty) VALUES
  ('90000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', 'Mira Demo', 'Water rescue')
ON CONFLICT (id) DO NOTHING;

INSERT INTO resource_inventory (id, provider_id, resource_type_id, on_hand_quantity, reserved_quantity) VALUES
  ('a0000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000002', 120, 0),
  ('a0000000-0000-4000-8000-000000000002', '60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000003', 30, 0)
ON CONFLICT (id) DO NOTHING;

INSERT INTO shelters (id, provider_id, location_id, name, approved_capacity, occupied_count, reserved_count) VALUES
  ('b0000000-0000-4000-8000-000000000001', '60000000-0000-4000-8000-000000000001', '20000000-0000-4000-8000-000000000006', 'Fictional Northbank Community Shelter', 80, 12, 0)
ON CONFLICT (id) DO NOTHING;
