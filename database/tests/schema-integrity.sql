DO $$
DECLARE
  test_location uuid;
  test_incident uuid;
  test_request uuid;
  test_provider uuid;
  test_vehicle uuid;
BEGIN
  BEGIN
    INSERT INTO emergency_requests (incident_id, category, urgency, description)
    VALUES ('ffffffff-ffff-4fff-8fff-ffffffffffff', 'water', 'low', 'This foreign-key test must fail safely.');
    RAISE EXCEPTION 'foreign key protection failed';
  EXCEPTION WHEN foreign_key_violation THEN NULL;
  END;

  BEGIN
    INSERT INTO resource_inventory (provider_id, resource_type_id, on_hand_quantity)
    VALUES ('60000000-0000-4000-8000-000000000001', '70000000-0000-4000-8000-000000000001', -1);
    RAISE EXCEPTION 'quantity check protection failed';
  EXCEPTION WHEN check_violation THEN NULL;
  END;

  BEGIN
    PERFORM make_wgs84_geography(77.58, 91);
    RAISE EXCEPTION 'coordinate validation failed';
  EXCEPTION WHEN SQLSTATE '22023' THEN NULL;
  END;

  -- Build a minimal, self-contained valid graph. The verifier must work on a
  -- newly migrated hosted database, where fictional local seed data is absent.
  INSERT INTO locations (label, coordinates, source)
  VALUES ('Schema verification point', make_wgs84_geography(77.58, 12.92), 'operator')
  RETURNING id INTO test_location;

  INSERT INTO emergency_incidents (location_id, source, emergency_type, severity, description)
  VALUES (test_location, 'operator_report', 'flood', 'low', 'Schema verifier incident record.')
  RETURNING id INTO test_incident;

  INSERT INTO emergency_requests (incident_id, category, urgency, description)
  VALUES (test_incident, 'water', 'low', 'Schema verifier assistance request.')
  RETURNING id INTO test_request;

  INSERT INTO service_providers (name, location_id, verification_status, operational_status)
  VALUES ('Schema verifier provider', test_location, 'verified', 'operational')
  RETURNING id INTO test_provider;

  INSERT INTO vehicles (provider_id, location_id, registration_code, vehicle_type, operational_status)
  VALUES (test_provider, test_location, 'VERIFY-UNIT-01', 'rescue_boat', 'available')
  RETURNING id INTO test_vehicle;

  INSERT INTO assignments (request_id, vehicle_id, status)
  VALUES (test_request, test_vehicle, 'assigned');

  BEGIN
    INSERT INTO assignments (request_id, vehicle_id, status)
    VALUES (test_request, test_vehicle, 'en_route');
    RAISE EXCEPTION 'active assignment uniqueness failed';
  EXCEPTION WHEN unique_violation THEN NULL;
  END;
END;
$$;
