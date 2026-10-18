import { createHash } from 'node:crypto';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool, withTransaction } from './database';

const migrationsDirectory = join(process.cwd(), 'database', 'migrations');

async function main(): Promise<void> {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename text PRIMARY KEY,
      checksum text NOT NULL,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `);

  const files = (await readdir(migrationsDirectory))
    .filter((file) => /^\d{3}_.+\.sql$/.test(file))
    .sort();

  for (const filename of files) {
    const sql = await readFile(join(migrationsDirectory, filename), 'utf8');
    const checksum = createHash('sha256').update(sql).digest('hex');
    const existing = await pool.query<{ checksum: string }>(
      'SELECT checksum FROM schema_migrations WHERE filename = $1',
      [filename],
    );

    if (existing.rowCount) {
      if (existing.rows[0].checksum !== checksum) {
        throw new Error(`Applied migration has changed: ${filename}`);
      }
      console.log(`skip ${filename}`);
      continue;
    }

    await withTransaction(async (client) => {
      await client.query(sql);
      await client.query(
        'INSERT INTO schema_migrations (filename, checksum) VALUES ($1, $2)',
        [filename, checksum],
      );
    });
    console.log(`apply ${filename}`);
  }
}

void main().finally(async () => {
  await pool.end();
});

