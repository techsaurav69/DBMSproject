# Database verification

Run from the repository root after Docker Desktop is running:

```powershell
npm install
npm run db:migrate
npm run db:seed
npm run db:verify
```

`db:migrate` tracks immutable SQL-file checksums in `schema_migrations`; it skips unchanged files and fails if an applied migration has been edited. `db:seed` is repeatable because records use stable IDs and conflict-safe inserts. `db:verify` rolls back its negative-test transaction.

## Expected integrity evidence

`db:verify` must pass after confirming PostgreSQL rejects an unknown incident foreign key, negative inventory, invalid latitude, and duplicate active assignment.

## Query-plan evidence

```powershell
Get-Content database/queries/nearby-resources.sql | docker compose exec -T db psql -U crisisgrid_app -d crisisgrid
Get-Content database/queries/incidents-in-affected-area.sql | docker compose exec -T db psql -U crisisgrid_app -d crisisgrid
Get-Content database/queries/dashboard-summary.sql | docker compose exec -T db psql -U crisisgrid_app -d crisisgrid
```

The seed set is intentionally small, so PostgreSQL may choose sequential scans despite GiST indexes. Record that behavior honestly; do not claim performance gains without representative data.

The Phase 2 run evidence is recorded in [phase-2-evidence.md](phase-2-evidence.md).
