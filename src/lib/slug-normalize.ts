// Normalizes slugs to handle URL encoding and Unicode dash variants
export function normalizeSlug(input: string) {
  if (!input) return '';

  // First decode any URL encoding to get the raw slug
  let decoded = input;
  try {
    decoded = decodeURIComponent(input.trim());
  } catch {
    // If decoding fails, use the original
    decoded = input.trim();
  }

  // Replace any Unicode dash variants with ASCII hyphen
  const DASHES = /[\u2010-\u2015\u2212\uFE58\uFE63\uFF0D]/g;
  return decoded
    .toLowerCase()
    .replace(DASHES, '-')     // en/em/minus etc → '-'
    .replace(/[^a-z0-9:-]/g, '-')  // allow colons for slugs like 1:1, strip other weird chars
    .replace(/-+/g, '-')      // collapse multiple dashes
    .replace(/^-|-$/g, '');   // trim leading/trailing dashes
}

// Encode slug for API paths (single encoding)
export function encodeSlugForAPI(canonicalSlug: string) {
  return encodeURIComponent(canonicalSlug);
}