// src/lib/paths.ts
// Centralized path building helpers to prevent double-encoding

import { canonicalSlugForPath } from './slug-utils';

/**
 * Build a whop detail page href with proper encoding.
 * Prevents double-encoding by using canonicalSlugForPath and encodeURIComponent once.
 */
export function whopHref(slug: string): string {
  const canonical = canonicalSlugForPath(slug);
  return `/whop/${encodeURIComponent(canonical)}`;
}

/**
 * Build an absolute whop URL
 */
export function whopAbsoluteHref(slug: string, origin: string = 'https://whpcodes.com'): string {
  return `${origin}${whopHref(slug)}`;
}
