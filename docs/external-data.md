# Advisory external data

CrisisGrid's local dashboard uses two optional, server-proxied public sources. They require no API key for this local, non-commercial prototype:

- **Open-Meteo** provides current weather for the fictional Northbank operations point. The response is cached for ten minutes.
- **USGS** provides a global M2.5+ earthquake GeoJSON feed. The response is cached for five minutes.
- **OSIRIS Intelligence** provides public global earthquake, fire-hotspot, and weather-event signals, plus high-level source counts. CrisisGrid normalizes a small advisory sample and caches it for one minute.
- **NASA EONET v3** provides an independent curated reference of open natural events. CrisisGrid requests a small open-event sample and caches it for five minutes.

These feeds are informational only. An external record is never automatically inserted as a CrisisGrid disaster, incident, request, or dispatch. The OSIRIS card is explicitly labelled as unverified global signals. If a public source is unavailable, the API returns a clear `503` response and the database-backed dashboard remains usable.

The notification center is separate from external feeds. It is a local in-app reminder system for triaged requests, active demo assignments, and low local-demo inventory. It persists each user's read state but does not send browser, SMS, email, or emergency-service alerts.

On Windows, the API development command uses Node's system certificate store. This keeps normal TLS certificate validation enabled while allowing the local runtime to trust organization-managed Windows root certificates when proxying public advisory feeds.

The interactive map uses Leaflet's browser build with OpenStreetMap tiles. It renders fictional local PostGIS data and labels vehicle locations as resource positions, not real-time tracking.

For deployment, use an approved mapping provider or host tiles that match expected traffic and the provider's terms. Keep any provider credentials on the server or in deployment configuration; never commit them to this repository.
