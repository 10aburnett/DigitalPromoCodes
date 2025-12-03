import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';
import { Prisma } from '@prisma/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const startOfTodayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

export async function GET(request: NextRequest) {
  noStore(); // hard-disable Next data cache for this handler
  
  try {
    const { searchParams } = new URL(request.url);
    const promoCodeId = searchParams.get('promoCodeId');
    const whopId = searchParams.get('whopId');
    let slug = searchParams.get('slug');

    // If whopId provided, run whopId-based counts first (whopId is a string)
    if (whopId) {
      const since = startOfTodayUTC();
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

      // Return whopId-based stats (even if 0)
      return NextResponse.json({
        usage: { todayCount, totalCount, todayClicks: todayCount, lastUsed: lastUsage?.createdAt ?? null },
        overallStats: { todayClicks: todayCount }
      }, {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': 'Cookie'
        }
      });
    }

    // If promoCodeId provided (string), run promoCodeId-based counts
    if (promoCodeId) {
      const since = startOfTodayUTC();
      const whereBase = { promoCodeId: promoCodeId, actionType: 'code_copy' as const };

      const [totalCount, todayCount, lastUsage] = await Promise.all([
        prisma.offerTracking.count({ where: whereBase }),
        prisma.offerTracking.count({ where: { ...whereBase, createdAt: { gte: since } } }),
        prisma.offerTracking.findFirst({
          where: whereBase,
          orderBy: { createdAt: 'desc' },
          select: { createdAt: true }
        })
      ]);

      // If ID-based counts > 0, return immediately
      if (totalCount > 0) {
        return NextResponse.json({
          usage: { todayCount, totalCount, todayClicks: todayCount, lastUsed: lastUsage?.createdAt ?? null },
          overallStats: { todayClicks: todayCount }
        }, {
          headers: {
            'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma': 'no-cache',
            'Expires': '0',
            'Vary': 'Cookie'
          }
        });
      }
    }

    // Resolve slug if not provided but we have whopId
    if (!slug && whopId) {
      const whop = await prisma.deal.findUnique({
        where: { id: whopId },
        select: { slug: true }
      });
      slug = whop?.slug ?? null;
    }

    // Path-based fallback if we have a slug
    if (slug) {
      const since = startOfTodayUTC();
      const whereBase = {
        actionType: 'code_copy' as const,
        OR: [
          // Current paths (/offer/)
          { path: { contains: `/offer/${slug}`, mode: 'insensitive' as Prisma.QueryMode } },
          { path: { contains: `/en/offer/${slug}`, mode: 'insensitive' as Prisma.QueryMode } },
          // Legacy paths (/whop/) for historical analytics
          { path: { contains: `/whop/${slug}`, mode: 'insensitive' as Prisma.QueryMode } },
          { path: { contains: `/en/whop/${slug}`, mode: 'insensitive' as Prisma.QueryMode } },
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

      return NextResponse.json({
        usage: { todayCount, totalCount, todayClicks: todayCount, lastUsed: lastUsage?.createdAt ?? null },
        overallStats: { todayClicks: todayCount }
      }, { 
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Vary': 'Cookie'
        } 
      });
    }

    // No params/slugs resolved - return zeros
    return NextResponse.json({
      usage: { todayCount: 0, totalCount: 0, todayClicks: 0, lastUsed: null },
      overallStats: { todayClicks: 0 }
    }, { 
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } 
    });

  } catch (error) {
    console.error('[promo-stats] error', error);
    return NextResponse.json({
      usage: { todayCount: 0, totalCount: 0, todayClicks: 0, lastUsed: null },
      overallStats: { todayClicks: 0 }
    }, { 
      status: 200,
      headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } 
    });
  }
}