// src/lib/paths.ts
// Centralized path building helpers to prevent double-encoding

import { safeDecode } from './slug-utils';

/**
 * Build an offer detail page href with proper encoding.
 * Handles colons correctly: converts to %3a exactly once, no double-encoding.
 */
export function offerHref(slug: string): string {
  // Decode first (in case slug is already encoded)
  const decoded = safeDecode(slug);
  // Lowercase and encode (this will turn : into %3A)
  const encoded = encodeURIComponent(decoded.toLowerCase());
  // Force lowercase hex (%3A -> %3a for consistency)
  const canonical = encoded.replace(/%[0-9A-F]{2}/g, m => m.toLowerCase());
  return `/offer/${canonical}`;
}

/**
 * Build an absolute offer URL
 */
export function offerAbsoluteHref(slug: string, origin: string): string {
  return `${origin}${offerHref(slug)}`;
}

// Legacy aliases for backwards compatibility during migration
export const whopHref = offerHref;
export const whopAbsoluteHref = offerAbsoluteHref;
