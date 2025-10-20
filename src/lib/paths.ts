// src/lib/paths.ts
// Centralized path building helpers to prevent double-encoding

import { safeDecode } from './slug-utils';

/**
 * Build a whop detail page href with proper encoding.
 * Handles colons correctly: converts to %3a exactly once, no double-encoding.
 */
export function whopHref(slug: string): string {
  // Decode first (in case slug is already encoded)
  const decoded = safeDecode(slug);
  // Lowercase and encode (this will turn : into %3A)
  const encoded = encodeURIComponent(decoded.toLowerCase());
  // Force lowercase hex (%3A -> %3a for consistency)
  const canonical = encoded.replace(/%[0-9A-F]{2}/g, m => m.toLowerCase());
  return `/whop/${canonical}`;
}

/**
 * Build an absolute whop URL
 */
export function whopAbsoluteHref(slug: string, origin: string = 'https://whpcodes.com'): string {
  return `${origin}${whopHref(slug)}`;
}
