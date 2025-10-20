// src/lib/image-url.ts
// Safe, server-friendly logo URL resolver (NO event handlers needed on server)
export function resolveLogoUrl(input?: string | null): string {
  if (!input) return '/logo.png'; // local safe fallback

  // Absolute URL? Keep it.
  if (/^https?:\/\//i.test(input)) return input;

  // Relative from your CDN/site (e.g. "/uploads/abc.png@avif")
  // Prefix with your origin so it's always absolute.
  const origin = 'https://whpcodes.com';
  const path = input.startsWith('/') ? input : `/${input}`;
  return `${origin}${path}`;
}
