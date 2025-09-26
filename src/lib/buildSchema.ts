// src/lib/buildSchema.ts
// NOTE: never import DB here; accepts only plain objects from page/layout.
import 'server-only';
import { absoluteUrl } from '@/lib/urls';

export type WhopViewModel = {
  // identity
  slug: string;
  url: string;                   // absolute canonical for this locale page
  inLanguage?: string;           // e.g., 'en', 'de'

  // display fields
  name: string;
  description?: string | null;
  images?: string[];             // absolute URLs, 0..3 items recommended
  brand?: string | { name: string; url?: string }; // visible provider label

  // commerce (must be visible on page to include)
  price?: number | null;        // regular price shown in UI (if shown)
  promoPrice?: number | null;   // promo price shown in UI (if shown)
  currency?: string | null;     // ISO 4217 (e.g., 'USD','GBP','EUR')

  // Promo window (only if UI shows it)
  promoValidUntil?: string | null;    // ISO 8601 date, if the promo is time-boxed and shown

  // Availability (from reliable signal per your rule)
  availability?: 'InStock' | 'OutOfStock' | 'PreOrder' | null;
  availabilityStarts?: string | null; // ISO 8601 start date if PreOrder and shown

  // Renewal note (visible text, if you disclose renewal impact)
  priceNote?: string | null; // e.g., "Intro price first month; renews at £39"

  // ratings (only when visibly rendered AND > 0)
  ratingValue?: number | null;
  reviewCount?: number | null;

  // IA
  category?: string | null;      // visible category name
  breadcrumbs?: Array<{ name: string; url: string }>; // absolute URLs in visible order

  // Primary type hint (optional; else choose Product)
  primaryType?: 'Product' | 'Course' | 'SoftwareApplication' | 'Service';

  // FAQs: must be exactly what the UI renders (same order & punctuation)
  faq?: Array<{ question: string; answer: string }>;

  // HowTo: only if UI shows genuine steps (redemption flow etc.)
  steps?: Array<{ title: string; text: string }>;

  // Internal linking (absolute URLs, ordered exactly like UI)
  recommendedUrls?: string[];   // absolute URLs, ordered exactly like UI
  alternativeUrls?: string[];   // absolute URLs, ordered exactly like UI
};

function brandNode(brand: WhopViewModel['brand']) {
  if (!brand) return undefined;
  if (typeof brand === 'string') return brand;
  if (brand.name) {
    const node: any = { "@type": "Organization", name: brand.name };
    if (brand.url) node.url = brand.url;
    return node;
  }
  return undefined;
}

export function buildPrimaryEntity(vm: WhopViewModel) {
  const type = vm.primaryType ?? 'Product'; // default
  const idSuffix =
    type === 'Product' ? 'product'
    : type === 'Course' ? 'course'
    : type === 'SoftwareApplication' ? 'software'
    : 'service';

  const entity: any = {
    "@context": "https://schema.org",
    "@type": type,
    "@id": `${vm.url}#${idSuffix}`,
    url: vm.url,
    name: vm.name,
  };

  if (vm.description) entity.description = vm.description;
  if (vm.inLanguage) entity.inLanguage = vm.inLanguage;

  // images: filter truthy & dedupe; limit to 3
  const imgs = (vm.images ?? []).filter(Boolean);
  if (imgs.length) entity.image = imgs.slice(0, 3);

  const brand = brandNode(vm.brand);
  if (brand) entity.brand = brand;

  // Ratings: only if both > 0 and visibly rendered
  if (vm.reviewCount && vm.reviewCount > 0 && vm.ratingValue && vm.ratingValue > 0) {
    entity.aggregateRating = {
      "@type": "AggregateRating",
      ratingValue: Number(vm.ratingValue).toFixed(1),
      reviewCount: vm.reviewCount
    };
  }

  // Offers block is handled in Step 3; DO NOT add here.
  return entity;
}

export function buildBreadcrumbList(vm: WhopViewModel) {
  const crumbs = vm.breadcrumbs && vm.breadcrumbs.length
    ? vm.breadcrumbs
    : [
        { name: 'Home', url: absoluteUrl('/') },
        ...(vm.category
          ? [{ name: vm.category, url: absoluteUrl(`/category/${encodeURIComponent(vm.category.toLowerCase().replace(/\s+/g, '-'))}`) }]
          : []),
        { name: vm.name, url: vm.url }
      ];

  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: c.url
    }))
  };
}

export function buildOffers(vm: WhopViewModel) {
  const offers: any[] = [];

  // Guard: need currency + at least one visible price
  const hasRegular = vm.price != null && vm.currency;
  const hasPromo   = vm.promoPrice != null && vm.currency;

  if (!hasRegular && !hasPromo) return undefined;

  // Helper to stringify price
  const money = (n: number) => String(n);

  // Regular price (only if UI shows it)
  if (hasRegular) {
    const regular: any = {
      "@type": "Offer",
      url: vm.url,                       // absolute URL to this page
      price: money(vm.price as number),
      priceCurrency: vm.currency,
    };
    // Availability: only if reliable & shown
    if (vm.availability) {
      regular.availability = `https://schema.org/${vm.availability}`;
      if (vm.availability === 'PreOrder' && vm.availabilityStarts) {
        regular.availabilityStarts = vm.availabilityStarts;
      }
    }
    // Optional: renewal/price note if visibly disclosed
    if (vm.priceNote) {
      regular.description = vm.priceNote;
    }
    offers.push(regular);
  }

  // Promo price (only if UI shows it)
  if (hasPromo) {
    const promo: any = {
      "@type": "Offer",
      url: vm.url,
      price: money(vm.promoPrice as number),
      priceCurrency: vm.currency,
    };
    // Availability mirrors the same logic
    if (vm.availability) {
      promo.availability = `https://schema.org/${vm.availability}`;
      if (vm.availability === 'PreOrder' && vm.availabilityStarts) {
        promo.availabilityStarts = vm.availabilityStarts;
      }
    }
    // If a real, visible end date exists, include it
    if (vm.promoValidUntil) {
      promo.priceValidUntil = vm.promoValidUntil;
    }
    if (vm.priceNote) {
      promo.description = vm.priceNote;
    }
    offers.push(promo);
  }

  // If we added nothing, return undefined
  return offers.length ? offers : undefined;
}

// Normalize to plain text (keep links as plaintext). We assume inputs are already plain,
// but this is a defensive cleanup if UI strings include simple markup.
function toPlain(x?: string | null) {
  if (!x) return undefined;
  // very light strip: remove basic HTML tags if any slipped in
  return x.replace(/<[^>]*>/g, '').trim();
}

export function buildFAQ(vm: WhopViewModel) {
  const qa = vm.faq?.filter(q => q?.question && q?.answer).map(q => ({
    "@type": "Question",
    name: toPlain(q.question),
    acceptedAnswer: { "@type": "Answer", text: toPlain(q.answer) }
  }));

  if (!qa || qa.length === 0) return undefined;

  const node: any = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${vm.url}#faq`,
    mainEntity: qa
  };
  if (vm.inLanguage) node.inLanguage = vm.inLanguage;
  return node;
}

export function buildHowTo(vm: WhopViewModel) {
  const steps = vm.steps?.filter(s => s?.title || s?.text).map((s, i) => ({
    "@type": "HowToStep",
    position: i + 1,
    name: toPlain(s.title) ?? `Step ${i + 1}`,
    text: toPlain(s.text) ?? undefined
  }));

  if (!steps || steps.length === 0) return undefined;

  const node: any = {
    "@context": "https://schema.org",
    "@type": "HowTo",
    "@id": `${vm.url}#howto`,
    name: `How to redeem ${toPlain(vm.name)}`,
    step: steps
  };
  if (vm.inLanguage) node.inLanguage = vm.inLanguage;
  return node;
}

function uniqPreserveOrder<T>(xs: T[]) {
  const seen = new Set<string>();
  return xs.filter((x: any) => {
    const key = typeof x === 'string' ? x : JSON.stringify(x);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrls(urls?: string[], selfUrl?: string) {
  if (!urls) return [];
  const cleaned = urls
    .filter(Boolean)
    .map(u => String(u).trim())
    .filter(u => /^https?:\/\//i.test(u));        // absolute only
  const deduped = uniqPreserveOrder(cleaned);
  return selfUrl ? deduped.filter(u => u !== selfUrl) : deduped;
}

export function buildItemList(
  idSuffix: 'recommended' | 'alternatives',
  urls: string[] | undefined,
  selfUrl: string
) {
  const list = normalizeUrls(urls, selfUrl);
  if (!list.length) return undefined;

  return {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "@id": `${selfUrl}#${idSuffix}`,
    "name": idSuffix === 'recommended' ? "Recommended for You" : "You might also consider…",
    "itemListElement": list.map((u, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "url": u
    }))
  };
}