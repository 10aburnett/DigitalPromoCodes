import { unstable_noStore as noStore } from 'next/cache';
import { prisma } from '@/lib/prisma';
import { whereIndexable } from '@/lib/where-indexable';

function safeDecode(v: string) {
  try { return decodeURIComponent(v); } catch { return v; }
}

const startOfTodayUTC = () => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
};

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

  // Fetch usage stats for SEO (server-side)
  const since = startOfTodayUTC();
  const whereBase = {
    actionType: 'code_copy' as const,
    OR: [
      { path: { contains: `/whop/${whop.slug}`, mode: 'insensitive' as const } },
      { path: { contains: `/en/whop/${whop.slug}`, mode: 'insensitive' as const } },
      { path: { contains: `https://whpcodes.com/whop/${whop.slug}`, mode: 'insensitive' as const } }
    ]
  };

  const [totalCount, todayCount, lastUsage] = await Promise.all([
    prisma.offerTracking.count({ where: whereBase }).catch(() => 0),
    prisma.offerTracking.count({ where: { ...whereBase, createdAt: { gte: since } } }).catch(() => 0),
    prisma.offerTracking.findFirst({
      where: whereBase,
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true }
    }).catch(() => null)
  ]);

  // Fetch verification/freshness data (for Verification Status section)
  let freshnessData = null;
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const freshnessPath = path.join(process.cwd(), 'public', 'data', 'pages', `${whop.slug}.json`);
    const freshnessFile = await fs.readFile(freshnessPath, 'utf-8');
    freshnessData = JSON.parse(freshnessFile);
  } catch {
    // No freshness data available
  }

  // Return whop with combined promo codes + usage stats + verification data
  return {
    ...whop,
    PromoCode: allPromoCodes,
    usageStats: {
      todayCount,
      totalCount,
      lastUsed: lastUsage?.createdAt ?? null,
      verifiedDate: whop.updatedAt || whop.createdAt
    },
    freshnessData
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