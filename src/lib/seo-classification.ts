// server-only - SEO classification based on generated indexes
import 'server-only';
import { RETIRED_PATHS, NOINDEX_PATHS } from '@/app/_generated/seo-indexes';

/**
 * Classify page indexability based on SEO index artifact
 *
 * Classification:
 * - Indexable: index,follow + emit JSON-LD (public pages for Google)
 * - NoIndex: noindex,follow + suppress JSON-LD (thin/duplicate pages, temporarily excluded)
 * - Private: noindex,nofollow + suppress JSON-LD (admin/drafts/404)
 */
export type PageClassification = 'indexable' | 'noindex' | 'private';

/**
 * Determine if a whop slug/path should be indexed
 * Uses the generated SEO indexes as single source of truth
 */
export function getPageClassification(slug: string): PageClassification {
  const whopPath = `/whop/${slug}`;

  // Retired pages are effectively private (noindex, nofollow)
  if (RETIRED_PATHS.has(whopPath)) {
    return 'private';
  }

  // Explicitly marked noindex pages (thin/duplicates) - noindex, follow
  if (NOINDEX_PATHS.has(whopPath)) {
    return 'noindex';
  }

  // Default: indexable public pages
  return 'indexable';
}

/**
 * Check if page should emit JSON-LD schema
 * Only indexable pages get structured data
 */
export function shouldEmitJsonLd(classification: PageClassification): boolean {
  return classification === 'indexable';
}

/**
 * Get robots metadata for a page classification
 */
export function getRobotsForClassification(classification: PageClassification) {
  switch (classification) {
    case 'indexable':
      return { index: true, follow: true };
    case 'noindex':
      return { index: false, follow: true }; // noindex,follow for thin/dupes
    case 'private':
      return { index: false, follow: false }; // noindex,nofollow for admin/private
  }
}

/**
 * Check if page should be included in hreflang
 * Only indexable pages get hreflang entries
 */
export function shouldIncludeInHreflang(classification: PageClassification): boolean {
  return classification === 'indexable';
}