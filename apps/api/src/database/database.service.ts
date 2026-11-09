import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Pool, type PoolClient, type QueryResultRow } from 'pg';
import { APP_CONFIG, type AppConfig } from '../config/app-config';

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly systemTrustPool?: Pool;

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
    // If the provider's uploaded CA bundle is malformed, retry through
    // Node's verified system trust store. Certificate verification remains on.
    this.systemTrustPool = new Pool({
      connectionString: connectionUrl.toString(),
      ssl: { rejectUnauthorized: true },
    });
  }

  async query<T extends QueryResultRow>(text: string, values: unknown[] = []) {
    try {
      return await this.pool.query<T>(text, values);
    } catch (error) {
      if (!this.systemTrustPool || !this.isCertificateError(error)) throw error;
      return this.systemTrustPool.query<T>(text, values);
    }
  }

  async connect(): Promise<PoolClient> {
    try {
      return await this.pool.connect();
    } catch (error) {
      if (!this.systemTrustPool || !this.isCertificateError(error)) throw error;
      return this.systemTrustPool.connect();
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
    await this.systemTrustPool?.end();
  }

  private isCertificateError(error: unknown): boolean {
    const code = typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';
    return ['CERT_HAS_EXPIRED', 'DEPTH_ZERO_SELF_SIGNED_CERT', 'SELF_SIGNED_CERT_IN_CHAIN', 'UNABLE_TO_GET_ISSUER_CERT_LOCALLY', 'UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code);
  }
}
