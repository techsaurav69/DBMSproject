EXPLAIN (ANALYZE, BUFFERS)
SELECT incident.id, incident.status, incident.severity, incident.reported_at
FROM emergency_incidents AS incident
JOIN locations AS location ON location.id = incident.location_id
JOIN affected_areas AS area ON area.disaster_id = incident.disaster_id
WHERE ST_Intersects(location.coordinates::geometry, area.boundary)
  AND area.id = '30000000-0000-4000-8000-000000000001';
