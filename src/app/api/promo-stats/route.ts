import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const STATS_DEBUG = process.env.STATS_DEBUG === '1';

export async function GET(request: NextRequest) {
  const SOFT = process.env.SOFT_FAIL_STATS === '1' || process.env.NODE_ENV === 'production';
  
  try {
    const { searchParams } = new URL(request.url);
    const promoCodeId = searchParams.get('promoCodeId');
    const whopId = searchParams.get('whopId');
    const slug = searchParams.get('slug');

    if (!promoCodeId && !whopId && !slug) {
      return NextResponse.json(
        {
          usage: { todayCount: 0, totalCount: 0, todayClicks: 0, lastUsed: null },
          overallStats: { todayClicks: 0 }
        },
        { status: 200, headers: { 'cache-control': 'no-store' } }
      );
    }

    // Get the current date for today's stats
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 24 * 60 * 60 * 1000);

    let stats = {};

    if (promoCodeId) {
      // Get stats for specific promo code
      const promoCode = await prisma.promoCode.findUnique({
        where: { id: promoCodeId },
        include: { whop: true }
      });

      if (!promoCode) {
        return NextResponse.json(
          {
            usage: { todayCount: 0, totalCount: 0, todayClicks: 0, lastUsed: null },
            overallStats: { todayClicks: 0 }
          },
          { status: 200, headers: { 'cache-control': 'no-store' } }
        );
      }

      // Get usage count for today
      const todayUsageCount = await prisma.offerTracking.count({
        where: {
          promoCodeId: promoCodeId,
          actionType: 'code_copy',
          createdAt: {
            gte: startOfToday,
            lt: endOfToday
          }
        }
      });

      // Get total usage count
      const totalUsageCount = await prisma.offerTracking.count({
        where: {
          promoCodeId: promoCodeId,
          actionType: 'code_copy'
        }
      });

      // Get last used timestamp
      const lastUsage = await prisma.offerTracking.findFirst({
        where: {
          promoCodeId: promoCodeId,
          actionType: 'code_copy'
        },
        orderBy: {
          createdAt: 'desc'
        }
      });

      // Get click count for today
      const todayClickCount = await prisma.offerTracking.count({
        where: {
          whopId: promoCode.whopId,
          actionType: {
            in: ['offer_click', 'button_click']
          },
          createdAt: {
            gte: startOfToday,
            lt: endOfToday
          }
        }
      });

      stats = {
        promoCode: {
          id: promoCode.id,
          title: promoCode.title,
          code: promoCode.code,
          type: promoCode.type,
          value: promoCode.value,
          createdAt: promoCode.createdAt,
          whopName: promoCode.whop.name
        },
        usage: {
          todayCount: todayUsageCount,
          totalCount: totalUsageCount,
          todayClicks: todayClickCount,
          lastUsed: lastUsage?.createdAt || null,
          verifiedDate: promoCode.createdAt // Using creation date as verification date
        }
      };
    } else if (whopId) {
      // Get stats for all promo codes of a whop
      const whop = await prisma.whop.findUnique({
        where: { id: whopId },
        include: {
          PromoCode: true
        }
      });

      if (!whop) {
        return NextResponse.json(
          {
            usage: { todayCount: 0, totalCount: 0, todayClicks: 0, lastUsed: null },
            overallStats: { todayClicks: 0 }
          },
          { status: 200, headers: { 'cache-control': 'no-store' } }
        );
      }

      const promoStats = await Promise.all(
        whop.PromoCode.map(async (promo) => {
          // Get usage count for today
          const todayUsageCount = await prisma.offerTracking.count({
            where: {
              promoCodeId: promo.id,
              actionType: 'code_copy',
              createdAt: {
                gte: startOfToday,
                lt: endOfToday
              }
            }
          });

          // Get total usage count
          const totalUsageCount = await prisma.offerTracking.count({
            where: {
              promoCodeId: promo.id,
              actionType: 'code_copy'
            }
          });

          // Get last used timestamp
          const lastUsage = await prisma.offerTracking.findFirst({
            where: {
              promoCodeId: promo.id,
              actionType: 'code_copy'
            },
            orderBy: {
              createdAt: 'desc'
            }
          });

          return {
            promoCode: {
              id: promo.id,
              title: promo.title,
              code: promo.code,
              type: promo.type,
              value: promo.value,
              createdAt: promo.createdAt
            },
            usage: {
              todayCount: todayUsageCount,
              totalCount: totalUsageCount,
              lastUsed: lastUsage?.createdAt || null,
              verifiedDate: promo.createdAt
            }
          };
        })
      );

      // Get overall whop clicks for today
      const todayClickCount = await prisma.offerTracking.count({
        where: {
          whopId: whopId,
          actionType: {
            in: ['offer_click', 'button_click']
          },
          createdAt: {
            gte: startOfToday,
            lt: endOfToday
          }
        }
      });

      stats = {
        whop: {
          id: whop.id,
          name: whop.name,
          slug: whop.slug
        },
        promoStats,
        overallStats: {
          todayClicks: todayClickCount
        }
      };
    }

    // Path-based fallback when ID-based counts are 0
    if (stats.usage?.totalCount === 0 || stats.overallStats?.todayClicks === 0) {
      let fallbackSlug = slug;
      
      // Resolve slug if not provided directly
      if (!fallbackSlug) {
        if (promoCodeId) {
          const promo = await prisma.promoCode.findUnique({
            where: { id: promoCodeId },
            include: { whop: { select: { slug: true } } }
          });
          fallbackSlug = promo?.whop?.slug;
        } else if (whopId) {
          const whop = await prisma.whop.findUnique({
            where: { id: whopId },
            select: { slug: true }
          });
          fallbackSlug = whop?.slug;
        }
      }
      
      if (fallbackSlug) {
        const startOfUtcDay = new Date(new Date().toISOString().slice(0,10));
        
        const [total, today, lastUsage] = await Promise.all([
          prisma.offerTracking.count({
            where: { 
              actionType: 'code_copy', 
              path: { contains: `/whop/${fallbackSlug}`, mode: 'insensitive' } 
            }
          }),
          prisma.offerTracking.count({
            where: {
              actionType: 'code_copy',
              path: { contains: `/whop/${fallbackSlug}`, mode: 'insensitive' },
              createdAt: { gte: startOfUtcDay }
            }
          }),
          prisma.offerTracking.findFirst({
            where: { 
              actionType: 'code_copy', 
              path: { contains: `/whop/${fallbackSlug}`, mode: 'insensitive' } 
            },
            orderBy: { createdAt: 'desc' },
            select: { createdAt: true }
          })
        ]);
        
        if (total > 0) {
          // Update stats with path-based counts
          if (stats.usage) {
            stats.usage.totalCount = total;
            stats.usage.todayCount = today;
            stats.usage.lastUsed = lastUsage?.createdAt || stats.usage.lastUsed;
          }
          if (stats.overallStats) {
            stats.overallStats.todayClicks = today;
          }
        }
      }
    }

    if (STATS_DEBUG) {
      stats.debug = {
        source: 'promo-stats',
        dbHost: new URL(process.env.STATS_DATABASE_URL || process.env.DATABASE_URL || '').host,
        params: { promoCodeId, whopId, slug }
      };
    }
    
    return NextResponse.json(stats, { headers: { 'cache-control': 'no-store' } });
  } catch (error) {
    console.error('[promo-stats]', error);
    return NextResponse.json(
      {
        usage: { todayCount: 0, totalCount: 0, todayClicks: 0, lastUsed: null },
        overallStats: { todayClicks: 0 }
      },
      { status: 200, headers: { 'cache-control': 'no-store' } }
    );
  }
} 