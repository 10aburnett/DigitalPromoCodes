// src/data/whops.ts
import { unstable_cache } from 'next/cache';
import { tagForWhop, TAG_HUBS } from '@/lib/cacheTags';
import { getWhopBySlug } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import { whereIndexable } from '@/lib/where-indexable';

// Optional: tiny debug helper (no-op unless env set)
const logCache = (...args: any[]) => {
  if (process.env.DEBUG_CACHE === '1') {
    // Avoid leaking secrets; only log harmless info
    console.log('[cache]', ...args);
  }
};

/**
 * Cached, tagged fetch for a single whop by slug.
 * Tags: whop:<slug>
 */
export const getWhopBySlugCached = (slug: string, locale: string = 'en') =>
  unstable_cache(
    async () => {
      logCache('MISS getWhopBySlug', { slug, locale });
      const whop = await getWhopBySlug(slug, locale);
      return whop;
    },
    // cache key: stable and unique to this query
    [`whop:detail:${slug}:${locale}`],
    {
      tags: [tagForWhop(slug)],
      revalidate: 300 // 5 minutes in production, use 5 for quick tests
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
