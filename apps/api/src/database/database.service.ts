import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    if (!config.databaseSslCa) {
      this.pool = new Pool({ connectionString: config.databaseUrl });
      return;
    }

    const connectionUrl = new URL(config.databaseUrl);
    // SSL parameters in a connection string replace node-postgres' explicit
    // ssl object, which would discard the provider CA below.
    connectionUrl.searchParams.delete('sslmode');
    connectionUrl.searchParams.delete('sslrootcert');
    connectionUrl.searchParams.delete('sslcert');
    connectionUrl.searchParams.delete('sslkey');

    this.pool = new Pool({
      connectionString: connectionUrl.toString(),
      ssl: {
        ca: config.databaseSslCa,
        rejectUnauthorized: true,
      },
    });
  }

  query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    return this.pool.query<T>(text, values);
  }

  connect(): Promise<PoolClient> {
    return this.pool.connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
