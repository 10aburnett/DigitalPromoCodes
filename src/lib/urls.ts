// src/lib/urls.ts
import 'server-only';
import { isLocale, isLocaleEnabled, type Locale } from './schema-locale';

const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://whpcodes.com';

export function absoluteUrl(path = '/') {
  if (!path.startsWith('/')) return path; // already absolute
  return `${ORIGIN}${path}`;
}

// locale-aware canonical for offer pages (safe with feature flag)
export function offerAbsoluteUrl(slug: string, locale?: string | null) {
  const base = `/offer/${slug}`;

  // Only apply locale logic if feature is enabled and locale is valid
  if (isLocaleEnabled() && isLocale(locale) && locale !== 'en') {
    return absoluteUrl(`/${locale}${base}`); // e.g., /de/offer/slug
  }

  // Default behavior (same as before when flag is off)
  return absoluteUrl(base); // e.g., /offer/slug
}

// Legacy alias for backwards compatibility during migration
export const whopAbsoluteUrl = offerAbsoluteUrl;

/**
 * Normalize URL for comparison - removes query params, hash, and trailing slash
 * Used for matching incoming CSV URLs against database URLs
 * Tolerates missing scheme, lowercases host, removes default ports
 */
export function normalizeUrl(raw: string): string {
  try {
    let s = (raw ?? "").trim();
    // tolerate inputs like "whop.com/creator/product"
    if (!/^https?:\/\//i.test(s)) s = `https://${s}`;
    const u = new URL(s);
    // normalize host, drop default ports
    u.hostname = u.hostname.toLowerCase();
    if (u.port === "80" || u.port === "443") u.port = "";
    // drop query/hash
    u.search = "";
    u.hash = "";
    let out = u.toString();
    if (out.endsWith("/")) out = out.slice(0, -1);
    return out;
  } catch {
    return (raw ?? "").trim();
  }
}