// src/data/promo-stats.ts
import 'server-only';
import { prisma } from '@/lib/prisma';
import { cache } from 'react';

// Shape matching PromoStatsDisplay component's initialStats prop
export type PromoUsageStats = {
  todayCount: number;
  totalCount: number;
  lastUsed: string | null;
  verifiedDate: string;
};

const startOfTodayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

/**
 * Server-side helper to fetch promo usage statistics for a Whop by slug.
 * This mirrors the logic in /api/promo-stats but runs during SSR for SEO.
 * Cached with React cache() for deduplication within a single request.
 */
export const getPromoStatsForSlug = cache(async (slug: string): Promise<PromoUsageStats> => {
  try {
    // First, try to get the whop to find its ID
    const whop = await prisma.whop.findUnique({
      where: { slug: slug.toLowerCase() },
      select: { id: true }
    });

    const whopId = whop?.id;
    const since = startOfTodayUTC();

    // Try whopId-based counting first (most accurate)
    if (whopId) {
      const whereBase = { whopId: whopId, actionType: 'code_copy' as const };

      const [totalCount, todayCount, lastUsage] = await Promise.all([
        prisma.offerTracking.count({ where: whereBase }),
        prisma.offerTracking.count({ where: { ...whereBase, createdAt: { gte: since } } }),
        prisma.offerTracking.findFirst({
          where: whereBase,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        })
      ]);

      return {
        todayCount,
        totalCount,
        lastUsed: lastUsage?.createdAt?.toISOString() ?? null,
        verifiedDate: new Date().toISOString()
      };
    }

    // Fallback to path-based matching (less accurate but works for older data)
    // Note: Includes both old /whop/ and new /offer/ paths for backwards compatibility
    const whereBase = {
      actionType: 'code_copy' as const,
      OR: [
        { path: { contains: `/offer/${slug}`, mode: 'insensitive' as const } },
        { path: { contains: `/en/offer/${slug}`, mode: 'insensitive' as const } },
        // Legacy paths for historical data
        { path: { contains: `/whop/${slug}`, mode: 'insensitive' as const } },
        { path: { contains: `/en/whop/${slug}`, mode: 'insensitive' as const } }
      ]
    };

    const [totalCount, todayCount, lastUsage] = await Promise.all([
      prisma.offerTracking.count({ where: whereBase }),
      prisma.offerTracking.count({ where: { ...whereBase, createdAt: { gte: since } } }),
      prisma.offerTracking.findFirst({
        where: whereBase,
        orderBy: { createdAt: 'desc' },
        select: { createdAt: true }
      })
    ]);

    return {
      todayCount,
      totalCount,
      lastUsed: lastUsage?.createdAt?.toISOString() ?? null,
      verifiedDate: new Date().toISOString()
    };

  } catch (error) {
    console.error('[getPromoStatsForSlug] error:', error);
    // Return zeros on error so page still renders
    return {
      todayCount: 0,
      totalCount: 0,
      lastUsed: null,
      verifiedDate: new Date().toISOString()
    };
  }
});
