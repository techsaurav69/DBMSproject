import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { Pool, type PoolClient } from 'pg';

const databaseUrl = process.env.DATABASE_URL ?? (() => {
  const user = process.env.POSTGRES_USER ?? 'crisisgrid_app';
  const password = process.env.POSTGRES_PASSWORD ?? 'change-this-local-password';
  const database = process.env.POSTGRES_DB ?? 'crisisgrid';
  const port = process.env.POSTGRES_PORT ?? '5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${port}/${encodeURIComponent(database)}`;
})();

/**
 * For hosted Postgres providers such as Supabase, set DATABASE_SSL_CA_FILE to
 * the provider CA certificate downloaded from its dashboard. Keeping the
 * certificate outside the repository lets Node verify the database identity
 * instead of accepting an arbitrary certificate.
 */
function createPool(): Pool {
  const certificateFile = process.env.DATABASE_SSL_CA_FILE;
  const certificatePem = process.env.DATABASE_SSL_CA_PEM;

  if (!certificateFile && !certificatePem) {
    return new Pool({ connectionString: databaseUrl });
  }

  const connectionUrl = new URL(databaseUrl);
  // node-postgres lets SSL query parameters replace the explicit `ssl` object.
  // The CA file below is the single source of truth for verified TLS.
  connectionUrl.searchParams.delete('sslmode');
  connectionUrl.searchParams.delete('sslrootcert');
  connectionUrl.searchParams.delete('sslcert');
  connectionUrl.searchParams.delete('sslkey');

  return new Pool({
    connectionString: connectionUrl.toString(),
    ssl: {
      ca: certificateFile
        ? readFileSync(certificateFile, 'utf8')
        : certificatePem!.replace(/\\n/g, '\n'),
      rejectUnauthorized: true,
    },
  });
}

export const pool = createPool();

export async function withTransaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

