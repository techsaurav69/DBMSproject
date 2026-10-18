# Live integrations

## Active now: public advisory feeds

CrisisGrid proxies public advisory data through the Nest API so the browser does not depend on a third-party CORS policy. The dashboard currently uses Open-Meteo, USGS, NASA EONET, OSIRIS, and GDACS. They are reference signals only: no feed item automatically becomes a local incident or dispatch.

The GDACS endpoint is cached for five minutes in the API process to avoid unnecessary upstream traffic. Its alerts appear on the Global live intelligence map as green, orange, or red markers.

## Next: Mapbox

Create a separate Mapbox public token for this project, limit it to the deployed domain and localhost during development, and put it only in `VITE_MAPBOX_PUBLIC_TOKEN` in `.env`. It can be used for browser map tiles, address search, and route display. Do not use or expose a Mapbox secret token in the web app.

## Next: Firebase Cloud Messaging

Create a Firebase project and enable Cloud Messaging. Browser configuration values can be added to the `VITE_FIREBASE_*` variables. The Firebase Admin service account values belong only in the API runtime environment. Before enabling it for users, deploy over HTTPS and add a service worker; local in-app notifications continue to work without Firebase.

## Operational safety

- Treat incoming public data as advisory, not verified local information.
- Require a coordinator to review an external event before creating a local incident.
- Do not send SMS, email, or push notifications to real people without opt-in recipients and tested escalation rules.
- Rotate tokens and use provider domain restrictions before deployment.
