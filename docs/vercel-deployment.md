# Vercel deployment

This app can be deployed as one Vercel project: the React application is served as static output and the Nest API runs through the `api/[...path].js` serverless function.

## Before deploying

Create a production PostgreSQL database with the **PostGIS** extension. Supabase is one appropriate option because it supports PostGIS; do not use the local Docker connection string in production. Enable PostGIS under Database → Extensions before migration. See the [Supabase PostGIS documentation](https://supabase.com/docs/guides/database/extensions/postgis).

Run the existing migrations against that production database from a trusted local terminal. Do not put database credentials in Git:

```powershell
$env:DATABASE_URL = "your-production-connection-string"
npm run db:migrate
```

## Vercel setup

1. Import `techsaurav69/DBMSproject` from GitHub into Vercel.
2. Keep the **Root Directory** as the repository root; the provided `vercel.json` builds both workspaces.
3. Add these Production environment variables in Vercel:

   - `DATABASE_URL`: pooled SSL connection string for the production Postgres/PostGIS database.
   - For local migrations against Supabase, download its CA certificate and set
     `DATABASE_SSL_CA_FILE` to its absolute path. This enables certificate
     verification; do not commit the certificate or database URL.
   - `DATABASE_SSL_CA_PEM`: the complete text from the downloaded Supabase
     certificate, with line breaks represented as `\\n`. This allows the Vercel
     function to verify the database certificate without a local file.
   - `JWT_SECRET`: a unique random secret of at least 32 characters.
   - `JWT_EXPIRES_IN`: `8h` is a suitable starting point.
   - `WEB_ORIGIN`: the final Vercel URL, for example `https://your-project.vercel.app`.
   - `NODE_ENV`: `production`.

4. Deploy. The web app and API use the same Vercel origin, so client requests continue using `/api/v1`.
5. After Vercel assigns the production URL, update `WEB_ORIGIN` to that exact URL and redeploy once.

## Safety notes

- Never deploy the sample `.env` values, seeded demo passwords, or local Docker database.
- This remains a fictional-data prototype; it is not connected to emergency services.
- Vercel functions can restart between calls. The PostgreSQL database is the durable store; migrations must be completed before use.
