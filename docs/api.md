# API overview

Base URL: `http://localhost:3000/api/v1`. Interactive local Swagger documentation is available at `http://localhost:3000/api/docs` when the API is running.

## Implemented in Phase 3

| Method | Route | Access | Result |
| --- | --- | --- | --- |
| `GET` | `/health` | Public | API and database readiness. |
| `POST` | `/auth/register` | Public | Creates a Citizen user and returns a JWT. |
| `POST` | `/auth/login` | Public | Verifies bcrypt credentials and returns a JWT. |
| `GET` | `/auth/me` | Bearer token | Returns the token holder's live roles/profile. |
| `GET` | `/users` | Administrator token | Returns local user identities and roles, never password hashes. |

## Coordination workbench

Coordinator, provider-operator, and administrator accounts can use the local-only coordination routes below. Mutating routes use database transactions and row locks; the system never contacts real vehicles, providers, shelters, or emergency services.

| Method | Route | Result |
| --- | --- | --- |
| `GET` | `/coordination/requests/:id/candidates?radiusMeters=5000` | Finds verified nearby vehicles with PostGIS and lists reservable inventory/shelter capacity. |
| `POST` | `/coordination/dispatches` | Creates one vehicle assignment for a triaged request and updates it to `assigned`. |
| `POST` | `/coordination/inventory-reservations` | Reserves available local-demo inventory. |
| `POST` | `/coordination/shelter-reservations` | Reserves local-demo shelter capacity. |

## Advisory and notifications

`GET /integrations/nasa-natural-events` returns a small cached NASA EONET open-event sample. `GET /notifications` returns local in-app coordination reminders; the `PATCH /notifications/:id/read` and `PATCH /notifications/read-all` routes persist read state for the signed-in local user. Neither API sends public alerts or writes external data into local incidents.

## Error shape

Every HTTP failure uses the shape below. Validation errors use an array in `message`.

```json
{
  "statusCode": 401,
  "errorCode": "Unauthorized",
  "message": "A bearer token is required.",
  "path": "/api/v1/auth/me",
  "timestamp": "2026-10-16T00:00:00.000Z"
}
```

The server validates all inputs, uses parameterized SQL, and does not return password hashes.
