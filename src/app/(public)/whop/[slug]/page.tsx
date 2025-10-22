import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import dynamicImport from 'next/dynamic';
import { normalizeImagePath } from '@/lib/image-utils';
import { getWhopBySlugCached } from '@/data/whops'; // NEW: Use cached version
import { getWhopBySlug } from '@/lib/data'; // Keep for metadata generation
import { prisma } from '@/lib/prisma';
import { whereIndexable } from '@/lib/where-indexable';
import { Suspense } from 'react';
import { canonicalSlugForDB, canonicalSlugForPath } from '@/lib/slug-utils';
import { siteOrigin } from '@/lib/site-origin';
import { notFoundWithReason } from '@/lib/notFoundReason';
import { dlog } from '@/lib/debug';

// Static generation with ISR for stable SSR/CSR hydration
export const dynamic = 'force-static';
export const revalidate = 600; // 10 minute revalidation for freshness
export const dynamicParams = true; // Enable dynamic params for all slugs
export const runtime = 'nodejs'; // required for Prisma database access

import InitialsAvatar from '@/components/InitialsAvatar';
import WhopLogo from '@/components/WhopLogo';
import WhopPageInteractive from '@/components/WhopPageInteractive';
import PromoCodeSubmissionButton from '@/components/PromoCodeSubmissionButton';

// Below-the-fold components: dynamically import to reduce initial bundle size
const WhopReviewSection = dynamicImport(() => import('@/components/WhopReviewSection'), {
  loading: () => null,
});
import FAQSectionServer from '@/components/FAQSectionServer'; // Server component for SEO
import RecommendedWhopsServer from '@/components/RecommendedWhopsServer'; // Server component for recommendations
import AlternativesServer from '@/components/AlternativesServer'; // Server component for alternatives
import { getRecommendations, getAlternatives } from '@/data/recommendations'; // Data fetching for recommendations/alternatives
import { getPromoStatsForSlug } from '@/data/promo-stats'; // Server-side promo usage statistics
const CommunityPromoSection = dynamicImport(() => import('@/components/CommunityPromoSection'), {
  loading: () => null, // Keep SSR for SEO-relevant content
});

import { parseFaqContent } from '@/lib/faq-types';
import RenderPlain from '@/components/RenderPlain';
import { looksLikeHtml, isMeaningful, escapeHtml, toPlainText } from '@/lib/textRender';
import PromoStatsDisplay from '@/components/PromoStatsDisplay';
import VerificationStatus from '@/components/VerificationStatus';
import HowToSection from '@/components/whop/HowToSection';
import HowToSchema from '@/components/whop/HowToSchema';
import HydrationTripwire from '@/components/HydrationTripwire';
import ServerSectionGuard from '@/components/ServerSectionGuard';
import { djb2 } from '@/lib/hydration-debug';
import 'server-only';
import { jsonLdScript } from '@/lib/jsonld';
import { buildPrimaryEntity, buildBreadcrumbList, buildOffers, buildFAQ, buildHowTo, buildItemList, buildReviews } from '@/lib/buildSchema';
import type { WhopViewModel } from '@/lib/buildSchema';
import { getWhopViewModel } from './vm';
import { LOCALES, isLocaleEnabled, getSchemaLocale } from '@/lib/schema-locale';
import { whopAbsoluteUrl } from '@/lib/urls';
import { getPageClassification, getRobotsForClassification, shouldIncludeInHreflang } from '@/lib/seo-classification';

// Prebuild top 800 quality pages at build time, use ISR for long tail
// TEMPORARILY DISABLED per ChatGPT fix - causes 404s with JS ON
// export async function generateStaticParams() {
//   if (process.env.NODE_ENV !== 'production') return [];

//   const rows = await prisma.whop.findMany({
//     where: whereIndexable(),
//     select: { slug: true },
//     orderBy: { displayOrder: 'asc' },
//     take: 800 // Budget for top "money pages"
//   });

//   return rows.map(r => ({ slug: r.slug }));
// }

interface PromoCode {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

interface Review {
  id: string;
  author: string;
  content: string;
  rating: number;
  createdAt: string;
  verified: boolean;
}

interface Whop {
  id: string;
  name: string;
  whopName?: string;
  slug: string;
  logo: string | null;
  description: string;
  rating: number;
  affiliateLink: string | null;
  website: string | null;
  price: string | null;
  category: string | null;
  promoCodes: PromoCode[];
  reviews?: Review[];
}

function resolveBaseUrl(): string {
  // Use centralized siteOrigin helper (static-generation safe)
  return siteOrigin();
}

// Helper function for fetching deal data with Next.js caching
async function getDeal(slug: string) {
  // Use Next.js fetch with ISR caching
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  
  try {
    const res = await fetch(`${baseUrl}/api/deals/${slug}`, {
      next: { revalidate: 300 }, // 5 minutes
    });

    if (!res.ok) return null;
    return res.json();
  } catch (error) {
    // Fallback to direct database query if API fails
    console.warn('API fetch failed, falling back to direct DB query:', error);
    return await getWhopBySlug(slug);
  }
}

// Helper: load verification data (fetch-only, edge-safe)
async function getVerificationData(slug: string) {
  try {
    const { fileSlug } = await import("@/lib/slug-utils");
    const encoded = fileSlug(slug);
    const base = resolveBaseUrl();

    // main
    let res = await fetch(`${base}/api/data/pages/${encoded}.json`, {
      cache: "no-store",           // or: next: { revalidate: 0 }
    });

    // fallback: legacy lowercase %XX if needed
    if (!res.ok) {
      const lower = encoded.replace(/%[0-9A-F]{2}/g, m => m.toLowerCase());
      res = await fetch(`${base}/api/data/pages/${lower}.json`, {
        cache: "no-store",
      });
    }

    if (!res.ok) {
      console.error('VERIFICATION_FETCH_FAIL: HTTP', res.status, 'for', encoded);
      return null;
    }

    const raw = await res.json();
    console.log('VERIFICATION_DATA_RAW:', slug, JSON.stringify(raw).slice(0, 200));

    // Return the full raw data including whopUrl, lastUpdated, and ledger
    return raw;
  } catch (err) {
    console.error('VERIFICATION_FETCH_FAIL', slug, err);
    return null; // never throw
  }
}

// Skeleton component for streaming sections
function SectionSkeleton() {
  return (
    <div className="h-48 w-full rounded animate-pulse bg-gray-200/40 dark:bg-white/10"></div>
  );
}

// Helper function to extract currency from price string
function extractCurrency(price: string | null): string {
  if (!price) return 'USD';

  // Check for common currency symbols and patterns
  if (price.includes('$')) return 'USD';
  if (price.includes('£')) return 'GBP';
  if (price.includes('€')) return 'EUR';
  if (price.toLowerCase().includes('usd')) return 'USD';
  if (price.toLowerCase().includes('gbp')) return 'GBP';
  if (price.toLowerCase().includes('eur')) return 'EUR';

  return 'USD'; // Default fallback
}

// Helper function to detect if product has trial
function hasTrial(price: string | null): boolean {
  if (!price) return false;
  const lowerPrice = price.toLowerCase();
  return lowerPrice.includes('trial') || lowerPrice.includes('free trial') || lowerPrice.includes('7 days') || lowerPrice.includes('14 days');
}

// Async component for heavy sections that can be streamed
async function RecommendedSection({ currentWhopSlug }: { currentWhopSlug: string }) {
  const { items } = await getRecommendations(currentWhopSlug);
  // Freeze data to ensure deterministic server/client rendering
  const frozen = (items ?? [])
    .filter(Boolean)
    .map(w => ({
      slug: w.slug,
      name: w.name,
      logo: w.logo ?? null,
      description: w.description ?? null
    }))
    .sort((a,b) => a.slug.localeCompare(b.slug));

  // Server-rendered recommendations with normal React hydration
  return <RecommendedWhopsServer items={frozen} />;
}

async function AlternativesSection({ currentWhopSlug }: { currentWhopSlug: string }) {
  const { items, explore } = await getAlternatives(currentWhopSlug);
  // Freeze data to ensure deterministic server/client rendering
  const frozen = (items ?? [])
    .filter(Boolean)
    .map(w => ({
      slug: w.slug,
      name: w.name,
      logo: w.logo ?? null,
      blurb: w.description ?? null  // Map description to blurb for AlternativesServer
    }))
    .sort((a,b) => a.slug.localeCompare(b.slug));
  const exploreHref = explore ? `/whop/${encodeURIComponent(explore.slug)}` : undefined;

  // Server-rendered alternatives with normal React hydration
  return <AlternativesServer items={frozen} exploreHref={exploreHref} />;
}

async function ReviewsSection({ whopId, whopName, reviews }: { whopId: string; whopName: string; reviews: any[] }) {
  // Simulate a small delay to show streaming effect in development
  await new Promise(resolve => setTimeout(resolve, 150));
  
  return (
    <WhopReviewSection 
      whopId={whopId}
      whopName={whopName}
      reviews={reviews}
    />
  );
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  try {
    // Remove unstable_noStore() - rely on route-level revalidate
    const decoded = decodeURIComponent(params.slug ?? '');  // Decode before normalizing
    const canon = canonicalSlugForPath(decoded);
    // Use lowercase decoded slug for DB lookup (DB stores literal colons, not %3a)
    const dbSlug = decoded.toLowerCase();
    console.log('[WHOP META] Generating metadata for:', { slug: params.slug, dbSlug });

    const whopData = await getWhopBySlug(dbSlug, 'en');
    console.log('[WHOP META] Data fetched:', { found: !!whopData, name: whopData?.name });

    if (!whopData) {
      console.warn('[WHOP META] No data found, returning 404 metadata');
      return {
        title: 'Whop Not Found',
        description: 'The requested whop could not be found.',
        robots: { index: false, follow: true }
      };
    }

    // Check if whop is retired or not indexed - return noindex metadata
    if (whopData.retired || whopData.indexingStatus !== 'INDEXED') {
      console.warn('[WHOP META] Whop is retired/not indexed:', {
        retired: whopData.retired,
        indexingStatus: whopData.indexingStatus
      });
      return {
        title: 'Content No Longer Available',
        description: 'This content has been retired and is no longer available.',
        robots: {
          index: false,
          follow: false
        }
      };
    }

  // Get current month and year for SEO
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const monthYear = `(${currentMonth} ${currentYear})`;

  const title = `${whopData.name} Promo Code ${monthYear}`;
  
  // Build dynamic meta description
  let description = '';
  const whopName = whopData.name;
  const promoCodes = whopData.PromoCode || [];
  const firstPromo = promoCodes[0];
  const price = whopData.price;
  const category = whopData.category;

  // Start with base call-to-action
  if (firstPromo && firstPromo.code) {
    // Has a promo code
    if (firstPromo.value && firstPromo.value !== '0' && firstPromo.value !== '') {
      // Has specific discount value
      const promoValueText = firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off') 
        ? firstPromo.value 
        : `${firstPromo.value}% off`;
      description = `Get ${promoValueText} ${whopName} with our exclusive promo code.`;
    } else {
      // Has promo code but no specific discount value
      description = `Claim your exclusive discount on ${whopName} with our special promo code.`;
    }
  } else {
    // No promo code, just exclusive access
    description = `Get exclusive access to ${whopName} through our special link.`;
  }

  // Add pricing information if available
  if (price) {
    if (price === 'Free') {
      description += ` Access this free ${category ? category.toLowerCase() : 'content'}.`;
    } else if (price !== 'N/A') {
      description += ` Starting at ${price}.`;
    }
  }

  // Add category/type information
  if (category) {
    const categoryLower = category.toLowerCase();
    if (!description.includes(categoryLower)) {
      description += ` Premium ${categoryLower} content.`;
    }
  }

  // Add urgency and freshness
  description += ` Limited time offer - verified ${currentMonth} ${currentYear}.`;

  // Add final call-to-action
  if (firstPromo && firstPromo.code) {
    description += ' Copy code & save now!';
  } else {
    description += ' Join today!';
  }

  // Ensure description is within optimal length (150-160 characters)
  if (description.length > 160) {
    // Trim and add ellipsis, but try to keep complete sentences
    const sentences = description.split('. ');
    let shortDescription = '';
    for (const sentence of sentences) {
      const testLength = shortDescription + sentence + '. ';
      if (testLength.length <= 157) { // Leave room for ellipsis
        shortDescription = testLength;
      } else {
        break;
      }
    }
    
    if (shortDescription.length > 0) {
      description = shortDescription.trim();
      if (!description.endsWith('.')) {
        description += '...';
      }
    } else {
      // Fallback: hard truncate
      description = description.substring(0, 157) + '...';
    }
  }

  // Step 8: SEO classification-driven robots flags
  const classification = getPageClassification(canon);
  const robotsSettings = getRobotsForClassification(classification);

  return {
    title,
    description,
    keywords: [
      `${whopData.name} promo code`,
      `${whopData.name} discount`,
      `${whopData.name} coupon`,
      firstPromo?.value ? 
        (firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off') 
          ? firstPromo.value 
          : `${firstPromo.value}% off`)
        : 'exclusive access',
      whopData.category,
      price === 'Free' ? 'free' : 'premium',
      currentMonth,
      currentYear.toString()
    ].filter(Boolean).join(', '),
    alternates: {
      canonical: `https://whpcodes.com/whop/${canon}`,
      ...(isLocaleEnabled() && shouldIncludeInHreflang(classification) && {
        languages: (() => {
          const languages: Record<string, string> = {};
          for (const locale of LOCALES) {
            languages[locale] = whopAbsoluteUrl(canon, locale);
          }
          // x-default → default page for unmatched locales
          languages['x-default'] = whopAbsoluteUrl(canon, 'en');
          return languages;
        })()
      })
    },
    robots: {
      ...robotsSettings,
      googleBot: {
        ...robotsSettings,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: whopData.logo ? [
        {
          url: whopData.logo,
          alt: `${whopData.name} Logo`,
          width: 1200,
          height: 630,
        }
      ] : []
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: whopData.logo ? [whopData.logo] : []
    }
  };
  } catch (error) {
    console.error('[WHOP META] Error generating metadata:', error);
    // Return safe fallback metadata instead of crashing
    return {
      title: 'Whop',
      description: 'Discover exclusive whop promo codes and discounts.',
      robots: { index: false, follow: true }
    };
  }
}

export default async function WhopPage({ params, searchParams }: { params: { slug: string }, searchParams?: { debugOnly?: string; __debug?: string } }) {
  const raw = params.slug || '';
  const decoded = decodeURIComponent(raw);  // Decode before normalizing
  // Use lowercase decoded slug for DB lookup (DB stores literal colons, not %3a)
  const dbSlug = decoded.toLowerCase();
  const canonSlug = canonicalSlugForPath(decoded);

  // Phase 1 instrumentation: Log inputs
  dlog('whop', 'WhopPage params', { raw, decoded, dbSlug, canonSlug, searchParams });

  // Step 8: Determine SEO classification for this page
  const classification = getPageClassification(canonSlug);
  const shouldEmitSchema = classification === 'indexable';

  // Load view model for schema (reuse existing data path)
  let vm: WhopViewModel | null = null;
  try {
    // Safe: getWhopViewModel defaults to 'en' when feature flag is off
    vm = await getWhopViewModel(raw, undefined);
  } catch (error) {
    console.warn('Failed to load view model for schema:', error);
  }

  // 1) Try lookup with normalized slug for DB
  console.log('[WHOP DETAIL] Starting fetch for slug:', { raw, dbSlug, canonSlug });

  const dealData = await getDeal(dbSlug);
  console.log('[WHOP DETAIL] getDeal result:', { found: !!dealData, id: dealData?.id });

  // Use cached, tagged data (D1) - no fallback needed
  const finalWhopData = await getWhopBySlugCached(dbSlug, 'en');
  console.log('[WHOP DETAIL] Final data chosen:', {
    found: !!finalWhopData,
    name: finalWhopData?.name,
    indexingStatus: (finalWhopData as any)?.indexingStatus,
    retirement: (finalWhopData as any)?.retirement,
    promoCount: (finalWhopData as any)?.PromoCode?.length
  });

  // Load verification data for Screenshot B
  const verificationData = await getVerificationData(dbSlug);

  // Debug logging for production troubleshooting
  console.log('Verification data loaded for', dbSlug, ':', verificationData);

  // 3) 404 handling: Not found, retired, or not indexed
  if (!finalWhopData) {
    console.error('[WHOP DETAIL] 404 - No data found:', { raw, dbSlug, reason: 'finalWhopData is null/undefined' });
    if (process.env.SEO_DEBUG === '1') {
      return (
        <pre style={{ padding: 16 }}>
          {JSON.stringify({ raw, dbSlug, flags: null }, null, 2)}
        </pre>
      );
    }
    return notFoundWithReason('no_record_for_slug', { raw, decoded, dbSlug });
  }

  // 4) Relaxed quality check per ChatGPT fix - only block GONE pages
  // Accept both 'INDEXED' (production) and 'INDEX' (backup DB)
  const indexingStatus = String(finalWhopData.indexingStatus || '').toUpperCase();
  const isIndexable = ['INDEXED', 'INDEX'].includes(indexingStatus);
  const isGone = finalWhopData.retirement === 'GONE';

  // T3: Build trace array for future 404 debugging
  const trace: string[] = [];
  trace.push(`slug=${dbSlug}, id=${finalWhopData.id ?? 'null'}`);
  trace.push(`retired=${finalWhopData.retirement} indexing=${indexingStatus}`);

  console.log('[WHOP DETAIL] Quality check (relaxed):', {
    dbSlug,
    indexingStatus,
    isIndexable,
    retirement: finalWhopData.retirement,
    isGone,
    nodeEnv: process.env.NODE_ENV
  });

  // RELAXED: Only 404 for GONE pages in all environments
  // In development, allow all non-GONE pages (even if not indexed) to fix rec/alt 404s
  if (isGone) {
    trace.push('gate:retired_or_gone');
    console.log('[DBG:reasons:page]', new Date().toISOString(), trace);
    return notFoundWithReason('retired_or_gone', { raw, decoded, dbSlug, retirement: finalWhopData.retirement, isGone });
  }

  // Log successful render decision
  trace.push(`render:true (relaxed_gate)`);
  console.log('[DBG:reasons:page]', new Date().toISOString(), trace);

  // Soft warning in dev for non-indexed pages (but don't 404)
  if (process.env.NODE_ENV !== 'production' && !isIndexable) {
    dlog('reasons', 'indexingStatus not indexed - still rendering', { dbSlug, indexingStatus });
  }

  // 5) Handle redirects
  if (finalWhopData.retirement === 'REDIRECT' && finalWhopData.redirectToPath) {
    return permanentRedirect(finalWhopData.redirectToPath); // 308
  }


  // Fetch promo usage statistics server-side for SEO (SSR/SSG)
  const usageStats = await getPromoStatsForSlug(dbSlug);

  // Use verification data loaded from JSON files (not from database)
  const freshnessData = verificationData
    ? {
        whopUrl: String(verificationData.whopUrl || ''),
        lastUpdated: verificationData.lastUpdated ? new Date(verificationData.lastUpdated).toISOString() : new Date().toISOString(),
        ledger: (verificationData.ledger || []).map((row: any) => ({
          ...row,
          checkedAt: row?.checkedAt ? new Date(row.checkedAt).toISOString() : undefined,
          verifiedAt: row?.verifiedAt ? new Date(row.verifiedAt).toISOString() : undefined,
        })),
      }
    : null;

  // Transform raw Prisma data to match expected format
  const whopFormatted = {
    id: finalWhopData.id,
    name: finalWhopData.name,
    description: finalWhopData.description,
    logo: finalWhopData.logo,
    affiliateLink: finalWhopData.affiliateLink,
    website: finalWhopData.website || null,
    price: finalWhopData.price,
    category: finalWhopData.category || null,
    aboutContent: finalWhopData.aboutContent,
    howToRedeemContent: finalWhopData.howToRedeemContent,
    promoDetailsContent: finalWhopData.promoDetailsContent,
    featuresContent: finalWhopData.featuresContent,
    termsContent: finalWhopData.termsContent,
    faqContent: finalWhopData.faqContent,
    updatedAt: finalWhopData.updatedAt,
    createdAt: finalWhopData.createdAt,
    usageStats,
    freshnessData,
    promoCodes: (finalWhopData.PromoCode ?? []).map(code => ({
      id: code.id,
      title: code.title,
      description: code.description,
      code: code.code,
      type: code.type,
      value: code.value,
      createdAt: code.createdAt
    })),
    reviews: (finalWhopData.Review ?? []).map(review => ({
      id: review.id,
      author: review.author,
      content: review.content,
      rating: review.rating,
      createdAt: review.createdAt instanceof Date
        ? review.createdAt.toISOString()
        : String(review.createdAt),
      verified: review.verified
    }))
  };

  
  const firstPromo = whopFormatted.promoCodes[0] || null;
  const promoCode = firstPromo?.code || null;
  const promoTitle = "Exclusive Access"; // Always show "Exclusive Access" on detail pages

  // Helper function to check if whop has a promo code
  const hasPromoCode = (whopName: string): boolean => {
    // Now all promo codes are in database - if promoCode exists, we have a promo
    return promoCode !== null;
  };

  // Helper function to get discount percentage
  const getDiscountPercentage = (whopName: string): string => {
    // Now all promo codes are in database - use firstPromo.value directly
    return firstPromo?.value || '0';
  };

  // Create unique key for remounting when slug changes
  const pageKey = `whop-${params.slug}`;

  // Prepare fallback FAQ data for the collapsible component (used only if no database FAQ content)
  const fallbackFaqData = [
    {
      question: `How do I use the ${whopFormatted.name} promo code?`,
      answer: `To use the ${promoTitle} for ${whopFormatted.name}, simply click "Reveal Code" above to visit their website.${hasPromoCode(whopFormatted.name) ? ' Copy the promo code and enter it during checkout.' : ' The discount will be automatically applied when you purchase through our link.'}`
    },
    {
      question: `What type of product is ${whopFormatted.name}?`,
      answer: `${whopFormatted.name} is ${whopFormatted.category ? `in the ${whopFormatted.category.toLowerCase()} category and provides` : 'an exclusive platform that provides'} premium content and resources for its members. It's designed to help users achieve their goals through expert guidance and community support.`
    },
    {
      question: 'How long is this offer valid?',
      answer: `This exclusive offer for ${whopFormatted.name} is available for a limited time. We recommend claiming it as soon as possible as these deals can expire or change without notice.`
    }
  ];

  // Generate JSON-LD schema (Step 2: Primary entity + BreadcrumbList, Step 3: Offers, Step 4: FAQ + HowTo)
  // Step 8: Only emit schemas for indexable pages
  let jsonLdSchemas = [];
  if (vm && shouldEmitSchema) {
    try {
      const primary = buildPrimaryEntity(vm);
      const breadcrumbs = buildBreadcrumbList(vm);

      // Step 3: Attach offers to primary entity if price data is available
      const offers = buildOffers(vm);
      if (offers) {
        (primary as any).offers = offers;
      }

      // Step 6: Attach reviews to primary entity if review data is available
      const reviews = buildReviews(vm);
      if (reviews) {
        (primary as any).review = reviews;
      }

      // Step 4: Build FAQ and HowTo schemas (undefined if no data)
      const faqNode = buildFAQ(vm);     // undefined if no visible FAQ
      const howtoNode = buildHowTo(vm); // undefined if no real steps

      // Step 5: Build ItemList schemas for recommendations and alternatives
      const recommendedNode  = buildItemList('recommended',  vm.recommendedUrls, vm.url);
      const alternativesNode = buildItemList('alternatives', vm.alternativeUrls, vm.url);

      jsonLdSchemas = [primary, breadcrumbs, faqNode, howtoNode, recommendedNode, alternativesNode].filter(Boolean);

      // Log schema emission (one-line, prod-only)
      console.info('[schema-log-probe]', process.env.NODE_ENV, process.env.LOG_SCHEMA);
      if (process.env.NODE_ENV === 'production' && process.env.LOG_SCHEMA === '1') {
        const nodeLabels = jsonLdSchemas.map(n => {
          const t = (n as any)['@type'];
          if (t === 'ItemList') {
            const id = String((n as any)['@id'] || '');
            if (id.endsWith('#recommended')) return 'ItemList(reco)';
            if (id.endsWith('#alternatives')) return 'ItemList(alt)';
          }
          return Array.isArray(t) ? t[0] : t; // handle array @type defensively
        });

        // Single log line—easy to grep in Vercel logs
        console.log(JSON.stringify({
          tag: 'schema',
          slug: canonSlug,
          nodes: nodeLabels,
          ts: new Date().toISOString()
        }));
      }
    } catch (error) {
      console.warn('Failed to build JSON-LD schemas:', error);
    }
  }

  return (
    <main key={pageKey} className="min-h-screen py-12 pt-24 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      {/* HowTo Schema for SEO */}
      <HowToSchema
        slug={params.slug}
        brand={whopFormatted.name}
        currency={extractCurrency(whopFormatted.price)}
        hasTrial={hasTrial(whopFormatted.price)}
        siteOrigin="https://whpcodes.com"
      />

      {/* Step 2-4: Primary Entity + BreadcrumbList + Offers + FAQ + HowTo JSON-LD Schema */}
      {jsonLdSchemas.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={jsonLdScript(jsonLdSchemas)}
        />
      )}

      <div className="mx-auto w-[90%] md:w-[95%] max-w-6xl">
        {/* Main Content Container */}
        <div className="max-w-2xl mx-auto space-y-6 mb-8">
          {/* Hero Section */}
          <div className="rounded-xl px-7 py-6 sm:p-8 shadow-lg border transition-theme" style={{ background: 'linear-gradient(to bottom right, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col gap-4">
              {/* Whop Info */}
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="relative w-16 sm:w-20 h-16 sm:h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--background-color)' }}>
                  <WhopLogo whop={whopFormatted} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">{whopFormatted.name} Promo Code</h1>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--accent-color)' }}>
                    {promoTitle}
                  </p>
                  {whopFormatted.price && (
                    <div className="mt-3 flex flex-col md:flex-row md:items-center md:gap-3">
                      {/* Label */}
                      <span className="text-base font-medium text-gray-600 md:mr-2">
                        Price:
                      </span>

                      {/* Pill */}
                      <div className="mt-2 md:mt-0">
                        <div className="inline-flex items-center rounded-full bg-emerald-600 text-white px-4 py-2 md:px-3 md:py-1.5 shadow-sm">
                          {whopFormatted.price.includes('/') ? (
                            <>
                              {/* Amount */}
                              <span className="font-extrabold text-xl leading-none md:text-lg">
                                {whopFormatted.price.split('/')[0].trim()}
                              </span>
                              {/* Interval */}
                              <span className="ml-2 text-[15px] md:text-sm leading-none whitespace-nowrap opacity-95 font-medium">
                                / {whopFormatted.price.split('/')[1].trim()}
                              </span>
                            </>
                          ) : (
                            /* Single value like "Free" or "N/A" */
                            <span className="font-extrabold text-xl leading-none md:text-lg">
                              {whopFormatted.price}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Community Promo Codes Section */}
              <div className="mt-1">
                <hr className="mb-4" style={{ borderColor: 'var(--border-color)', borderWidth: '1px', opacity: 0.3 }} />
                <CommunityPromoSection
                  key={`community-${whopFormatted.id}-${whopFormatted.promoCodes?.length || 0}`}
                  whop={{
                    id: whopFormatted.id,
                    name: whopFormatted.name,
                    affiliateLink: whopFormatted.affiliateLink
                  }}
                  promoCodes={whopFormatted.promoCodes || []}
                  slug={params.slug}
                />
              </div>

              {/* Promo Code Submission Button */}
              <div className="mt-6">
                <PromoCodeSubmissionButton
                  whopId={whopFormatted.id}
                  whopName={whopFormatted.name}
                />
              </div>
            </div>
          </div>

          {/* Code Usage Statistics - Server Rendered (immediately after Reveal Code) */}
          <ServerSectionGuard label="PromoUsageStats">
            <PromoStatsDisplay
              whopId={whopFormatted.id}
              slug={params.slug}
              initialStats={whopFormatted.usageStats}
            />
          </ServerSectionGuard>

          {/* Verification Status - Server Rendered (separate section) */}
          <ServerSectionGuard label="VerificationStatus">
            {whopFormatted.freshnessData && (
              <VerificationStatus freshnessData={whopFormatted.freshnessData} />
            )}
          </ServerSectionGuard>

          {/* Product Details for Each Promo Code */}
          {whopFormatted.promoCodes.map((promo, globalIndex) => {
            // Calculate the promo number based on whether it's community or original
            const isCommunity = promo.id.startsWith('community_');
            const communityCount = whopFormatted.promoCodes.filter(p => p.id.startsWith('community_')).length;

            let promoNumber;
            if (isCommunity) {
              // Community codes get numbers 1, 2, 3... based on their position in community codes
              const communityIndex = whopFormatted.promoCodes.filter(p => p.id.startsWith('community_')).indexOf(promo);
              promoNumber = communityIndex + 1;
            } else {
              // Original codes continue numbering after community codes
              const originalIndex = whopFormatted.promoCodes.filter(p => !p.id.startsWith('community_')).indexOf(promo);
              promoNumber = communityCount + originalIndex + 1;
            }

            return (
              <section key={promo.id} className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-3 mb-4">
                  <h2 className="text-xl sm:text-2xl font-bold">Product Details #{promoNumber}</h2>
                  <span className="text-sm px-2 py-1 rounded"
                        style={{
                          backgroundColor: isCommunity ? 'var(--accent-color)' : 'var(--background-color)',
                          color: isCommunity ? 'white' : 'var(--text-color)',
                          border: !isCommunity ? '1px solid var(--border-color)' : 'none'
                        }}>
                    {isCommunity ? 'Community' : 'Original'}
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg">
                  <table className="min-w-full">
                    <tbody>
                      {promo.value && promo.value !== '0' && (
                        <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>Discount Value</td>
                          <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                            {(() => {
                              const discount = promo.value;
                              // If discount already contains $, %, or 'off', return as-is
                              if (discount.includes('$') || discount.includes('%') || discount.includes('off')) {
                                return discount;
                              }
                              // Otherwise add % symbol for percentage discounts
                              return `${discount}%`;
                            })()}
                          </td>
                        </tr>
                      )}
                      {whopFormatted.price && (
                        <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>Price</td>
                          <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                            <span style={{
                              color: whopFormatted.price === 'Free' ? 'var(--success-color)' :
                                     whopFormatted.price === 'N/A' ? 'var(--text-secondary)' : 'var(--text-color)',
                              fontWeight: whopFormatted.price === 'Free' ? 'bold' : 'normal'
                            }}>
                              {whopFormatted.price}
                            </span>
                          </td>
                        </tr>
                      )}
                      {whopFormatted.category && (
                        <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                          <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>Category</td>
                          <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>{whopFormatted.category}</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            );
          })}

          {/* How to Redeem Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">How to Redeem</h2>
            {isMeaningful(whopFormatted.howToRedeemContent) ? (
              <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {looksLikeHtml(whopFormatted.howToRedeemContent!) ? (
                  <div 
                    className="prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                    dangerouslySetInnerHTML={{ __html: whopFormatted.howToRedeemContent! }}
                  />
                ) : (
                  <RenderPlain text={whopFormatted.howToRedeemContent!} />
                )}
              </div>
            ) : (
              <ol className="space-y-2 text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">1.</span>
                  <span>Click &quot;Reveal Code&quot; above to visit {whopFormatted.name} and get your exclusive offer</span>
                </li>
                {hasPromoCode(whopFormatted.name) ? (
                  <li className="flex items-start">
                    <span className="mr-2 font-semibold">2.</span>
                    <span>Copy the revealed promo code and enter it during checkout</span>
                  </li>
                ) : (
                  <li className="flex items-start">
                    <span className="mr-2 font-semibold">2.</span>
                    <span>No code needed - the discount will be automatically applied</span>
                  </li>
                )}
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">3.</span>
                  <span>Complete your purchase to access the exclusive content</span>
                </li>
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">4.</span>
                  <span>Enjoy your {promoTitle} and start learning!</span>
                </li>
              </ol>
            )}
          </section>

          {/* How To Section - Screenshots and SEO */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <HowToSection
              slug={params.slug}
              brand={whopFormatted.name}
              currency={extractCurrency(whopFormatted.price)}
              hasTrial={hasTrial(whopFormatted.price)}
              lastTestedISO={verificationData?.best?.computedAt ?? null}
              beforeCents={verificationData?.best?.beforeCents ?? null}
              afterCents={verificationData?.best?.afterCents ?? null}
            />
          </section>


          {/* About Section - Smart fallback: aboutContent first, then description */}
          {(() => {
            const aboutVal =
              isMeaningful(whopFormatted.aboutContent) ? whopFormatted.aboutContent
              : (isMeaningful(whopFormatted.description) ? whopFormatted.description : null);
            
            return aboutVal && (
              <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                <h2 className="text-xl sm:text-2xl font-bold mb-4">About {whopFormatted.name}</h2>
                <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  {looksLikeHtml(aboutVal) ? (
                    <div 
                      className="prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                      dangerouslySetInnerHTML={{ __html: aboutVal }}
                    />
                  ) : (
                    <RenderPlain text={aboutVal} />
                  )}
                </div>
              </section>
            );
          })()}

          {/* Promo Details Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Promo Details</h2>
            {isMeaningful(whopFormatted.promoDetailsContent) ? (
              <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {looksLikeHtml(whopFormatted.promoDetailsContent!) ? (
                  <div 
                    className="prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                    dangerouslySetInnerHTML={{ __html: whopFormatted.promoDetailsContent! }}
                  />
                ) : (
                  <RenderPlain text={whopFormatted.promoDetailsContent!} />
                )}
              </div>
            ) : (
              <>
                <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'var(--background-color)' }}>
                  <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--accent-color)' }}>{promoTitle}</h3>
                  <p className="text-base sm:text-lg leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                    Get exclusive access and special discounts with our promo code.
                  </p>
                </div>
                
                {/* Promo Type Badge */}
                <div className="flex flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--background-color)', color: 'var(--accent-color)' }}>
                    {firstPromo?.type?.replace('_', ' ').toUpperCase() || 'DISCOUNT'} OFFER
                  </span>
                </div>
              </>
            )}
          </section>

          {/* Terms & Conditions */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Terms & Conditions</h2>
            {isMeaningful(whopFormatted.termsContent) ? (
              <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {looksLikeHtml(whopFormatted.termsContent!) ? (
                  <div 
                    className="prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                    dangerouslySetInnerHTML={{ __html: whopFormatted.termsContent! }}
                  />
                ) : (
                  <RenderPlain text={whopFormatted.termsContent!} />
                )}
              </div>
            ) : (
              <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                This exclusive offer for {whopFormatted.name} is available through our partnership.
                {hasPromoCode(whopFormatted.name) ? ' Use the promo code during checkout to get your discount.' : ' The discount will be automatically applied when you click through our link.'}
                {' '}Terms and conditions apply as set by {whopFormatted.name}. Offer subject to availability and may be modified or discontinued at any time.
              </p>
            )}
          </section>

          {/* FAQ Section - Server Rendered with native details/summary */}
          <FAQSectionServer
            faqContent={whopFormatted.faqContent}
            faqs={fallbackFaqData}
            whopName={whopFormatted.name}
          />

          {/* Features Section - Only render if database content exists */}
          {isMeaningful(whopFormatted.featuresContent) && (
            <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
              <h2 className="text-xl sm:text-2xl font-bold mb-4">Features</h2>
              <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                {looksLikeHtml(whopFormatted.featuresContent!) ? (
                  <div 
                    className="prose prose-sm max-w-none whitespace-break-spaces prose-headings:text-current prose-p:text-current prose-ul:text-current prose-ol:text-current prose-li:text-current prose-strong:text-current prose-em:text-current prose-a:text-blue-600 hover:prose-a:text-blue-700"
                    dangerouslySetInnerHTML={{ __html: whopFormatted.featuresContent! }}
                  />
                ) : (
                  <RenderPlain text={whopFormatted.featuresContent!} />
                )}
              </div>
            </section>
          )}
        </div>

        {/* Full-width sections for better layout */}
        <div className="w-full space-y-8">
          {/* Recommended Whops Section - Server-rendered for JS-off compatibility */}
          <div className="max-w-2xl mx-auto">
            <RecommendedSection currentWhopSlug={dbSlug} />
          </div>

          {/* Alternatives Section - Server-rendered for JS-off compatibility */}
          <div className="max-w-2xl mx-auto">
            {/* @ts-expect-error Async Server Component */}
            <AlternativesSection currentWhopSlug={dbSlug} />
          </div>

          {/* Reviews Section - Streamed for better performance */}
          <div className="max-w-2xl mx-auto">
            <Suspense fallback={<SectionSkeleton />}>
              <ReviewsSection 
                whopId={whopFormatted.id}
                whopName={whopFormatted.name}
                reviews={whopFormatted.reviews || []}
              />
            </Suspense>
          </div>

          {/* Back Link */}
          <div className="max-w-2xl mx-auto">
            <a href="/" className="hover:opacity-80 flex items-center gap-2 px-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to All Offers
            </a>
          </div>
        </div>
      </div>

      {/* Hydration Debug Tripwire - only active when NEXT_PUBLIC_HYDRATION_DEBUG=1 */}
      {process.env.NEXT_PUBLIC_HYDRATION_DEBUG === '1' && <HydrationTripwire />}
    </main>
  );
} 