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

This repository contains a local-first CrisisGrid prototype with role-aware access, operational workflows, maps, a community-aid area, and public advisory reference feeds. It uses fictional data and is not connected to emergency services.

For production hosting, see [Vercel deployment](docs/vercel-deployment.md). A hosted deployment requires a separately provisioned PostgreSQL/PostGIS database and production environment variables.

## Verify PostGIS

After the database starts, verify the extension from PowerShell:

```powershell
docker compose exec db psql -U crisisgrid_app -d crisisgrid -c "SELECT PostGIS_Full_Version();"
```

