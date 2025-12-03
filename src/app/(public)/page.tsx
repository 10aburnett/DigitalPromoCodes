import HomePageServer from '@/components/HomePageServer';
import StatisticsSectionServer from '@/components/StatisticsSectionServer';
import CallToAction from '@/components/CallToAction';
import { prisma } from '@/lib/prisma';
import { getStatisticsCached } from '@/data/statistics'; // Server-side statistics
import { absoluteUrl, offerAbsoluteUrl } from '@/lib/urls';
import { SITE_BRAND, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/brand';
import type { Metadata } from 'next';

// Force dynamic rendering so ?page= works server-side (not statically cached)
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;
export const runtime = 'nodejs'; // Required for Prisma

// Floors to the nearest thousand/million: 98,600 -> "98K"
const formatCompact = (n: number) => {
  if (!Number.isFinite(n) || n <= 0) return '0';
  if (n >= 1_000_000) return `${Math.floor(n / 1_000_000)}M`;
  if (n >= 1_000) return `${Math.floor(n / 1_000)}K`;
  return `${Math.floor(n)}`;
};

// Read marketing users from env (NEXT_PUBLIC_ so it's safe in the client if needed)
const getMarketingUsers = (dbCount: number) => {
  const fromEnv = Number(process.env.NEXT_PUBLIC_MARKETING_USERS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : dbCount;
};

// Define the types for our data
interface PromoCode {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

interface DealWithPromos {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
  rating: number;
  displayOrder: number;
  affiliateLink: string | null;
  price?: string | null;
  promoCodes: PromoCode[];
  priceText?: string;
  priceBadge?: string;
}

interface InitialData {
  whops: DealWithPromos[];
  totalUsers: number;
  totalCount: number;
}

// Loading component for Suspense
const HomePageLoading = () => (
  <div className="text-center py-20">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent" style={{ borderColor: 'var(--accent-color)', borderRightColor: 'transparent' }}></div>
    <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
  </div>
);

// Server-side data fetching with search/filter/sort support
async function getPagedWhops({
  page = 1,
  q = '',
  category = '',
  sort = ''
}: {
  page?: number;
  q?: string;
  category?: string;
  sort?: string;
}) {
  try {
    const limit = 15;
    const skip = (page - 1) * limit;

    // Build where clause for filtering
    const where: any = {};

    // Search filter
    if (q) {
      where.OR = [
        { name: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
      ];
    }

    // Category filter - using whopCategory enum field
    if (category && category !== '' && category !== 'all') {
      where.whopCategory = category;
    }

    // Build orderBy clause for sorting
    let orderBy: any = { displayOrder: 'asc' }; // default

    if (sort) {
      switch (sort) {
        case 'newest':
          orderBy = { createdAt: 'desc' };
          break;
        case 'highest-rated':
          orderBy = { rating: 'desc' };
          break;
        case 'alpha-asc':
          orderBy = { name: 'asc' };
          break;
        case 'alpha-desc':
          orderBy = { name: 'desc' };
          break;
        case 'relevance':
        default:
          orderBy = { displayOrder: 'asc' };
          break;
      }
    }

    // Fetch with filtering and sorting
    const [whops, totalCount] = await Promise.all([
      prisma.deal.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          PromoCode: {
            select: {
              id: true,
              title: true,
              description: true,
              code: true,
              type: true,
              value: true,
            },
          },
        },
      }),
      prisma.deal.count({ where }),
    ]);

    // Get user count (DB)
    const totalUsersDb = await prisma.user.count();

    // Unified, env-first marketing counter
    const marketingUsers = getMarketingUsers(totalUsersDb);

    // Transform data to match expected format
    const formattedWhops = whops.map(whop => ({
      id: whop.id,
      name: whop.name,
      slug: whop.slug,
      logo: whop.logo,
      description: whop.description,
      rating: whop.rating,
      displayOrder: whop.displayOrder,
      affiliateLink: whop.affiliateLink,
      promoCodes: whop.PromoCode.map(code => ({
        id: code.id,
        title: code.title,
        description: code.description,
        code: code.code,
        type: code.type,
        value: code.value
      })),
      // Add price fields for card display
      priceText: (whop as any).price || 'Free',
      price: (whop as any).price || 'Free',
      priceBadge: (whop as any).price || 'Free'
    }));

    return {
      items: formattedWhops,
      totalPages: Math.ceil(totalCount / limit),
      total: totalCount,
      totalUsers: marketingUsers,
    };
  } catch (error) {
    console.error('Error fetching paged whops:', error);
    return {
      items: [],
      totalPages: 1,
      total: 0,
      totalUsers: 0,
    };
  }
}

// Metadata for SEO
export async function generateMetadata(): Promise<Metadata> {
  const currentYear = new Date().getFullYear();
  const title = `${SITE_BRAND} - Exclusive Deals & Discounts ${currentYear}`;
  const description = `${SITE_TAGLINE}. Our curated list includes verified digital products, courses, communities, and more with exclusive discounts for ${currentYear}.`;

  return {
    title,
    description,
    alternates: {
// PHASE1-DEINDEX:       canonical: absoluteUrl('/')
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      }
    },
    openGraph: {
      title,
      description,
      type: 'website',
      url: absoluteUrl('/')
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description
    }
  };
}

export default async function Home({
  searchParams,
}: {
  searchParams?: {
    page?: string;
    search?: string;
    whopCategory?: string;
    sortBy?: string;
  };
}) {
  // Parse all search params
  const page = Math.max(1, Number(searchParams?.page ?? '1') || 1);
  const search = (searchParams?.search ?? '').toString().trim();
  const whopCategory = (searchParams?.whopCategory ?? '').toString();
  const sortBy = (searchParams?.sortBy ?? '').toString();

  // Deterministic log for debugging
  console.log('[HOME SSR]', { page, search, whopCategory, sortBy });

  const [data, statistics] = await Promise.all([
    getPagedWhops({
      page,
      q: search,
      category: whopCategory,
      sort: sortBy,
    }),
    getStatisticsCached()
  ]);
  const currentYear = new Date().getFullYear();

  // Build JSON-LD schemas for server HTML
  const siteUrl = absoluteUrl('/');
  const websiteSchema = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    '@id': `${siteUrl}#website`,
    'name': SITE_BRAND,
    'description': SITE_DESCRIPTION,
    'url': siteUrl,
    'potentialAction': {
      '@type': 'SearchAction',
      'target': {
        '@type': 'EntryPoint',
        'urlTemplate': `${siteUrl}?search={search_term_string}`
      },
      'query-input': 'required name=search_term_string'
    }
  };

  const organizationSchema = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    '@id': `${siteUrl}#org`,
    'name': SITE_BRAND,
    'url': siteUrl,
    'logo': {
      '@type': 'ImageObject',
      'url': absoluteUrl('/logo.png'),
      'width': 400,
      'height': 400
    },
    'description': SITE_DESCRIPTION,
    // sameAs removed - no verified social profiles for new brand yet
    'contactPoint': {
      '@type': 'ContactPoint',
      'contactType': 'customer service',
      'url': absoluteUrl('/contact')
    }
  };

  const offersSchema = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    'name': `Top Deals & Discounts ${currentYear}`,
    'description': `Curated list of the best deals and discount codes for ${currentYear}`,
    'numberOfItems': data.total,
    'itemListElement': data.items.slice(0, 10).map((whop, index) => ({
      '@type': 'ListItem',
      'position': index + 1,
      'item': {
        '@type': 'Product',
        'name': whop.name,
        'description': whop.description,
        'url': offerAbsoluteUrl(whop.slug.toLowerCase()),
        'image': whop.logo,
        'aggregateRating': {
          '@type': 'AggregateRating',
          'ratingValue': whop.rating,
          'bestRating': 5,
          'worstRating': 1
        },
        'offers': whop.promoCodes.map(promo => ({
          '@type': 'Offer',
          'name': promo.title,
          'description': promo.description,
          'url': offerAbsoluteUrl(whop.slug.toLowerCase()),
          'availability': 'https://schema.org/InStock',
          'validFrom': new Date().toISOString(),
          'priceSpecification': {
            '@type': 'PriceSpecification',
            'price': promo.value && promo.value !== '0' ?
              (promo.value.includes('$') || promo.value.includes('%') || promo.value.includes('off') ? promo.value : `${promo.value}% off`)
              : 'Exclusive Access'
          }
        }))
      }
    }))
  };

  return (
    <main className="min-h-screen pt-0 mt-0 pb-12 md:py-12 transition-theme space-y-0 md:space-y-6" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      {/* Server-rendered JSON-LD structured data */}
      <script id="homepage-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteSchema) }} />
      <script id="organization-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(organizationSchema) }} />
      <script id="offers-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(offersSchema) }} />

      {/* Server-rendered content - pure server component with key for remounting */}
      <HomePageServer
        key={`p-${page}`}
        items={data.items}
        currentPage={page}
        totalPages={data.totalPages}
        total={data.total}
      />

      {/* Statistics Section - Server Rendered */}
      <StatisticsSectionServer stats={statistics} />

      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
        <div className="mobile-dark-section mt-8 md:mt-24 mb-16 bg-white md:bg-transparent">
          {/* Hero Section - Server Rendered */}
          <div className="text-center mb-16">
            <div className="md-pill inline-flex items-center gap-2 rounded-full px-6 py-3 mb-6 mt-1 md:mt-6 transition-theme" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-color)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>
                {data.totalUsers > 0 ? (
                  `Trusted by ${formatCompact(data.totalUsers)}+ Users`
                ) : (
                  'Verified Promo Codes'
                )}
              </span>
            </div>

            <h2 className="md-heading text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r bg-clip-text text-transparent leading-tight py-2" style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))` }}>
              {SITE_BRAND}
            </h2>

            <p className="md-body max-w-3xl mx-auto text-lg md:text-xl leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              {SITE_TAGLINE}. Get exclusive access to premium communities, courses, and digital products at discounted prices.
            </p>
          </div>

          {/* Features Grid - Server Rendered */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="mobile-dark-section text-center p-6">
              <div className="md-icon w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="md-heading text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>Expert Reviews</h3>
              <p className="md-body" style={{ color: 'var(--text-secondary)' }}>
                Our team thoroughly tests each digital product and promo code to ensure you get the best deals with genuine value and access.
              </p>
            </div>

            <div className="mobile-dark-section text-center p-6">
              <div className="md-icon w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="md-heading text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>Exclusive Access</h3>
              <p className="md-body" style={{ color: 'var(--text-secondary)' }}>
                Get special promo codes and exclusive discounts that you won't find anywhere else, negotiated exclusively for our community.
              </p>
            </div>

            <div className="mobile-dark-section text-center p-6">
              <div className="md-icon w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="md-heading text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>Always Updated</h3>
              <p className="md-body" style={{ color: 'var(--text-secondary)' }}>
                Our promo code database is updated daily to ensure all offers are current, active, and provide maximum value to users.
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <CallToAction />
        </div>
      </div>
    </main>
  );
} 