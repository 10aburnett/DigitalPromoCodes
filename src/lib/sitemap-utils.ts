// src/lib/sitemap-utils.ts
import { unstable_cache } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { whereIndexable } from '@/lib/where-indexable';
import { siteOrigin } from '@/lib/site-origin';

/**
 * Sitemap generation utilities (Phase F2)
 *
 * Generates sitemap XML for whops within a specified letter range,
 * applying quality gates to ensure only indexable content is included.
 */

export interface SitemapEntry {
  url: string;
  lastmod: string;
  changefreq?: 'daily' | 'weekly' | 'monthly' | 'yearly';
  priority?: number;
}

/**
 * Safely convert Date or string to ISO string
 * (handles Date serialization from unstable_cache)
 */
const toIso = (v: unknown): string =>
  v instanceof Date ? v.toISOString() : String(v ?? '');

/**
 * Generate sitemap entries for whops within a letter range
 * @param rangeStart - Starting letter (e.g., 'a')
 * @param rangeEnd - Ending letter (e.g., 'f')
 * @returns Array of sitemap entries
 */
export async function generateWhopSitemap(
  rangeStart: string,
  rangeEnd: string
): Promise<SitemapEntry[]> {
  return unstable_cache(
    async () => {
      const baseUrl = siteOrigin();

      // Fetch whops within the letter range with quality gates
      const whops = await prisma.whop.findMany({
        where: {
          AND: [
            whereIndexable(), // Apply existing quality gates (INDEX/INDEXED, not retired/GONE)
            {
              slug: {
                gte: rangeStart, // Greater than or equal to start letter
                lte: rangeEnd + '\uffff', // Less than or equal to end letter + high unicode
              },
            },
          ],
        },
        select: {
          slug: true,
          updatedAt: true,
        },
        orderBy: {
          slug: 'asc',
        },
      });

      console.log(`[SITEMAP] Generated ${whops.length} entries for range ${rangeStart}-${rangeEnd}`);

      return whops.map((whop) => ({
        url: `${baseUrl}/offer/${whop.slug}`,
        lastmod: toIso(whop.updatedAt),
        changefreq: 'weekly' as const,
        priority: 0.8,
      }));
    },
    [`sitemap:whops:${rangeStart}-${rangeEnd}`],
    {
      tags: ['sitemaps', `sitemap:${rangeStart}-${rangeEnd}`],
      revalidate: 3600, // 1 hour
    }
  )();
}

/**
 * Convert sitemap entries to XML format
 * @param entries - Array of sitemap entries
 * @returns XML string
 */
export function entriesToXML(entries: SitemapEntry[]): string {
  const urlEntries = entries
    .map(
      (entry) => `  <url>
    <loc>${escapeXml(entry.url)}</loc>
    <lastmod>${entry.lastmod}</lastmod>
    ${entry.changefreq ? `<changefreq>${entry.changefreq}</changefreq>` : ''}
    ${entry.priority !== undefined ? `<priority>${entry.priority}</priority>` : ''}
  </url>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`;
}

/**
 * Escape XML special characters
 */
function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
