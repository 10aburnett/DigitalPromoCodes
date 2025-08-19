import { unstable_noStore as noStore } from 'next/cache';
import { prisma } from '@/lib/prisma';

export async function getWhopBySlug(slug: string, locale: string = 'en') {
  noStore();
  
  // Decode the slug in case it's URL encoded
  const decodedSlug = decodeURIComponent(slug);
  
  const whop = await prisma.whop.findFirst({
    where: { 
      slug: decodedSlug,
      locale,
      publishedAt: { not: null }
    },
    select: {
      id: true,
      name: true,
      slug: true,
      logo: true,
      description: true,
      rating: true,
      displayOrder: true,
      createdAt: true,
      updatedAt: true,
      publishedAt: true,
      affiliateLink: true,
      screenshots: true,
      website: true,
      price: true,
      category: true,
      aboutContent: true,
      howToRedeemContent: true,
      promoDetailsContent: true,
      featuresContent: true,
      termsContent: true,
      faqContent: true,
      whopCategory: true,
      indexingStatus: true,
      retired: true,
      locale: true,
      PromoCode: {
        where: {
          NOT: { id: { startsWith: 'community_' } }
        },
        orderBy: { createdAt: 'desc' }
      },
      Review: {
        where: { verified: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });

  if (!whop) return null;

  // Get community-submitted promo codes that have been approved for this whop
  const communityPromoCodes = await prisma.promoCode.findMany({
    where: {
      whopId: whop.id,
      id: { startsWith: 'community_' }
    },
    orderBy: { createdAt: 'desc' }
  });

  // Combine promo codes with community codes first, then original codes
  const allPromoCodes = [
    ...communityPromoCodes,
    ...whop.PromoCode.filter(code => !code.id.startsWith('community_'))
  ];

  // Return whop with combined promo codes
  return {
    ...whop,
    PromoCode: allPromoCodes
  };
}

export async function getIndexableWhops(limit = 5000) {
  return prisma.whop.findMany({
    where: { 
      indexingStatus: 'INDEX', 
      retirement: 'NONE',
      publishedAt: { not: null }
    },
    select: { 
      slug: true, 
      locale: true, 
      updatedAt: true 
    },
    take: limit,
    orderBy: { updatedAt: 'desc' }
  });
}

export async function getNoindexWhops(limit = 50000) {
  return prisma.whop.findMany({
    where: { 
      indexingStatus: 'NOINDEX',
      retirement: 'NONE',
      publishedAt: { not: null }
    },
    select: { 
      slug: true, 
      locale: true, 
      updatedAt: true
    },
    take: limit,
    orderBy: { updatedAt: 'desc' }
  });
}