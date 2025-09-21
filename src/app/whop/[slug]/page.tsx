import { notFound, permanentRedirect } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { normalizeImagePath } from '@/lib/image-utils';
import { unstable_noStore as noStore } from 'next/cache';
import { getWhopBySlug } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import { Suspense } from 'react';
import { canonicalSlugForDB, canonicalSlugForPath } from '@/lib/slug-utils';
import { headers } from "next/headers";

// Force dynamic rendering for content management testing
export const dynamic = 'force-dynamic';
export const revalidate = 0;
export const dynamicParams = true;
export const runtime = 'nodejs'; // required for Prisma database access

import InitialsAvatar from '@/components/InitialsAvatar';
import WhopLogo from '@/components/WhopLogo';
import WhopReviewSection from '@/components/WhopReviewSection';
import RecommendedWhops from '@/components/RecommendedWhops';
import FAQSection from '@/components/FAQSection';
import WhopPageInteractive, { WhopPageCompactStats } from '@/components/WhopPageInteractive';
import PromoCodeSubmissionButton from '@/components/PromoCodeSubmissionButton';
import CommunityPromoSection from '@/components/CommunityPromoSection';
import { parseFaqContent } from '@/lib/faq-types';
import RenderPlain from '@/components/RenderPlain';
import { looksLikeHtml, isMeaningful, escapeHtml, toPlainText } from '@/lib/textRender';
import WhopFreshness from '@/components/WhopFreshness';
import HowToSection from '@/components/whop/HowToSection';
import HowToSchema from '@/components/whop/HowToSchema';



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
  // Prefer explicit env if you've set it (e.g. https://whpcodes.com)
  const explicit = process.env.NEXT_PUBLIC_SITE_ORIGIN || process.env.NEXT_PUBLIC_BASE_URL;
  if (explicit) return explicit.replace(/\/+$/, "");

  // Derive from the incoming request (SSR-safe)
  const h = headers();
  const proto = h.get("x-forwarded-proto") || "http";
  const host  = h.get("x-forwarded-host") || h.get("host");
  if (host) return `${proto}://${host}`;

  // Dev fallback
  return `http://localhost:${process.env.PORT ?? 3000}`;
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

    if (!res.ok) return null;

    const raw = await res.json();

    // normalize to { best: { beforeCents, afterCents, computedAt, currency } }
    const candidate = raw?.best ?? {
      beforeCents: raw?.beforeCents ?? null,
      afterCents:  raw?.afterCents  ?? null,
      computedAt:  raw?.computedAt ?? raw?.lastUpdated ?? null,
      currency:    raw?.currency ?? null,
    };

    if (candidate.beforeCents == null && candidate.afterCents == null) return null;
    return { best: candidate };
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
async function RecommendedSection({ currentWhopId }: { currentWhopId: string }) {
  // Simulate a small delay to show streaming effect in development
  await new Promise(resolve => setTimeout(resolve, 100));
  
  return <RecommendedWhops currentWhopId={currentWhopId} />;
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
  noStore();
  const canon = canonicalSlugForPath(params.slug ?? '');
  const dbSlug = canonicalSlugForDB(params.slug ?? '');
  const whopData = await getWhopBySlug(dbSlug, 'en');
  
  if (!whopData) {
    return {
      title: 'Whop Not Found',
      description: 'The requested whop could not be found.'
    };
  }

  // Check if whop is retired - return basic metadata for 410 pages
  if (whopData.retired) {
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

  // DB-driven robots flags (do not remove any existing metadata fields)
  const flags = await prisma.whop.findFirst({
    where: { slug: dbSlug }, // If you also have locale, add: , locale: params.locale
    select: { indexingStatus: true, retirement: true },
  });
  const shouldIndex =
    !!flags &&
    flags.indexingStatus === 'INDEX' &&
    flags.retirement === 'NONE';

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
      canonical: `https://whpcodes.com/whop/${canon}`
    },
    robots: {
      index: shouldIndex,
      follow: true,
      googleBot: {
        index: shouldIndex,
        follow: true,
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
}

export default async function WhopPage({ params }: { params: { slug: string } }) {
  const raw = params.slug || '';
  const dbSlug = canonicalSlugForDB(raw);

  // Debug logging to verify slug normalization
  console.log('whop slug raw/db:', raw, dbSlug);

  // 1) Try lookup with normalized slug for DB
  const dealData = await getDeal(dbSlug);

  let whopData;
  if (dealData && dealData.id) {
    whopData = await getWhopBySlug(dbSlug, 'en');
  } else {
    whopData = await getWhopBySlug(dbSlug, 'en');
  }

  // 1) Fallback fetch (unified shape) — still from `whop`
  const whopDbRecord =
    !whopData
      ? await prisma.whop.findUnique({
          where: { slug: dbSlug },
          include: { PromoCode: true, Review: true },
        })
      : null;

  // 2) Choose final data (helper result or fallback)
  const finalWhopData = whopData || whopDbRecord;

  // Load verification data for Screenshot B
  const verificationData = await getVerificationData(dbSlug);

  // Debug logging for production troubleshooting
  console.log('Verification data loaded for', dbSlug, ':', verificationData);

  // 3) If nothing, debug or 404 (prevents blank page)
  if (!finalWhopData) {
    if (process.env.SEO_DEBUG === '1') {
      return (
        <pre style={{ padding: 16 }}>
          {JSON.stringify({ raw, dbSlug, flags: null }, null, 2)}
        </pre>
      );
    }
    return notFound();
  }

  // 4) Fetch DB-driven flags ONCE (canonical table)
  const flags = await prisma.whop.findFirst({
    where: { slug: dbSlug },
    select: { indexingStatus: true, retirement: true, redirectToPath: true },
  });

  // 5) Respect retirements
  if (flags?.retirement === 'REDIRECT' && flags.redirectToPath) {
    return permanentRedirect(flags.redirectToPath); // 308
  }
  if (flags?.retirement === 'GONE') {
    return notFound(); // middleware serves exact 410
  }


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
      createdAt: review.createdAt.toISOString(),
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

  // Create unique key for remounting when slug changes - add timestamp for cache busting
  const pageKey = `whop-${params.slug}-${Date.now()}`;

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
                  key={`community-${whopFormatted.id}-${whopFormatted.promoCodes?.length || 0}-${Date.now()}`}
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

          {/* Freshness/Verification Section */}
          <WhopFreshness slug={params.slug} />

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
                  <span>Click "Reveal Code" above to visit {whopFormatted.name} and get your exclusive offer</span>
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
                  
                  {/* Compact usage stats */}
                  {firstPromo && (
                    <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                      <WhopPageCompactStats 
                        whopId={whopFormatted.id}
                        promoCodeId={firstPromo.id}
                        slug={params.slug}
                      />
                    </div>
                  )}
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

          {/* FAQ Section - Enhanced with structured FAQ support */}
          <FAQSection 
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
          {/* Recommended Whops Section - Streamed for better performance */}
          <div className="max-w-2xl mx-auto">
            <Suspense fallback={<SectionSkeleton />}>
              <RecommendedSection currentWhopId={whopFormatted.id} />
            </Suspense>
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
            <Link href="/" className="hover:opacity-80 flex items-center gap-2 px-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to All Offers
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
} 