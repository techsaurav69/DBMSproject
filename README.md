# CrisisGrid

CrisisGrid is a **local-only prototype** for disaster response and emergency-resource coordination. It uses fictional data only and does not contact real emergency services.

## Local addresses

- Web app: `http://localhost:5173`
- API: `http://localhost:3000/api/v1`
- API health check: `http://localhost:3000/api/v1/health`
- API documentation: `http://localhost:3000/api/docs`

## Prerequisites

- Node.js 22 or newer
- npm 10 or newer
- Docker Desktop running (for PostgreSQL + PostGIS)

## Start the foundation

```powershell
npm install
Copy-Item .env.example .env
npm run db:up
npm run db:migrate
npm run db:seed
npm run dev:api
```

In a second terminal:

```powershell
npm run dev:web
```

Run the project checks with:

```powershell
npm run lint
npm run typecheck
npm test
npm run build
npm run db:verify
npm run api:verify-auth
```

## Status

This repository currently contains Phases 1–3 foundations. Authentication and local role-aware access are implemented; operational APIs, maps, and deployment are intentionally not implemented yet.

## Verify PostGIS

After the database starts, verify the extension from PowerShell:

```powershell
docker compose exec db psql -U crisisgrid_app -d crisisgrid -c "SELECT PostGIS_Full_Version();"
```

