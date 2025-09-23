// src/lib/price.ts
// Price parsing and affinity helpers for SEO internal linking
// Converts price strings to cents for comparison (no DB changes)

/**
 * Parse price string to cents for comparison
 * Returns null if unparseable
 */
export function parsePriceToCents(price: string | null): number | null {
  if (!price || typeof price !== 'string') return null;

  // Handle common cases
  const normalized = price.toLowerCase().trim();

  // Free cases
  if (normalized === 'free' || normalized === '$0' || normalized === '0') {
    return 0;
  }

  // Remove common prefixes/suffixes and extract number
  const cleanPrice = normalized
    .replace(/^(from\s+|starting\s+at\s+|only\s+)/i, '') // Remove prefixes
    .replace(/\s+(per\s+month|\/month|monthly|\/mo|one-time|lifetime)/i, '') // Remove suffixes
    .replace(/[^\d.,]/g, ''); // Keep only digits, dots, commas

  if (!cleanPrice) return null;

  // Handle decimal parsing (assume . is decimal separator)
  const numStr = cleanPrice.replace(/,/g, ''); // Remove commas
  const num = parseFloat(numStr);

  if (isNaN(num)) return null;

  // Convert to cents (assume dollars if < 1000, otherwise already cents)
  return num < 1000 ? Math.round(num * 100) : Math.round(num);
}

/**
 * Calculate price affinity between two price values
 * Returns 0-1 score based on price range similarity
 */
export function priceAffinity(priceA: string | null, priceB: string | null): number {
  const centsA = parsePriceToCents(priceA);
  const centsB = parsePriceToCents(priceB);

  // Both free = perfect match
  if (centsA === 0 && centsB === 0) return 1;

  // One free, one paid = no affinity
  if ((centsA === 0) !== (centsB === 0)) return 0;

  // Both null/unparseable = neutral
  if (centsA === null || centsB === null) return 0.5;

  // Calculate ratio-based similarity
  const min = Math.min(centsA, centsB);
  const max = Math.max(centsA, centsB);

  if (max === 0) return 1; // Both are 0

  const ratio = min / max;

  // Price ranges with higher affinity:
  // - Same price: ratio = 1, affinity = 1
  // - 2x difference: ratio = 0.5, affinity = 0.5
  // - 10x difference: ratio = 0.1, affinity = 0.1
  return ratio;
}