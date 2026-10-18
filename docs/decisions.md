# Architecture decisions

| Decision | Choice | Reason |
| --- | --- | --- |
| Repository layout | npm workspaces monorepo | Keeps web and API separate while sharing root commands. |
| Web client | React + TypeScript + Vite | Fast local iteration with a typed browser client. |
| API | NestJS + TypeScript | Structured modules, validation, and a clear REST foundation. |
| Database access | PostgreSQL with PostGIS and `pg` | Makes SQL, locking, transactions, constraints, and spatial behavior explicit for the DBMS project. |
| Local database | Docker Compose PostGIS | Repeatable local setup without cloud hosting. |
| Map plan | Leaflet + OpenStreetMap | Suitable MVP map with no proprietary provider requirement. |
| Deployment | Deferred | The current goal is a verified localhost MVP. |
| Primary identifiers | UUID via `pgcrypto` | Lets API and database create identifiers safely without sequence coupling. |
| Spatial columns | Geography points + geometry boundaries | Geography gives metre-based proximity; geometry models affected-area polygons. |
| Migration policy | Immutable, checksum-tracked SQL files | Makes DBMS behavior reviewable and prevents silent schema drift. |
| Authentication | Bcrypt-compatible hashes, JWT bearer tokens | Seeded PostgreSQL bcrypt hashes and newly registered accounts use the same verification format. |
| Authorization | Server-side guard plus role metadata | Protects API routes even when a caller bypasses the frontend. |

## Phase 1 limitation

Docker Desktop is installed on this workstation, but its Linux engine was not reachable during initial setup. Database health/PostGIS checks remain blocked until Docker Desktop is running.

