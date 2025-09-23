import { prisma } from '@/lib/prisma';
import { extractTopics, jaccard } from '@/lib/topics';
import { priceAffinity } from '@/lib/price';
import { isGoneSlug } from '@/lib/gone';
import altOverrides from '@/data/alt-overrides.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helpers
function looksLikeCuid(s: string) {
  return /^[a-z][a-z0-9]{20,}$/i.test(s);
}

function normSlug(s: string) {
  return decodeURIComponent(s || '').trim().toLowerCase();
}

interface Alternative {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  category: string | null;
  price: string | null;
  rating: number;
  promoCodes: Array<{
    id: string;
    title: string;
    type: string;
    value: string;
    code: string | null;
  }>;
  anchorText: string;
  similarityScore: number;
}

// Generate reasoned anchor text based on topical relationship
function generateAnchorText(current: any, alternative: any, commonTopics: string[]): string {
  const altName = alternative.name;

  // Use most relevant common topic for anchor text
  if (commonTopics.length > 0) {
    const primaryTopic = commonTopics[0];

    // Topic-specific anchor patterns
    const patterns: { [key: string]: string[] } = {
      cryptotrading: [`${altName} crypto signals`, `${altName} trading bot`, `${altName} crypto course`],
      daytrading: [`${altName} forex strategy`, `${altName} trading signals`, `${altName} day trading course`],
      stocktrading: [`${altName} stock picks`, `${altName} options course`, `${altName} trading strategy`],
      ecommerce: [`${altName} dropshipping course`, `${altName} Shopify training`, `${altName} e-commerce guide`],
      sportsbetting: [`${altName} betting tips`, `${altName} sports picks`, `${altName} betting strategy`],
      business: [`${altName} business course`, `${altName} entrepreneur training`, `${altName} consulting`],
      fitness: [`${altName} workout plan`, `${altName} fitness program`, `${altName} training guide`],
      education: [`${altName} masterclass`, `${altName} online course`, `${altName} training program`],
      digitalmarketing: [`${altName} marketing course`, `${altName} social media training`, `${altName} SEO guide`],
      realestate: [`${altName} property course`, `${altName} real estate training`, `${altName} investment guide`],
      tools: [`${altName} software`, `${altName} automation tool`, `${altName} platform`],
      technology: [`${altName} tech course`, `${altName} coding bootcamp`, `${altName} development training`]
    };

    const topicPatterns = patterns[primaryTopic];
    if (topicPatterns) {
      // Pick pattern based on alternative's category or description keywords
      const altText = alternative.description?.toLowerCase() || '';

      if (altText.includes('signal') || altText.includes('pick')) return topicPatterns[0];
      if (altText.includes('course') || altText.includes('training') || altText.includes('education')) return topicPatterns[2] || topicPatterns[1];
      if (altText.includes('bot') || altText.includes('tool') || altText.includes('software')) return topicPatterns[1];

      return topicPatterns[0]; // Default to first pattern
    }
  }

  // Fallback: category-based or generic
  if (alternative.category) {
    return `${altName} ${alternative.category.toLowerCase()}`;
  }

  return altName; // Ultimate fallback
}

// Generate editorial description for alternatives section
function generateEditorialDescription(current: any, alternatives: Alternative[]): string {
  // Check for override first
  const override = (altOverrides as any)[current.slug];
  if (override && typeof override === 'string') {
    return override;
  }

  if (alternatives.length === 0) {
    return "Explore other verified promo codes and exclusive offers";
  }

  // Extract primary topic from current whop
  const currentTopics = extractTopics(current.name, current.description || '');
  const primaryTopic = currentTopics[0];

  // Topic-specific descriptions
  const topicDescriptions: { [key: string]: string } = {
    cryptotrading: "Discover other cryptocurrency trading courses, signal services, and blockchain education programs",
    daytrading: "Browse additional forex courses, day trading strategies, and technical analysis training programs",
    stocktrading: "Explore more stock trading courses, options strategies, and investment education programs",
    ecommerce: "Find other e-commerce courses, dropshipping guides, and online business training programs",
    sportsbetting: "Check out additional sports betting guides, tipster services, and gambling strategy courses",
    business: "Discover more business courses, entrepreneur training, and professional development programs",
    fitness: "Browse other fitness programs, workout plans, and health coaching services",
    education: "Explore additional online courses, masterclasses, and skill development programs",
    digitalmarketing: "Find more digital marketing courses, social media training, and growth strategy programs",
    realestate: "Discover other real estate courses, property investment guides, and rental income strategies",
    tools: "Browse additional software tools, automation platforms, and productivity solutions",
    technology: "Explore more tech courses, coding bootcamps, and development training programs"
  };

  if (primaryTopic && topicDescriptions[primaryTopic]) {
    return topicDescriptions[primaryTopic];
  }

  // Generic fallback based on content type
  if (current.description?.toLowerCase().includes('course')) {
    return "Browse other educational courses and training programs with exclusive discounts";
  }

  return "Discover similar verified offers and exclusive promo codes in related categories";
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const key = normSlug(params.slug);
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing slug or id' }), { status: 400 });
    }

    // Find current whop (try slug first, then ID)
    let currentWhop = await prisma.whop.findUnique({
      where: { slug: key },
      select: { id: true, slug: true, name: true, description: true, category: true, price: true },
    });

    if (!currentWhop && looksLikeCuid(key)) {
      currentWhop = await prisma.whop.findUnique({
        where: { id: key },
        select: { id: true, slug: true, name: true, description: true, category: true, price: true },
      });
    }

    if (!currentWhop) {
      return new Response(JSON.stringify({ error: 'Whop not found' }), { status: 404 });
    }

    // Extract topics from current whop
    const currentTopics = extractTopics(currentWhop.name, currentWhop.description || '');

    // Get candidate whops for alternatives
    const candidateWhops = await prisma.whop.findMany({
      where: {
        id: { not: currentWhop.id }
      },
      include: {
        PromoCode: {
          select: {
            id: true,
            title: true,
            type: true,
            value: true,
            code: true,
          }
        }
      },
      take: 100 // Reasonable limit for processing
    });

    // Filter out gone slugs to prevent 404 links in internal linking
    const filteredCandidates = [];
    for (const c of candidateWhops) {
      const slug = (c.slug || '').toLowerCase();
      if (!slug) continue;
      if (await isGoneSlug(slug)) continue;
      filteredCandidates.push(c);
    }

    // Calculate similarity scores
    const scoredAlternatives = filteredCandidates
      .map(candidate => {
        const candidateTopics = extractTopics(candidate.name, candidate.description || '');
        const topicSimilarity = jaccard(currentTopics, candidateTopics);
        const priceSimilarity = priceAffinity(currentWhop.price, candidate.price);

        // Combined score: topic similarity is primary, price is secondary
        const combinedScore = (topicSimilarity * 0.8) + (priceSimilarity * 0.2);

        // Find common topics for anchor text generation
        const commonTopics = currentTopics.filter(topic => candidateTopics.includes(topic));

        return {
          ...candidate,
          anchorText: generateAnchorText(currentWhop, candidate, commonTopics),
          similarityScore: combinedScore,
          commonTopics
        };
      })
      .filter(alt => alt.similarityScore > 0.1) // Only include meaningfully similar alternatives
      .sort((a, b) => {
        // Sort by similarity score, then rating, then creation date
        if (b.similarityScore !== a.similarityScore) {
          return b.similarityScore - a.similarityScore;
        }
        if ((b.rating ?? 0) !== (a.rating ?? 0)) {
          return (b.rating ?? 0) - (a.rating ?? 0);
        }
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      })
      .slice(0, 6) // Take top 6 alternatives
      .map(({ commonTopics, ...alt }) => alt); // Remove commonTopics from response

    // Generate editorial description
    const editorialDescription = generateEditorialDescription(currentWhop, scoredAlternatives);

    return new Response(JSON.stringify({
      whop: currentWhop,
      alternatives: scoredAlternatives,
      editorialDescription,
      total: scoredAlternatives.length,
      debug: process.env.NODE_ENV === 'development' ? {
        currentWhopName: currentWhop.name,
        currentWhopTopics: currentTopics,
        totalCandidates: candidateWhops.length,
        filteredCandidates: filteredCandidates.length,
        relevantAlternatives: scoredAlternatives.length
      } : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('alternatives API error:', err);

    if (String(err?.name).includes('PrismaClientValidationError')) {
      return new Response(JSON.stringify({ error: 'Invalid query parameters' }), { status: 400 });
    }

    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
}