/**
 * Server-only site origin configuration
 * Provides the canonical base URL for SEO metadata and absolute URLs
 */

const fromEnv = process.env.SITE_ORIGIN?.replace(/\/+$/, '');

export function siteOrigin(): string {
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SITE_ORIGIN is required in production (e.g., https://whpcodes.com)');
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
}
