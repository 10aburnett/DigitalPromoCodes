// src/app/(public)/whop/[slug]/vm.ts
// IMPORTANT: This function reuses existing data paths and includes DB access for SSR.
// This is acceptable since this is view-model mapping, not schema generation.
import 'server-only';
import { absoluteUrl, whopAbsoluteUrl } from '@/lib/urls';
import { getSchemaLocale } from '@/lib/schema-locale';
import type { WhopViewModel } from '@/lib/buildSchema';
import { getWhopBySlug } from '@/lib/data';
import { prisma } from '@/lib/prisma';
import { canonicalSlugForDB, canonicalSlugForPath } from '@/lib/slug-utils';
import { parseFaqContent } from '@/lib/faq-types';
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';

// Safe locale support - maintains existing behavior when feature flag is off
export async function getWhopViewModel(slug: string, localeParam?: string): Promise<WhopViewModel> {
  const locale = getSchemaLocale(localeParam); // Safe: returns 'en' when flag is off
  // Use lowercase decoded slug for DB lookup (DB stores literal colons, not %3a)
  const decoded = decodeURIComponent(slug);
  const dbSlug = decoded.toLowerCase();

  // Reuse the same data path as the existing page component
  const whopData = await getWhopBySlug(dbSlug, 'en');

  // Fallback fetch (same as existing page logic)
  const whopDbRecord = !whopData
    ? await prisma.deal.findUnique({
        where: { slug: dbSlug },
        include: { PromoCode: true, Review: true },
      })
    : null;

  // Choose final data (same as existing page logic)
  const finalWhopData = whopData || whopDbRecord;

  if (!finalWhopData) {
    throw new Error(`Whop not found: ${slug}`);
  }

  // Transform raw Prisma data to match expected format (same as existing page)
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

  // Decide primary type based on category or fields already exposed to UI
  const primaryType = determinePrimaryType(whopFormatted.category);

  const canonSlug = canonicalSlugForPath(slug);
  const url = whopAbsoluteUrl(canonSlug, locale); // Safe: uses non-locale path when flag is off

  // Extract images from logo
  const images = [whopFormatted.logo].filter(Boolean).map(String);

  // Calculate rating values if reviews exist
  const reviews = whopFormatted.reviews || [];
  const ratingValue = reviews.length > 0
    ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
    : null;
  const reviewCount = reviews.length > 0 ? reviews.length : null;

  // Build breadcrumbs matching visible UI
  const breadcrumbs = buildBreadcrumbs(whopFormatted.category, whopFormatted.name, url);

  // Extract price information from existing UI data
  const priceStr = whopFormatted.price;
  let price: number | null = null;
  let promoPrice: number | null = null;
  let currency: string | null = null;

  // Parse price string to extract numeric value and currency
  if (priceStr && priceStr !== 'N/A' && priceStr !== 'Free') {
    // Extract currency from price string (e.g., "$99/month" -> USD, "£49" -> GBP)
    if (priceStr.includes('$')) {
      currency = 'USD';
    } else if (priceStr.includes('£')) {
      currency = 'GBP';
    } else if (priceStr.includes('€')) {
      currency = 'EUR';
    } else {
      currency = 'USD'; // Default fallback
    }

    // Extract numeric price (handle formats like "$99", "$99/month", "£49.99")
    const priceMatch = priceStr.match(/[\d,]+\.?\d*/);
    if (priceMatch) {
      const numStr = priceMatch[0].replace(',', '');
      const parsedPrice = parseFloat(numStr);
      if (!isNaN(parsedPrice)) {
        price = parsedPrice;

        // Check if there's a promo discount from the first promo code
        const firstPromo = whopFormatted.promoCodes?.[0];
        if (firstPromo?.value && firstPromo.value !== '0') {
          const discount = parseFloat(firstPromo.value);
          if (!isNaN(discount)) {
            // Calculate promo price (assuming percentage discount)
            if (firstPromo.value.includes('%') || !firstPromo.value.includes('$')) {
              promoPrice = price * (1 - discount / 100);
            } else {
              // Fixed discount amount
              promoPrice = price - discount;
            }
            if (promoPrice < 0) promoPrice = 0;
          }
        }
      }
    }
  } else if (priceStr === 'Free') {
    price = 0;
    currency = 'USD';
  }

  // Step 4: Map FAQ data (exact UI parity)
  let faqData: Array<{ question: string; answer: string }> | undefined = undefined;
  if (whopFormatted.faqContent) {
    const parsedFaq = parseFaqContent(whopFormatted.faqContent);
    if (Array.isArray(parsedFaq)) {
      // Convert from FaqItem[] to our schema format
      faqData = parsedFaq.map(item => ({
        question: item.question,
        answer: item.answerHtml // Note: despite name, this contains plain text after parsing
      }));
    }
    // If parsedFaq is a string (legacy format), we skip FAQ schema (no structured data)
  }

  // Step 4: Map HowTo steps (only if real steps are shown)
  let howToSteps: Array<{ title: string; text: string }> | undefined = undefined;
  if (whopFormatted.howToRedeemContent) {
    // Only include if content looks like actual steps (contains numbers, lists, or step indicators)
    const content = whopFormatted.howToRedeemContent.toLowerCase();
    const hasStepIndicators = /\b(step|1\.|2\.|3\.|first|second|third|then|next|finally|\n\d+\.|\n•|\n-)/i.test(content);

    if (hasStepIndicators && whopFormatted.howToRedeemContent.length > 50) {
      // Parse basic step structure - this is a simple implementation
      // In a real scenario, you might want more sophisticated parsing
      const lines = whopFormatted.howToRedeemContent.split('\n').filter(line => line.trim());
      const steps: Array<{ title: string; text: string }> = [];

      let currentStep = 1;
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.length > 10) { // Ignore very short lines
          steps.push({
            title: `Step ${currentStep}`,
            text: trimmed.replace(/<[^>]*>/g, '').trim() // Strip HTML tags
          });
          currentStep++;
          if (currentStep > 6) break; // Limit to 6 steps max
        }
      }

      if (steps.length >= 2) { // Only include if we have at least 2 meaningful steps
        howToSteps = steps;
      }
    }
  }

  // Step 5: Map recommendations and alternatives from graph data (no new DB queries)
  const toAbs = (s: string) => absoluteUrl(`/whop/${s}`);
  let recommendedUrls: string[] = [];
  let alternativeUrls: string[] = [];

  try {
    const neighbors = await loadNeighbors();
    const canonicalSlug = canonicalSlugForPath(slug);

    // Get recommended slugs and convert to absolute URLs (order must match UI)
    const rawRecSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
    recommendedUrls = rawRecSlugs.filter(Boolean).map(toAbs);

    // Get alternative slugs and convert to absolute URLs (order must match UI)
    const rawAltSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'alternatives');
    alternativeUrls = rawAltSlugs.filter(Boolean).map(toAbs);
  } catch (error) {
    // Graceful fallback - empty arrays if graph loading fails
    console.warn('Failed to load graph data for recommendations/alternatives:', error);
  }

  return {
    slug: canonSlug,
    url,
    inLanguage: locale, // Safe: returns 'en' when feature flag is off
    name: whopFormatted.name,
    description: whopFormatted.description ?? null,
    images,
    brand: whopFormatted.name, // Use whop name as brand

    // Commerce mapping (must mirror UI)
    price: price,
    promoPrice: promoPrice,
    currency: currency,
    promoValidUntil: null, // Not displayed in current UI
    availability: 'InStock', // Default for digital products
    availabilityStarts: null, // Not applicable for current whops
    priceNote: null, // Not currently shown in UI

    ratingValue: ratingValue && ratingValue > 0 ? ratingValue : null,
    reviewCount: reviewCount && reviewCount > 0 ? reviewCount : null,
    category: whopFormatted.category ?? null,
    breadcrumbs,
    primaryType,

    // Step 4: FAQ and HowTo (only if visible/structured data exists)
    faq: faqData,
    steps: howToSteps,

    // Step 5: Internal linking (absolute URLs, ordered exactly like UI)
    recommendedUrls,
    alternativeUrls,

    // Step 6: Individual reviews (only when rendered on the page; mirror exactly)
    reviews: reviews.length > 0 ? reviews.slice(0, 5).map((r: any) => ({
      authorName: r.author,                         // exactly as shown
      ratingValue: r.rating,                        // numeric value as shown
      body: r.content,                              // visible review text (plain)
      datePublishedISO: r.createdAt,                // ISO 8601 date
      url: undefined                                // no permalink shown currently
    })) : undefined
  };
}

function determinePrimaryType(category: string | null): 'Product' | 'Course' | 'SoftwareApplication' | 'Service' {
  if (!category) return 'Product';

  const categoryLower = category.toLowerCase();

  // Map categories to schema types based on existing data patterns
  if (categoryLower.includes('course') ||
      categoryLower.includes('education') ||
      categoryLower.includes('academy') ||
      categoryLower.includes('training') ||
      categoryLower.includes('learning')) {
    return 'Course';
  }

  if (categoryLower.includes('software') ||
      categoryLower.includes('tool') ||
      categoryLower.includes('app') ||
      categoryLower.includes('automation') ||
      categoryLower.includes('bot')) {
    return 'SoftwareApplication';
  }

  if (categoryLower.includes('service') ||
      categoryLower.includes('consulting') ||
      categoryLower.includes('management') ||
      categoryLower.includes('coaching') ||
      categoryLower.includes('mentorship')) {
    return 'Service';
  }

  // Default to Product for everything else
  return 'Product';
}

function buildBreadcrumbs(category: string | null, name: string, url: string) {
  const crumbs = [
    { name: 'Home', url: absoluteUrl('/') }
  ];

  if (category) {
    // Create category URL - this should match your existing category URL structure
    const categorySlug = category.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    crumbs.push({
      name: category,
      url: absoluteUrl(`/category/${categorySlug}`)
    });
  }

  crumbs.push({
    name: name,
    url: url
  });

  return crumbs;
}