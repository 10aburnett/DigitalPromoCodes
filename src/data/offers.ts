// src/data/whops.ts
import { unstable_cache } from 'next/cache';
import { tagForWhop, TAG_HUBS } from '@/lib/cacheTags';
import { prisma } from '@/lib/prisma';
import { whereIndexable } from '@/lib/where-indexable';
import { canonicalSlugForDB } from '@/lib/slug-utils';

// Optional: tiny debug helper (no-op unless env set)
const logCache = (...args: any[]) => {
  if (process.env.DEBUG_CACHE === '1') {
    // Avoid leaking secrets; only log harmless info
    console.log('[cache]', ...args);
  }
};

// Direct fetch without whereIndexable() to match page.tsx relaxed gate
async function fetchWhopDirect(slug: string) {
  // Use lowercase decoded slug for DB lookup (DB stores literal colons, not %3a)
  const decoded = decodeURIComponent(slug);
  const dbSlug = decoded.toLowerCase();
  const whop = await prisma.whop.findFirst({
    where: { slug: dbSlug },
    include: {
      PromoCode: true,
      Review: true
    }
  });
  return whop ?? null;
}

/**
 * Cached, tagged fetch for a single whop by slug.
 * Tags: whop:<slug>
 * NOTE: Does NOT apply whereIndexable() - page.tsx applies relaxed gate allowing NOINDEX
 */
export const getWhopBySlugCached = (slug: string) =>
  unstable_cache(
    async () => {
      logCache('MISS fetchWhopDirect', { slug });
      const whop = await fetchWhopDirect(slug);

      // Preview debugging log
      if (process.env.VERCEL_ENV === 'preview') {
        console.log('[preview] whop data has usageStats?', !!(whop as any)?.usageStats, 'freshness?', !!(whop as any)?.freshnessData);
      }

      return whop;
    },
    // cache key must include slug for uniqueness - use decoded lowercase for consistency
    [`whop:${decodeURIComponent(slug).toLowerCase()}`],
    {
      revalidate: 300 // 5 minutes
    }
  )();

/**
 * Cached, tagged fetch for homepage/hubs list.
 * Tags: hubs
 * You can add pagination keys to cache different pages distinctly.
 */
export const getWhopsOptimizedCached = (page = 1, limit = 15) =>
  unstable_cache(
    async () => {
      logCache('MISS getWhopsOptimized', { page, limit });

      // Fetch whops with pagination
      const whops = await prisma.whop.findMany({
        where: whereIndexable(),
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          description: true,
          rating: true,
          displayOrder: true,
          affiliateLink: true,
          price: true,
          PromoCode: {
            select: {
              id: true,
              title: true,
              description: true,
              code: true,
              type: true,
              value: true
            }
          }
        },
        orderBy: { displayOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      });

      return whops;
    },
    [`whops:list:page=${page}:limit=${limit}`],
    {
      tags: [TAG_HUBS],
      revalidate: 300
    }
  )();

/**
 * Cached, tagged fetch for ALL whops (no quality gate).
 * Used for homepage to show total count and list.
 * Tags: hubs
 */
export const getWhopsAllCached = (page = 1, limit = 15) =>
  unstable_cache(
    async () => {
      logCache('MISS getWhopsAll', { page, limit });

      // NOTE: no whereIndexable() — show every whop in DB
      const whops = await prisma.whop.findMany({
        select: {
          id: true,
          name: true,
          slug: true,
          logo: true,
          description: true,
          rating: true,
          displayOrder: true,
          affiliateLink: true,
          price: true,
          PromoCode: {
            select: {
              id: true,
              title: true,
              description: true,
              code: true,
              type: true,
              value: true
            }
          }
        },
        orderBy: { displayOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit
      });

      return whops;
    },
    [`whops:all:page=${page}:limit=${limit}`],
    {
      tags: [TAG_HUBS],
      revalidate: 300
    }
  )();
