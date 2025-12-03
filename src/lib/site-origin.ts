/**
 * Server-only site origin configuration
 * Provides the canonical base URL for SEO metadata and absolute URLs
 */

import { SITE_URL } from './brand';

const fromEnv = process.env.SITE_ORIGIN?.replace(/\/+$/, '');

export function siteOrigin(): string {
  if (fromEnv) return fromEnv;

  if (process.env.NODE_ENV === 'production') {
    // Fall back to brand constant in production if env not set
    return SITE_URL;
  }

  return `http://localhost:${process.env.PORT ?? 3000}`;
}
