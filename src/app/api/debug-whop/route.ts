import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const slug = searchParams.get('slug') || 'ayecon-academy-lifetime-membership';
    
    console.log(`Debug: Looking for whop with slug: ${slug}`);
    
    // Replicate the exact logic from getWhopBySlug
    const whop = await prisma.deal.findFirst({
      where: { 
        slug: slug,
        publishedAt: { not: null }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        PromoCode: {
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!whop) {
      return NextResponse.json({ error: "Whop not found", slug });
    }

    console.log(`Debug: Found whop ${whop.id}, getting community codes...`);

    // Get community-submitted promo codes 
    const communityPromoCodes = await prisma.promoCode.findMany({
      where: {
        whopId: whop.id,
        id: { startsWith: 'community_' }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`Debug: Found ${communityPromoCodes.length} community codes`);

    // Combine promo codes
    const allPromoCodes = [
      ...communityPromoCodes,
      ...whop.PromoCode.filter(code => !code.id.startsWith('community_'))
    ];

    console.log(`Debug: Total combined codes: ${allPromoCodes.length}`);

    return NextResponse.json({
      whop: {
        id: whop.id,
        name: whop.name,
        slug: whop.slug
      },
      originalPromoCount: whop.PromoCode.length,
      communityPromoCount: communityPromoCodes.length,
      totalCombinedCount: allPromoCodes.length,
      originalCodes: whop.PromoCode.map(c => ({ id: c.id, isCommunity: c.id.startsWith('community_') })),
      communityCodes: communityPromoCodes.map(c => ({ id: c.id, title: c.title })),
      allCombinedCodes: allPromoCodes.map(c => ({ id: c.id, title: c.title, isCommunity: c.id.startsWith('community_') })),
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    console.error('Debug whop error:', error);
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}