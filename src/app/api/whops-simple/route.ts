import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log('Simple whops query starting...');
    
    const whops = await prisma.deal.findMany({
      where: { 
        publishedAt: { not: null }
      },
      take: 15,
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        description: true,
        rating: true,
        price: true,
        affiliateLink: true,
        publishedAt: true
      }
    });
    
    console.log(`Found ${whops.length} published whops`);
    
    // Simple transformation without complex logic
    const simpleWhops = whops.map(whop => ({
      id: whop.id,
      name: whop.name || 'Unknown',
      slug: whop.slug,
      logo: whop.logo || '/images/Simplified Logo.png',
      description: whop.description || 'No description',
      rating: whop.rating || 0,
      price: whop.price || 'Free',
      affiliateLink: whop.affiliateLink,
      publishedAt: whop.publishedAt
    }));
    
    return NextResponse.json({
      whops: simpleWhops,
      total: simpleWhops.length,
      status: 'success'
    });
    
  } catch (error: any) {
    console.error('Simple whops error:', error);
    return NextResponse.json({
      error: error.message,
      status: 'failed'
    }, { status: 500 });
  }
}