import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pool } from './database';

async function main(): Promise<void> {
  const sql = await readFile(join(process.cwd(), 'database', 'tests', 'schema-integrity.sql'), 'utf8');
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    await client.query('ROLLBACK');
    console.log('Schema integrity checks passed; test transaction rolled back.');
  } finally {
    client.release();
  }
}

void main().finally(async () => {
  await pool.end();
});

