# Phase 2 verification evidence

Verified locally on 16 October 2026 against the Docker PostGIS database.

## Commands run

```powershell
npm run db:migrate
npm run db:seed
npm run db:verify
Get-Content database/queries/nearby-resources.sql | docker compose exec -T db psql -U crisisgrid_app -d crisisgrid
Get-Content database/queries/incidents-in-affected-area.sql | docker compose exec -T db psql -U crisisgrid_app -d crisisgrid
Get-Content database/queries/dashboard-summary.sql | docker compose exec -T db psql -U crisisgrid_app -d crisisgrid
```

## Results

- Migration `005_coordinate_validation.sql` applied after the initial verification exposed PostGIS coordinate normalization behavior.
- The integrity suite passed and rolled its test transaction back. It confirms foreign-key, negative-quantity, invalid-coordinate, and duplicate-active-assignment protections.
- The affected-area `EXPLAIN (ANALYZE, BUFFERS)` used `emergency_incidents_disaster_id_idx`; PostgreSQL used a sequential scan for the six-row `locations` seed table, which is expected and is not treated as a performance failure.
- The database-backed dashboard summary returned 2 open incidents, 2 open requests, 2 available vehicles, 0 active assignments, 150 available supply units, and 68 available shelter spaces.

## Limitation

The small, intentionally fictional seed dataset is appropriate for correctness checks but not for performance claims. Larger representative data is required before comparing index performance.
