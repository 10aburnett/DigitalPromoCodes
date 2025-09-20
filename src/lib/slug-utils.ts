/**
 * Slug normalization utilities for whop URLs
 * Handles case normalization and colon encoding for consistent URLs
 */

/**
 * Safely decode a URL component without throwing
 */
export function safeDecode(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

/**
 * Canonicalize slug for database lookups
 * Accept %3A, %3a, or literal colon — store/compare as lowercase %3a
 */
export function canonicalSlugForDB(raw: string): string {
  const decoded = safeDecode(raw);
  return decoded.toLowerCase().replace(/:/g, '%3a');
}

/**
 * Canonicalize slug for URL paths
 * What we want in the URL/canonical tag
 */
export function canonicalSlugForPath(raw: string): string {
  const decoded = safeDecode(raw);
  return decoded.toLowerCase().replace(/:/g, '%3a');
}

// Legacy exports for backward compatibility
export const canonicalizeWhopSlugForPath = canonicalSlugForPath;
export const canonicalizeWhopSlugForDB = canonicalSlugForDB;

/**
 * Check if a slug needs canonical normalization
 */
export function slugNeedsNormalization(slug: string): boolean {
  const canonical = canonicalSlugForPath(slug);
  return slug !== canonical;
}

/**
 * Normalize slug for consistent use (GPT recommended functions)
 * Returns decoded and lowercased slug for DB lookups
 */
export function normalizeSlug(input: string): string {
  return decodeURIComponent(input).toLowerCase();
}

/**
 * Get encoded slug for file paths under /data/pages
 * Ensures consistent encoding for verification JSON files
 * Forces lowercase percent-hex to match filesystem files
 */
export function fileSlug(input: string): string {
  // 1) encode URI component
  const encoded = encodeURIComponent(normalizeSlug(input));
  // 2) force lowercase %XX hex (handles %3A vs %3a)
  return encoded.replace(/%[0-9A-F]{2}/g, m => m.toLowerCase());
}