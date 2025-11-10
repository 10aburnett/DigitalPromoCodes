// src/lib/image-url.ts
// Safe, server-friendly logo URL resolver (NO event handlers needed on server)

import { coerceWhopLogoUrl } from './whopImage';

// Asset origin for production - matches next.config.js ASSET_ORIGIN
const ASSET_ORIGIN = process.env.NODE_ENV === 'production'
  ? 'https://whpcodes.com'
  : '';

export function resolveLogoUrl(input?: string | null): string {
  // Return fallback for empty/null input
  if (!input || input.trim() === '') {
    return '/logo.png';
  }

  // Remove leading/trailing whitespace
  const trimmedInput = input.trim();

  // If it's already a full external URL (http:// or https://), coerce ImgProxy URLs and return
  if (/^https?:\/\//i.test(trimmedInput)) {
    // Handle Whop's ImgProxy CDN URLs by extracting the real asset URL
    const coerced = coerceWhopLogoUrl(trimmedInput);
    return coerced || trimmedInput;
  }

  // Remove ALL leading slashes to normalize the path
  const cleanPath = trimmedInput.replace(/^\/+/, '');

  // Handle empty result after cleaning
  if (!cleanPath) {
    return '/logo.png';
  }

  // If path starts with known directories (uploads/, data/, logos/), build absolute URL
  if (cleanPath.startsWith('uploads/') ||
      cleanPath.startsWith('data/') ||
      cleanPath.startsWith('logos/')) {
    return ASSET_ORIGIN ? `${ASSET_ORIGIN}/${cleanPath}` : `/${cleanPath}`;
  }

  // For paths that don't start with known directories, assume they're in data/logos/
  // This handles cases like "foo.png" -> "https://whpcodes.com/data/logos/foo.png"
  return ASSET_ORIGIN
    ? `${ASSET_ORIGIN}/data/logos/${cleanPath}`
    : `/data/logos/${cleanPath}`;
}
