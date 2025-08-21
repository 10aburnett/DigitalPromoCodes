import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { unstable_noStore as noStore } from 'next/cache';

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

    // If promoCodeId or whopId provided, run ID-based counts first
    if (promoCodeId || whopId) {
      const id = Number(promoCodeId || whopId);
      if (Number.isFinite(id)) {
        const since = startOfTodayUTC();
        const whereBase = promoCodeId 
          ? { promoCodeId: id, actionType: 'code_copy' as const }
          : { whopId: id, actionType: 'code_copy' as const };

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
    }

    // Resolve slug if not provided but we have whopId
    if (!slug && whopId) {
      const whop = await prisma.whop.findUnique({
        where: { id: Number(whopId) },
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
          { path: { contains: `/whop/${slug}`, mode: 'insensitive' } },
          { path: { contains: `/en/whop/${slug}`, mode: 'insensitive' } },
          { path: { contains: `https://whpcodes.com/whop/${slug}`, mode: 'insensitive' } },
          { path: { contains: 'http://localhost', mode: 'insensitive' } }
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