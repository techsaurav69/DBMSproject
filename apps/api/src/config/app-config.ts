import type { StringValue } from 'ms';

export const APP_CONFIG = Symbol('APP_CONFIG');

export type AppConfig = {
  databaseUrl: string;
  isProduction: boolean;
  jwtExpiresIn: StringValue;
  jwtSecret: string;
  port: number;
  webOrigins: string[];
};

function requiredPositivePort(value: string | undefined): number {
  const parsed = Number(value ?? '3000');
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > 65535) {
    throw new Error('PORT must be an integer between 1 and 65535.');
  }
  return parsed;
}

function jwtDuration(value: string | undefined): StringValue {
  const duration = value ?? '8h';
  const durationPattern = /^\d+\s?(?:ms|msecs?|milliseconds?|s|secs?|seconds?|m|mins?|minutes?|h|hrs?|hours?|d|days?|w|weeks?|y|yrs?|years?)$/i;

  if (!durationPattern.test(duration)) {
    throw new Error('JWT_EXPIRES_IN must be a duration such as 15m, 8h, or 7d.');
  }

  return duration as StringValue;
}

export function loadAppConfig(environment: NodeJS.ProcessEnv = process.env): AppConfig {
  const isProduction = environment.NODE_ENV === 'production';
  const jwtSecret = environment.JWT_SECRET ?? (isProduction ? undefined : 'crisisgrid-local-development-secret-change-before-production');
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters long.');
  }

  const databaseUrl = environment.DATABASE_URL
    ?? `postgresql://${encodeURIComponent(environment.POSTGRES_USER ?? 'crisisgrid_app')}:${encodeURIComponent(environment.POSTGRES_PASSWORD ?? 'change-this-local-password')}@localhost:${environment.POSTGRES_PORT ?? '5432'}/${encodeURIComponent(environment.POSTGRES_DB ?? 'crisisgrid')}`;
  const webOrigins = (environment.WEB_ORIGIN ?? 'http://localhost:5173,http://localhost:5174')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  if (!webOrigins.every((origin) => URL.canParse(origin))) {
    throw new Error('WEB_ORIGIN must contain valid comma-separated URLs.');
  }

  return {
    databaseUrl,
    isProduction,
    jwtExpiresIn: jwtDuration(environment.JWT_EXPIRES_IN),
    jwtSecret,
    port: requiredPositivePort(environment.PORT),
    webOrigins,
  };
}
