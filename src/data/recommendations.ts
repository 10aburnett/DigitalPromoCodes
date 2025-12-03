// src/data/recommendations.ts
import { prisma } from '@/lib/prisma';
import { loadNeighbors, getNeighborSlugsFor, getExploreFor } from '@/lib/graph';
import { normalizeSlug } from '@/lib/slug-normalize';

interface PromoCode {
  id: string;
  title: string;
  type: string;
  value: string;
  code: string | null;
}

interface WhopItem {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  category: string | null;
  price: string | null;
  rating: number | null;
  ratingCount: number;
  promoCodes: PromoCode[];
}

interface ExploreLink {
  slug: string;
  name: string;
  logo?: string | null;
  category?: string | null;
  rating?: number | null;
  ratingCount?: number;
}

/**
 * Server-side fetch for recommendations using graph neighbors
 */
export async function getRecommendations(currentWhopSlug: string): Promise<{
  items: WhopItem[];
  explore: ExploreLink | null;
}> {
  try {
    const canonicalSlug = normalizeSlug(currentWhopSlug);

    // Load graph neighbors
    const neighbors = await loadNeighbors();
    const rawSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
    let slugs = Array.from(new Set(rawSlugs.filter(Boolean))).slice(0, 4);

    // Fallback: if graph has no neighbors, use category-based recommendations
    if (slugs.length === 0) {
      const currentWhop = await prisma.deal.findFirst({
        where: { slug: canonicalSlug },
        select: { category: true }
      });

      if (currentWhop?.category) {
        const categoryWhops = await prisma.deal.findMany({
          where: {
            category: currentWhop.category,
            slug: { not: canonicalSlug }
          },
          select: { slug: true },
          orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
          take: 4
        });

        slugs = categoryWhops.map(w => w.slug);
      }

      if (slugs.length === 0) {
        return { items: [], explore: null };
      }
    }

    // Fetch whop details from database - FILTER OUT GONE pages to prevent 404s
    const whops = await prisma.deal.findMany({
      where: {
        slug: { in: slugs },
        // Per ChatGPT fix: only exclude GONE pages (match whop detail page logic)
        NOT: {
          retirement: 'GONE'
        }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        description: true,
        category: true,
        price: true,
        rating: true,
        _count: { select: { Review: true } },
        PromoCode: {
          where: {
            NOT: { id: { startsWith: 'community_' } }
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            type: true,
            value: true,
            code: true
          }
        }
      },
      take: 4
    });

    // Transform to expected format
    const items: WhopItem[] = whops.map(whop => ({
      id: whop.id,
      name: whop.name,
      slug: normalizeSlug(whop.slug), // Ensure canonical slug for links
      logo: whop.logo,
      description: whop.description,
      category: whop.category,
      price: whop.price,
      rating: whop.rating,
      ratingCount: whop._count?.Review ?? 0,
      promoCodes: whop.PromoCode || []
    }));

    // Fetch explore link
    let explore: ExploreLink | null = null;
    try {
      const exploreSlug = getExploreFor(neighbors, canonicalSlug);
      const shownSlugs = new Set(items.map(r => r.slug));

      if (exploreSlug && !shownSlugs.has(exploreSlug)) {
        const exploreWhop = await prisma.deal.findFirst({
          where: {
            slug: exploreSlug,
            // Filter out GONE pages to prevent 404s
            NOT: {
              retirement: 'GONE'
            }
          },
          select: {
            slug: true,
            name: true,
            logo: true,
            category: true,
            rating: true,
            _count: { select: { Review: true } }
          }
        });

        if (exploreWhop) {
          explore = {
            slug: normalizeSlug(exploreWhop.slug), // Ensure canonical slug
            name: exploreWhop.name,
            logo: exploreWhop.logo,
            category: exploreWhop.category ?? undefined,
            rating: exploreWhop.rating,
            ratingCount: exploreWhop._count?.Review ?? 0
          };
        }
      }
    } catch {
      // Silent fail for explore link
    }

    return { items, explore };
  } catch (error) {
    console.error('Error fetching recommendations:', error);
    return { items: [], explore: null };
  }
}

/**
 * Server-side fetch for alternatives using graph neighbors
 */
export async function getAlternatives(currentWhopSlug: string): Promise<{
  items: WhopItem[];
  explore: ExploreLink | null;
}> {
  try {
    const canonicalSlug = normalizeSlug(currentWhopSlug);

    // Load graph neighbors
    const neighbors = await loadNeighbors();
    const rawAltSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'alternatives');

    // Get recommended slugs to exclude them from alternatives (keep sections distinct)
    const recSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
    const recSet = new Set(recSlugs);

    // Filter out any alternatives that appear in recommendations
    let slugs = Array.from(new Set(rawAltSlugs.filter(Boolean).filter(slug => !recSet.has(slug)))).slice(0, 5);

    // Fallback: if graph has no alternatives, use category-based alternatives
    if (slugs.length === 0) {
      const currentWhop = await prisma.deal.findFirst({
        where: { slug: canonicalSlug },
        select: { category: true }
      });

      if (currentWhop?.category) {
        const excludeSlugs = [canonicalSlug, ...Array.from(recSet)];
        const categoryWhops = await prisma.deal.findMany({
          where: {
            category: currentWhop.category,
            slug: { notIn: excludeSlugs } // Exclude current whop and recommendations
          },
          select: { slug: true },
          orderBy: [{ rating: 'desc' }, { createdAt: 'desc' }],
          take: 5
        });

        slugs = categoryWhops.map(w => w.slug);
      }

      if (slugs.length === 0) {
        return { items: [], explore: null };
      }
    }

    // Fetch whop details from database - FILTER OUT GONE pages to prevent 404s
    const whops = await prisma.deal.findMany({
      where: {
        slug: { in: slugs },
        // Per ChatGPT fix: only exclude GONE pages (match whop detail page logic)
        NOT: {
          retirement: 'GONE'
        }
      },
      select: {
        id: true,
        name: true,
        slug: true,
        logo: true,
        description: true,
        category: true,
        price: true,
        rating: true,
        _count: { select: { Review: true } },
        PromoCode: {
          where: {
            NOT: { id: { startsWith: 'community_' } }
          },
          orderBy: { createdAt: 'desc' },
          take: 1,
          select: {
            id: true,
            title: true,
            type: true,
            value: true,
            code: true
          }
        }
      },
      take: 5
    });

    // Transform to expected format
    const items: WhopItem[] = whops.map(whop => ({
      id: whop.id,
      name: whop.name,
      slug: normalizeSlug(whop.slug), // Ensure canonical slug for links
      logo: whop.logo,
      description: whop.description,
      category: whop.category,
      price: whop.price,
      rating: whop.rating,
      ratingCount: whop._count?.Review ?? 0,
      promoCodes: whop.PromoCode || []
    }));

    // Fetch explore link
    let explore: ExploreLink | null = null;
    try {
      const exploreSlug = getExploreFor(neighbors, canonicalSlug);
      const shownSlugs = new Set(items.map(r => r.slug));

      if (exploreSlug && !shownSlugs.has(exploreSlug)) {
        const exploreWhop = await prisma.deal.findFirst({
          where: {
            slug: exploreSlug,
            // Filter out GONE pages to prevent 404s
            NOT: {
              retirement: 'GONE'
            }
          },
          select: {
            slug: true,
            name: true,
            logo: true,
            category: true,
            rating: true,
            _count: { select: { Review: true } }
          }
        });

        if (exploreWhop) {
          explore = {
            slug: normalizeSlug(exploreWhop.slug), // Ensure canonical slug
            name: exploreWhop.name,
            logo: exploreWhop.logo,
            category: exploreWhop.category ?? undefined,
            rating: exploreWhop.rating,
            ratingCount: exploreWhop._count?.Review ?? 0
          };
        }
      }
    } catch {
      // Silent fail for explore link
    }

    return { items, explore };
  } catch (error) {
    console.error('Error fetching alternatives:', error);
    return { items: [], explore: null };
  }
}
