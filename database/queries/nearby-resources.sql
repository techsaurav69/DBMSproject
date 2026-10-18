-- Uses straight-line geography distance in metres. Replace coordinates/radius for repeatable demos.
EXPLAIN (ANALYZE, BUFFERS)
WITH search_origin AS (
  SELECT ST_SetSRID(ST_MakePoint(77.5840, 12.9240), 4326)::geography AS point
)
SELECT vehicle.id, vehicle.registration_code, vehicle.vehicle_type, provider.name AS provider_name,
  ST_Distance(location.coordinates, search_origin.point) AS distance_metres
FROM vehicles AS vehicle
JOIN service_providers AS provider ON provider.id = vehicle.provider_id
JOIN locations AS location ON location.id = vehicle.location_id
CROSS JOIN search_origin
WHERE provider.verification_status = 'verified'
  AND provider.operational_status = 'operational'
  AND vehicle.operational_status = 'available'
  AND ST_DWithin(location.coordinates, search_origin.point, 5000)
ORDER BY distance_metres;
