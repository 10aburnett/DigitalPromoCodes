// src/lib/urls.ts
const ORIGIN = process.env.NEXT_PUBLIC_SITE_URL || 'https://whpcodes.com';

export function absoluteUrl(path = '/') {
  if (!path.startsWith('/')) return path; // already absolute
  return `${ORIGIN}${path}`;
}