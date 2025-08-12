import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get database connection info
    const databaseUrl = process.env.DATABASE_URL || 'Not set';
    const isRoughRain = databaseUrl.includes('rough-rain');
    const isNoisyHat = databaseUrl.includes('noisy-hat');
    
    // Check PromoCodeSubmissions
    const submissions = await prisma.promoCodeSubmission.findMany({
      where: { status: 'APPROVED' }
    });
    
    // Check community promo codes
    const communityPromos = await prisma.promoCode.findMany({
      where: { id: { startsWith: 'community_' } }
    });
    
    // Check both possible Ayecon slugs
    const ayeconWhop1 = await prisma.whop.findFirst({
      where: { slug: 'ayecon-academy-1-1-mentorship' }
    });
    const ayeconWhop2 = await prisma.whop.findFirst({
      where: { slug: 'ayecon-academy-1:1-mentorship' }
    });
    
    // Find any Ayecon-related whops
    const ayeconWhops = await prisma.whop.findMany({
      where: { 
        OR: [
          { slug: { contains: 'ayecon' } },
          { name: { contains: 'Ayecon' } }
        ]
      },
      select: { id: true, slug: true, name: true, publishedAt: true }
    });
    
    const ayeconWhop = ayeconWhop1 || ayeconWhop2;
    
    let ayeconData = null;
    if (ayeconWhop) {
      const ayeconPromos = await prisma.promoCode.findMany({
        where: { whopId: ayeconWhop.id }
      });
      ayeconData = {
        totalPromos: ayeconPromos.length,
        communityCount: ayeconPromos.filter(p => p.id.startsWith('community_')).length,
        originalCount: ayeconPromos.filter(p => !p.id.startsWith('community_')).length,
        promoIds: ayeconPromos.map(p => ({ id: p.id, isCommunity: p.id.startsWith('community_') }))
      };
    }
    
    return NextResponse.json({
      database: {
        isRoughRain,
        isNoisyHat,
        endpoint: databaseUrl.includes('rough-rain') ? 'rough-rain (development)' : 
                  databaseUrl.includes('noisy-hat') ? 'noisy-hat (production)' : 'unknown'
      },
      submissions: {
        approved: submissions.length,
        ids: submissions.map(s => s.id)
      },
      communityPromos: {
        count: communityPromos.length,
        ids: communityPromos.map(p => p.id)
      },
      ayecon: ayeconData,
      ayeconWhopsFound: ayeconWhops,
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      database: process.env.DATABASE_URL?.includes('rough-rain') ? 'rough-rain' : 'unknown'
    }, { status: 500 });
  }
}