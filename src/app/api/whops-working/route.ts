import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '15');
    const offset = (page - 1) * limit;
    
    console.log('Fetching whops with pagination:', { page, limit, offset });
    
    const whops = await prisma.whop.findMany({
      where: { 
        publishedAt: { not: null }
      },
      take: limit,
      skip: offset,
      orderBy: { createdAt: 'asc' },
      include: {
        PromoCode: true
      }
    });
    
    console.log(`Found ${whops.length} published whops`);
    
    // Simple transformation
    const transformedWhops = whops.map(whop => ({
      id: whop.id,
      name: whop.name || 'Unknown',
      slug: whop.slug,
      logo: whop.logo || '/images/Simplified Logo.png',
      description: whop.description || 'No description',
      rating: whop.rating || 0,
      price: whop.price || 'Free',
      promoText: whop.description || 'N/A',
      promoCode: whop.PromoCode?.[0]?.code || null,
      promoType: whop.PromoCode?.[0]?.type || null,
      promoValue: whop.PromoCode?.[0]?.value || null,
      affiliateLink: whop.affiliateLink,
      createdAt: whop.createdAt,
      promoCodes: whop.PromoCode || [],
      website: whop.website,
      category: whop.category
    }));
    
    const total = await prisma.whop.count({
      where: { publishedAt: { not: null } }
    });
    
    return NextResponse.json({
      whops: transformedWhops,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    });
    
  } catch (error: any) {
    console.error('Whops API error:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}