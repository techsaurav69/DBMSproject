import 'dotenv/config';
import { Pool, type PoolClient } from 'pg';

const databaseUrl = process.env.DATABASE_URL ?? (() => {
  const user = process.env.POSTGRES_USER ?? 'crisisgrid_app';
  const password = process.env.POSTGRES_PASSWORD ?? 'change-this-local-password';
  const database = process.env.POSTGRES_DB ?? 'crisisgrid';
  const port = process.env.POSTGRES_PORT ?? '5432';
  return `postgresql://${encodeURIComponent(user)}:${encodeURIComponent(password)}@localhost:${port}/${encodeURIComponent(database)}`;
})();

export const pool = new Pool({ connectionString: databaseUrl });

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

