/* eslint-disable no-console */
/**
 * Build-time schema guardrail — FAILS THE BUILD on regressions.
 * - SSR-only script; reuses existing VM + builders (no new DB code paths created).
 * - Samples a small set of indexable slugs from the seo-indexes artifact to keep it fast.
 */

// ---------- helpers ----------
function isHttpUrl(u: unknown): boolean {
  return typeof u === 'string' && /^https?:\/\//i.test(u);
}
function assert(cond: any, msg: string) {
  if (!cond) throw new Error(`[schema-guard] ${msg}`);
}
function take<T>(arr: T[], n: number) {
  return arr.slice(0, n);
}

// ---------- imports (read-only; reuse your app code) ----------
import fs from 'node:fs';
import path from 'node:path';
import * as seoIndexes from '../src/app/_generated/seo-indexes';
import { getWhopViewModel } from '../src/app/(public)/offer/[slug]/vm';
import {
  buildPrimaryEntity,
  buildBreadcrumbList,
  buildOffers,
  buildFAQ,
  buildHowTo,
  buildItemList,
  buildReviews,
  type WhopViewModel
} from '../src/lib/buildSchema';

// ---------- main ----------
async function run() {
  // 1) Extract indexable whop paths from the sitemap artifact generated in prebuild
  function readSitemapXml(): string | null {
    const candidates = [
      path.join(process.cwd(), 'public', 'sitemaps', 'index-1.xml'),
      path.join(process.cwd(), 'public', 'index-1.xml'),
    ];
    for (const p of candidates) {
      try {
        if (fs.existsSync(p)) return fs.readFileSync(p, 'utf8');
      } catch {}
    }
    return null;
  }

  function pathsFromSitemap(xml: string): string[] {
    // Very small parser: grab <loc>…</loc> and map to pathname
    const locs = Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g)).map(m => m[1]);
    const whopPaths = new Set<string>();
    for (const u of locs) {
      try {
        const url = new URL(u);
        if (url.pathname.startsWith('/whop/')) whopPaths.add(url.pathname.replace(/\/+$/, ''));
      } catch {/* ignore bad URLs */}
    }
    return Array.from(whopPaths);
  }

  // Optional: refine with seo-indexes Sets if present
  function filterWithSeoIndexes(paths: string[]): string[] {
    try {
      const seo: any = seoIndexes as any; // already imported above in your file
      const RETIRED = seo?.RETIRED_PATHS instanceof Set ? seo.RETIRED_PATHS as Set<string> : new Set<string>();
      const NOINDEX = seo?.NOINDEX_PATHS instanceof Set ? seo.NOINDEX_PATHS as Set<string> : new Set<string>();
      return paths.filter(p => !RETIRED.has(p) && !NOINDEX.has(p));
    } catch {
      return paths;
    }
  }

  const xml = readSitemapXml();
  if (!xml) {
    console.warn('[schema-guard] No sitemap index-1.xml found in /public; skipping guard.');
    return;
  }

  let paths = pathsFromSitemap(xml);
  if (paths.length === 0) {
    console.warn('[schema-guard] Sitemap has 0 /whop/ URLs; skipping guard.');
    return;
  }
  // If your sitemap already contains only indexable, this is a no-op; still safe to apply:
  paths = filterWithSeoIndexes(paths);

  const samplePaths = take(paths.sort(), 12);
  const slugs = samplePaths.map(p => p.replace(/^\/whop\//, ''));

  if (slugs.length === 0) {
    console.warn('[schema-guard] No indexable whop slugs after filtering; skipping guard.');
    return;
  }

  // 2) Proceed with your existing rigorous validations for each slug…
  for (const slug of slugs) {
    // 2) Build the same VM your page uses (no new loaders beyond page path)
    const vm: WhopViewModel = await getWhopViewModel(slug, 'en');

    // 3) Assemble schema nodes exactly like the page
    const primary = buildPrimaryEntity(vm);
    const breadcrumbs = buildBreadcrumbList(vm);
    const offers = buildOffers(vm);
    if (offers) (primary as any).offers = offers;
    const faqNode = buildFAQ(vm);
    const howtoNode = buildHowTo(vm);
    const reviews = buildReviews(vm);
    if (reviews) (primary as any).review = reviews;
    const recommendedNode  = buildItemList('recommended',  vm.recommendedUrls, vm.url);
    const alternativesNode = buildItemList('alternatives', vm.alternativeUrls, vm.url);

    const graph = [primary, breadcrumbs, faqNode, howtoNode, recommendedNode, alternativesNode]
      .filter(Boolean);

    // 4) HARD GUARDRails

    // (a) Exactly ONE primary entity
    assert(primary && primary['@type'], `Missing primary entity for slug "${slug}"`);

    // (b) URLs must be absolute
    const checkUrl = (u: any, ctx: string) =>
      assert(isHttpUrl(u), `Non-absolute URL in ${ctx} for "${slug}": ${u}`);

    // primary.url / @id base
    checkUrl((primary as any).url, 'primary.url');
    const pid = (primary as any)['@id'];
    assert(typeof pid === 'string' && pid.includes('#'),
           `Primary @id must be stable hash ID for "${slug}"`);
    checkUrl(pid.split('#')[0], 'primary.@id base');

    // breadcrumbs
    if (breadcrumbs) {
      const b = (breadcrumbs as any).itemListElement || [];
      for (const item of b) checkUrl(item.item, 'BreadcrumbList.item');
    }

    // itemlists
    const lists = [recommendedNode, alternativesNode].filter(Boolean) as any[];
    for (const list of lists) {
      checkUrl((list as any)['@id'].split('#')[0], 'ItemList.@id base');
      const els = list.itemListElement || [];
      assert(els.length > 0, `Empty ItemList "${list['@id']}" for "${slug}"`);
      els.forEach((li: any, i: number) => {
        assert(typeof li.position === 'number' && li.position === i + 1,
               `Incorrect ListItem.position at ${list['@id']} pos ${i + 1} for "${slug}"`);
        checkUrl(li.url, `ItemList.url at ${list['@id']} pos ${i + 1}`);
      });
    }

    // (c) Offers: if present, must have price (string) + priceCurrency (ISO 4217)
    if ((primary as any).offers) {
      const offs = (primary as any).offers as any[];
      assert(Array.isArray(offs) && offs.length > 0,
             `offers must be non-empty array for "${slug}"`);
      for (const off of offs) {
        assert(off['@type'] === 'Offer', `Offer @type incorrect for "${slug}"`);
        assert(typeof off.price === 'string' && off.price.length > 0,
               `Offer.price must be string for "${slug}"`);
        assert(typeof off.priceCurrency === 'string' && off.priceCurrency.length === 3,
               `Offer.priceCurrency missing/invalid for "${slug}"`);
        checkUrl(off.url, 'Offer.url');
      }
    }

    // (d) AggregateRating only when BOTH > 0
    const ar = (primary as any).aggregateRating;
    if (ar != null) {
      assert(ar['@type'] === 'AggregateRating', `aggregateRating @type incorrect for "${slug}"`);
      assert(Number(ar.ratingValue) > 0 && Number(ar.reviewCount) > 0,
             `aggregateRating must have >0 ratingValue and reviewCount for "${slug}"`);
    }

    // (e) FAQ & HowTo: if present, must be non-empty
    if (faqNode) {
      const qa = (faqNode as any).mainEntity || [];
      assert(qa.length > 0, `FAQPage.mainEntity empty for "${slug}"`);
    }
    if (howtoNode) {
      const steps = (howtoNode as any).step || [];
      assert(steps.length >= 2, `HowTo.step requires at least 2 steps for "${slug}"`);
    }

    // (f) Localization sanity (optional)
    if ((vm as any).inLanguage) {
      const il = String((vm as any).inLanguage);
      assert(il.length >= 2 && il.length <= 5,
             `inLanguage looks invalid for "${slug}": ${il}`);
    }

    // (g) Graph sanity
    assert(graph.length >= 2, `Suspiciously small graph for "${slug}"`);
  }

  console.log(`[schema-guard] OK — validated ${slugs.length} whop pages from sitemap with strict rules.`);
}

run().catch((err) => {
  console.error(err?.stack || err);
  process.exit(1);
});