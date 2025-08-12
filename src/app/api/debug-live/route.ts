import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const slug = 'ayecon-academy-1:1-mentorship';
    
    // Find the whop exactly as the main API does
    const whop = await prisma.whop.findFirst({
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
      return NextResponse.json({ error: 'Whop not found' });
    }

    // Get community codes
    const communityPromoCodes = await prisma.promoCode.findMany({
      where: {
        whopId: whop.id,
        id: { startsWith: 'community_' }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Combine codes
    const allPromoCodes = [
      ...communityPromoCodes,
      ...whop.PromoCode.filter(code => !code.id.startsWith('community_'))
    ];

    return NextResponse.json({
      timestamp: new Date().toISOString(),
      whop: {
        id: whop.id,
        name: whop.name,
        slug: whop.slug
      },
      originalPromoCount: whop.PromoCode.length,
      communityPromoCount: communityPromoCodes.length,
      totalCombinedCount: allPromoCodes.length,
      promoCodes: allPromoCodes.map(p => ({
        id: p.id,
        title: p.title,
        code: p.code,
        isCommunity: p.id.startsWith('community_')
      }))
    });
    
  } catch (error) {
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}