// src/lib/whopImage.ts
// Helper utilities for handling Whop's ImgProxy CDN URLs

/**
 * Coerce Whop's ImgProxy-style URLs to the actual asset URL
 *
 * Whop sometimes returns URLs like:
 * https://img-v2-prod.whop.com/unsafe/rs:fit:96:0/plain/https%3A%2F%2Fassets.whop.com%2Fuploads%2F...png@avif
 *
 * This extracts the real asset URL (assets.whop.com/uploads/...) from the ImgProxy wrapper.
 */
export function coerceWhopLogoUrl(src?: string | null): string | null {
  if (!src) return null;

  try {
    // Check if it's an ImgProxy-style URL with "/plain/" segment
    const idx = src.indexOf('/plain/');
    if (idx !== -1) {
      const rest = src.slice(idx + '/plain/'.length);
      // Strip @avif/@webp suffix if present
      const beforeSuffix = rest.split('@')[0];
      // Decode the URL-encoded actual asset URL
      const decoded = decodeURIComponent(beforeSuffix);
      return decoded; // typically https://assets.whop.com/uploads/...
    }
    return src;
  } catch {
    return src;
  }
}

/**
 * Check if a URL is from an allowed Whop CDN host
 */
export function isAllowedWhopHost(u?: string | null): boolean {
  if (!u) return false;

  try {
    const { hostname } = new URL(u);
    const allowedHosts = [
      'img-v2-prod.whop.com',
      'img-v2-stage.whop.com',
      'img.whop.com',
      'assets.whop.com',
      'cdn.whop.com',
      'static.whop.xyz'
    ];
    return allowedHosts.includes(hostname);
  } catch {
    return false;
  }
}

/**
 * Safely resolve a Whop logo URL for rendering
 * Returns the coerced URL if it's from an allowed host, otherwise returns a fallback
 */
export function resolveWhopLogoUrl(src?: string | null, fallback: string = '/logo.png'): string {
  const coerced = coerceWhopLogoUrl(src);

  if (!coerced) return fallback;

  // If it's a relative path, return as-is
  if (!coerced.startsWith('http')) return coerced;

  // If it's an allowed Whop host, return the coerced URL
  if (isAllowedWhopHost(coerced)) return coerced;

  // Otherwise, return fallback
  return fallback;
}
