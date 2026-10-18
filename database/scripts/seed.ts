import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool, withTransaction } from './database';

async function main(): Promise<void> {
  const sql = await readFile(join(process.cwd(), 'database', 'seeds', 'seed.sql'), 'utf8');
  await withTransaction((client) => client.query(sql));
  console.log('Fictional development seed data applied.');
}

void main().finally(async () => {
  await pool.end();
});

