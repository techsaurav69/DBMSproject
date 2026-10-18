# CrisisGrid requirements

## Scope

Build a local, fictional-data prototype for reporting emergencies and coordinating resources. It is not an emergency-service dispatch system and must not claim real provider, GPS, or alert integrations.

## MVP outcome

Citizens can report incidents and request help. Authorized coordinators can see permitted operational information, search nearby eligible resources, and safely allocate vehicles, supplies, or shelter capacity. PostgreSQL/PostGIS constraints and transactions must preserve correctness under concurrent requests.

## Delivery sequence

1. Local project skeleton and PostGIS environment.
2. Schema, migrations, seed data, and database integrity proofs.
3. Authentication, authorization, validation, and API documentation.
4. Disaster, incident, and assistance-request workflows.
5. Provider/resource management and nearby PostGIS search.
6. Transaction-safe dispatch, inventory allocations, and shelter reservations.
7. Command dashboard and completed operational UX.
8. Security/quality pass and reproducible demo documentation.

## Local-only boundary

The web app, NestJS API, and PostgreSQL/PostGIS database run on localhost. Deployment and external integrations remain out of scope until the MVP has passed its local verification gates.

