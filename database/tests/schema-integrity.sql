DO $$
DECLARE
  test_request uuid := '50000000-0000-4000-8000-000000000001';
  test_vehicle uuid := '80000000-0000-4000-8000-000000000001';
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
