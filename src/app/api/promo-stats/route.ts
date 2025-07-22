import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const promoCodeId = searchParams.get('promoCodeId');
    const whopId = searchParams.get('whopId');

    if (!promoCodeId && !whopId) {
      return NextResponse.json(
        { error: "Missing promoCodeId or whopId parameter" },
        { status: 400 }
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
        include: { Whop: true }
      });

      if (!promoCode) {
        return NextResponse.json({ error: "Promo code not found" }, { status: 404 });
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
          whopName: promoCode.Whop.name
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
        return NextResponse.json({ error: "Whop not found" }, { status: 404 });
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

    return NextResponse.json(stats);
  } catch (error) {
    console.error("Error fetching promo stats:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json(
      { 
        error: "Failed to fetch promo statistics",
        details: error instanceof Error ? error.message : "Unknown error"
      },
      { status: 500 }
    );
  }
} 