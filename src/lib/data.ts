import { unstable_noStore as noStore } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { whereIndexable } from '@/lib/where-indexable';

function safeDecode(v: string) {
  try { return decodeURIComponent(v); } catch { return v; }
}

export async function getWhopBySlug(slug: string, locale: string = 'en') {
  noStore();

  // Try multiple slug variants to handle encoding mismatches
  const raw = slug ?? '';
  const decoded = safeDecode(raw);
  const reEncoded = encodeURIComponent(decoded);
  const colonSwap = decoded.replace(/:/g, '%3A');
  const decolonSwap = decoded.replace(/%3A/gi, ':');

  const whop = await prisma.whop.findFirst({
    where: {
      AND: [
        whereIndexable(),
        {
          OR: [
            { slug: decoded },
            { slug: raw },
            { slug: reEncoded },
            { slug: { equals: decoded, mode: 'insensitive' } },
            { slug: { equals: reEncoded, mode: 'insensitive' } },
            { slug: colonSwap },
            { slug: decolonSwap },
            // Sometimes cards link with an ID instead of slug
            { id: decoded },
            { id: raw },
          ],
        },
      ],
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