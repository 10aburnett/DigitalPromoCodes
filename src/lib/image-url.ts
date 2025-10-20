// src/lib/image-url.ts
// Safe, server-friendly logo URL resolver (NO event handlers needed on server)
export function resolveLogoUrl(input?: string | null): string {
  if (!input) return '/logo.png'; // local safe fallback

  // Absolute URL? Return as-is (for CDN images like Whop's)
  if (/^https?:\/\//i.test(input)) return input;

  // Environment-aware base URL
  // In dev: use relative paths (served from /public)
  // In prod: use absolute URLs to ensure correct resolution
  const BASE_URL =
    process.env.NODE_ENV === 'production'
      ? 'https://whpcodes.com'
      : '';

  // Handle common relative patterns
  // Remove any accidental leading slashes from paths like "data/logos/foo.png"
  let cleanPath = input.replace(/^\/+/, ''); // Remove all leading slashes

  // Ensure we're working with a properly formatted path
  // If it starts with known upload paths, normalize it
  if (cleanPath.startsWith('uploads/') || cleanPath.startsWith('data/')) {
    return BASE_URL ? `${BASE_URL}/${cleanPath}` : `/${cleanPath}`;
  }

  // For all other relative paths, ensure proper formatting
  return BASE_URL ? `${BASE_URL}/${cleanPath}` : `/${cleanPath}`;
}
