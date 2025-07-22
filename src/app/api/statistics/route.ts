import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Explicitly mark this route as dynamic
export const revalidate = 0; // Never cache the result

export async function GET() {
  try {
    console.log('Fetching statistics...');
    
    // Get actual total users (unique IP addresses or sessions from tracking)
    const uniqueUsersResult = await prisma.$queryRaw`
      SELECT COUNT(DISTINCT "path") as unique_users
      FROM "OfferTracking"
    `;
    const totalUsers = Number((uniqueUsersResult as any)[0]?.unique_users || 0);
    
    // Get total number of active whops (only published ones)
    const activeWhops = await prisma.whop.count({
      where: { publishedAt: { not: null } }
    });

    // Get total number of active promo codes
    const totalOffersAvailable = await prisma.promoCode.count();
    
    console.log('Basic stats:', { totalUsers, activeWhops, totalOffersAvailable });

    // Get most claimed offer (based on code copies, which represent actual promo claims)
    const mostClaimedOfferData = await prisma.offerTracking.groupBy({
      by: ['promoCodeId'],
      where: {
        actionType: 'code_copy',
        promoCodeId: {
          not: null
        }
      },
      _count: {
        promoCodeId: true
      },
      orderBy: {
        _count: {
          promoCodeId: 'desc'
        }
      },
      take: 1
    });

    let mostClaimedOffer = null;
    if (mostClaimedOfferData.length > 0) {
      const promoCodeId = mostClaimedOfferData[0].promoCodeId;
      const claimCount = mostClaimedOfferData[0]._count.promoCodeId;
      
      console.log('Most claimed promo code ID:', promoCodeId, 'with', claimCount, 'claims');
      
      if (promoCodeId) {
        const promoCode = await prisma.promoCode.findUnique({
          where: { id: promoCodeId },
          include: {
            Whop: {
              select: {
                name: true,
                slug: true,
                logo: true
              }
            }
          }
        });

        console.log('Found promo code:', promoCode?.title, 'from whop:', promoCode?.Whop?.name);

        if (promoCode && promoCode.Whop) {
          mostClaimedOffer = {
            name: promoCode.Whop.name,
            slug: promoCode.Whop.slug,
            claimCount: claimCount,
            logoUrl: promoCode.Whop.logo
          };
        }
      }
    } else {
      console.log('No code_copy tracking data found, checking for any tracking data...');
      
      // Fallback: if no code_copy data, try to get most active whop by any action type
      const fallbackData = await prisma.offerTracking.groupBy({
        by: ['whopId'],
        where: {
          whopId: {
            not: null
          }
        },
        _count: {
          whopId: true
        },
        orderBy: {
          _count: {
            whopId: 'desc'
          }
        },
        take: 1
      });
      
      if (fallbackData.length > 0) {
        const whopId = fallbackData[0].whopId;
        const actionCount = fallbackData[0]._count.whopId;
        
        if (whopId) {
          const whop = await prisma.whop.findUnique({
            where: { id: whopId },
            select: {
              name: true,
              slug: true,
              logo: true
            }
          });
          
          if (whop) {
            mostClaimedOffer = {
              name: whop.name,
              slug: whop.slug,
              claimCount: actionCount,
              logoUrl: whop.logo
            };
            console.log('Using fallback whop:', whop.name, 'with', actionCount, 'total actions');
          }
        }
      }
    }

    // Get total promo codes claimed (both button_click and offer_click actions)
    const promoCodesClaimed = await prisma.offerTracking.count({
      where: {
        actionType: {
          in: ['button_click', 'offer_click']
        }
      }
    });

    const statistics = {
      totalUsers: totalUsers, // Use actual count from database
      promoCodesClaimed: promoCodesClaimed, // Real promo codes claimed count
      totalOffersAvailable: activeWhops, // Active whops count (not promo codes)
      mostClaimedOffer
    };

    return NextResponse.json(statistics);
  } catch (error) {
    console.error('Error fetching statistics:', error);
    
    // Return minimal statistics if database query fails - all zeros for real data
    return NextResponse.json({
      totalUsers: 0,
      promoCodesClaimed: 0,
      totalOffersAvailable: 0,
      mostClaimedOffer: null
    });
  }
} 