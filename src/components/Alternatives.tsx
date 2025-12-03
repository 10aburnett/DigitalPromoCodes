'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import OfferCardLink from './OfferCardLink';
import SectionPanel from './SectionPanel';
import { getBaseUrl } from '@/lib/base-url';
import { loadNeighbors, getNeighborSlugsFor, getExploreFor } from '@/lib/graph';
import { normalizeSlug, encodeSlugForAPI } from '@/lib/slug-normalize';

interface PromoCode {
  id: string;
  title: string;
  type: string;
  value: string;
  code: string | null;
}

interface AlternativeWhop {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  category: string | null;
  price: string | null;
  rating: number;
  promoCodes: PromoCode[];
}

type AltLink = { slug: string; anchorText: string };

export default function Alternatives({ currentWhopSlug }: { currentWhopSlug: string }) {
  const [alternatives, setAlternatives] = useState<AlternativeWhop[]>([]);
  const [anchorTexts, setAnchorTexts] = useState<Map<string, string>>(new Map());
  const [desc, setDesc] = useState<string>('');
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [explore, setExplore] = useState<{ slug: string; name: string; category?: string } | null>(null);

  // simple fallback title from slug
  const pretty = (s: string) =>
    s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  // Base URL helper for SSR compatibility
  async function fetchWhopDetails(slugs: string[]) {
    const base = getBaseUrl();
    const unique = Array.from(new Set(slugs.filter(Boolean)));
    if (!unique.length) return [];

    try {
      const qs = unique.map(s => encodeURIComponent(s)).join(',');
      const res = await fetch(`${base}/api/whops/batch?slugs=${qs}`, { cache: 'no-store' });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json.whops) ? json.whops : [];
    } catch {
      return [];
    }
  }

  async function hydrateViaGraph(currentWhopSlug: string) {
    const reasons: string[] = [];
    try {
      const neighbors = await loadNeighbors();
      const raw = getNeighborSlugsFor(neighbors, currentWhopSlug, 'alternatives');
      const slugs = Array.from(new Set(raw.filter(Boolean))).slice(0, 12);
      if (slugs.length === 0) {
        reasons.push('graph: no slugs');
        return { items: [], reasons };
      }

      // batch hydrate
      const batched = await fetchWhopDetails(slugs);
      if (Array.isArray(batched) && batched.length > 0) {
        return { items: batched.slice(0, 5), reasons };
      }
      reasons.push('graph batch empty');

      // salvage: try per-slug (best effort)
      const base = getBaseUrl();
      const singleFetches = await Promise.allSettled(
        slugs.map(s => fetch(`${base}/api/whops/${encodeURIComponent(s)}`, { cache: 'no-store' })
          .then(r => r.ok ? r.json() : null)
          .catch(() => null))
      );
      const salvaged = singleFetches
        .map(r => (r.status === 'fulfilled' ? (r.value?.whop || r.value) : null))
        .filter(Boolean);

      if (salvaged.length > 0) {
        reasons.push(`graph salvage per-slug: ${salvaged.length}`);
        return { items: salvaged.slice(0, 5), reasons };
      }

      reasons.push('graph salvage empty');
      return { items: [], reasons };
    } catch (e) {
      reasons.push(`graph error: ${String(e)}`);
      return { items: [], reasons };
    }
  }

  const getPromoText = (whop: AlternativeWhop) => {
    const firstPromo = whop.promoCodes?.[0];
    if (!firstPromo) return 'Exclusive Access';

    // If there's a promo code and a value > 0, show the discount
    if (firstPromo.code && firstPromo.value && firstPromo.value !== '0') {
      // Check if value already contains currency or percentage symbol
      if (firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off')) {
        return firstPromo.value;
      }
      return `${firstPromo.value}% Off`;
    }

    return firstPromo.title || 'Exclusive Access';
  };

  useEffect(() => {
    (async () => {
      const DEBUG = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true';
      const disableApi = process.env.NEXT_PUBLIC_DISABLE_API_FALLBACK === 'true';
      const t0 = performance.now();

      try {
        setErr(null);
        setAlternatives([]);
        setAnchorTexts(new Map());
        setDesc('');
        setLoading(true);

        // Fix double encoding: decode once, normalize, then encode once for API
        const raw = currentWhopSlug || '';
        const canonicalSlug = normalizeSlug(raw);  // This handles decoding + normalization
        const apiSlug = encodeSlugForAPI(canonicalSlug);

        if (DEBUG) console.log('slug check (Alternatives)', { currentWhopSlug, canonicalSlug, apiSlug });

        const base = getBaseUrl();
        const useGraph =
          process.env.NEXT_PUBLIC_USE_GRAPH_LINKS === 'true' ||
          process.env.USE_GRAPH_LINKS === 'true';

        let hydratedAlternatives: AlternativeWhop[] = [];
        const anchorBySlug = new Map<string, string>();
        let editorialDescription = '';

        // Try deterministic neighbors.json first
        if (useGraph) {
          try {
            const neighbors = await loadNeighbors();
            const rawAltSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'alternatives');

            // Get recommended slugs to exclude them from alternatives (keep sections distinct)
            const recSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
            const recSet = new Set(recSlugs);

            // Filter out any alternatives that appear in recommendations and take wider net
            const slugs = Array.from(new Set(rawAltSlugs.filter(Boolean).filter(slug => !recSet.has(slug)))).slice(0, 15);

            if (slugs.length) {
              // Hydrate with batch API to get full whop details
              const whopDetails = await fetchWhopDetails(slugs);

              if (whopDetails.length > 0) {
                // Also try to get editorial descriptions and anchor texts from API
                try {
                  const res = await fetch(
                    `${base}/api/whops/${apiSlug}/alternatives`,
                    { cache: 'no-store' }
                  );
                  const data = res.ok ? await res.json() : { alternatives: [], editorialDescription: '' };

                  // Map anchor texts from API data
                  for (const a of data?.alternatives ?? []) {
                    if (a?.slug) anchorBySlug.set(a.slug, a.anchorText || a.name || pretty(a.slug));
                  }

                  editorialDescription = data?.editorialDescription || '';
                } catch {
                  // Fall through - use default anchor texts
                }

                // Transform whop details to alternatives format (slice to 5 after hydration)
                hydratedAlternatives = whopDetails.slice(0, 5).map((whop: any) => {
                  const r = Number(whop.rating ?? whop.averageRating);
                  return {
                    id: whop.id,
                    name: whop.name,
                    slug: whop.slug,
                    logo: whop.logo,
                    description: whop.description,
                    category: whop.category,
                    price: whop.price,
                    rating: Number.isFinite(r) && r > 0 ? r : undefined,
                    promoCodes: whop.promoCodes || []
                  };
                });

                setAlternatives(hydratedAlternatives);
                setAnchorTexts(anchorBySlug);
                setDesc(editorialDescription);
                setLoading(false);
                return; // success via graph + batch hydration
              }
            }
          } catch {
            // fall through to full API fallback
          }
        }

        // Fallback: use API's computed list directly
        if (!disableApi) {
          const res = await fetch(
            `${base}/api/whops/${apiSlug}/alternatives`,
            { cache: 'no-store' }
          );
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const data = await res.json();

          // Get recommended slugs to exclude them from alternatives (keep sections distinct)
          let recSlugs: string[] = [];
          try {
            const neighbors = await loadNeighbors();
            if (neighbors) {
              recSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
            }
          } catch {
            // Continue without deduplication if graph loading fails
          }
          const recSet = new Set(recSlugs);

          const altSlugs = (data?.alternatives ?? [])
            .map((a: any) => a.slug)
            .filter(Boolean)
            .filter((slug: string) => !recSet.has(slug)) // Exclude recommended slugs
            .slice(0, 5);

          if (altSlugs.length > 0) {
            // Try to hydrate these with batch API too
            const whopDetails = await fetchWhopDetails(altSlugs);

            if (whopDetails.length > 0) {
              // Map anchor texts from API data
              for (const a of data?.alternatives ?? []) {
                if (a?.slug) anchorBySlug.set(a.slug, a.anchorText || a.name || pretty(a.slug));
              }

              hydratedAlternatives = whopDetails.map((whop: any) => {
                const r = Number(whop.rating ?? whop.averageRating);
                return {
                  id: whop.id,
                  name: whop.name,
                  slug: whop.slug,
                  logo: whop.logo,
                  description: whop.description,
                  category: whop.category,
                  price: whop.price,
                  rating: Number.isFinite(r) && r > 0 ? r : undefined,
                  promoCodes: whop.promoCodes || []
                };
              });

              setAlternatives(hydratedAlternatives);
              setAnchorTexts(anchorBySlug);
              setDesc(data?.editorialDescription || '');
            }
          }
        }

        // Final fallback: if API also returned nothing, try graph anyway (regardless of env flag)
        if (hydratedAlternatives.length === 0) {
          try {
            const neighbors = await loadNeighbors();
            const rawAltSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'alternatives');

            // Still need to exclude recommendations to maintain disjointness
            let fallbackRecSlugs: string[] = [];
            try {
              fallbackRecSlugs = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
            } catch {
              // Continue without deduplication if needed
            }
            const fallbackRecSet = new Set(fallbackRecSlugs);

            const slugs = Array.from(new Set(rawAltSlugs.filter(Boolean).filter(slug => !fallbackRecSet.has(slug)))).slice(0, 15);

            if (slugs.length) {
              const whopDetails = await fetchWhopDetails(slugs);
              hydratedAlternatives = whopDetails.slice(0, 5).map((whop: any) => {
                const r = Number(whop.rating ?? whop.averageRating);
                return {
                  id: whop.id,
                  name: whop.name,
                  slug: whop.slug,
                  logo: whop.logo,
                  description: whop.description,
                  category: whop.category,
                  price: whop.price,
                  rating: Number.isFinite(r) && r > 0 ? r : undefined,
                  promoCodes: whop.promoCodes || []
                };
              });

              // Set fallback anchor texts using pretty names
              for (const whop of hydratedAlternatives) {
                if (!anchorBySlug.has(whop.slug)) {
                  anchorBySlug.set(whop.slug, whop.name || pretty(whop.slug));
                }
              }

              setAlternatives(hydratedAlternatives);
              setAnchorTexts(anchorBySlug);
              setDesc('Alternative offers that might interest you');

              if (DEBUG && hydratedAlternatives.length > 0) {
                console.log('♻️ API empty; used graph fallback for alternatives.');
              }
            }
          } catch (e) {
            if (DEBUG) console.warn('Graph fallback (alternatives) failed:', e);
          }
        }

        // Enhanced dev logging and error tracking
        if (DEBUG) {
          const graphUsed = useGraph && hydratedAlternatives.length > 0;
          const loadTime = (performance.now() - t0).toFixed(1);

          // Get recommendations for logging overlap info
          let recSlugsForLog: string[] = [];
          try {
            const neighbors = await loadNeighbors();
            if (neighbors) {
              recSlugsForLog = getNeighborSlugsFor(neighbors, canonicalSlug, 'recommendations');
            }
          } catch { /* ignore */ }

          const altSlugsForLog = hydratedAlternatives.map(a => a.slug);
          const overlap = altSlugsForLog.filter(slug => recSlugsForLog.includes(slug));

          console.log(`🔄 Alternatives for "${currentWhopSlug}": ${loadTime}ms`, {
            useGraph,
            graphUsed,
            count: hydratedAlternatives.length,
            anchors: anchorBySlug.size,
            editorialDesc: !!editorialDescription,
            source: graphUsed ? 'graph+batch' : 'api+batch',
            deduplication: {
              recCount: recSlugsForLog.length,
              overlap: overlap.length,
              overlapping: overlap
            }
          });

          // Log missing hydration
          if (useGraph && hydratedAlternatives.length === 0) {
            console.warn('⚠️ Alternatives graph hydration failed - falling back to API');
          }

          // Log potential 404s/missing data
          const invalidItems = hydratedAlternatives.filter(whop => !whop.name || !whop.slug);
          if (invalidItems.length > 0) {
            console.error(`❌ Invalid alternatives: ${invalidItems.length}/${hydratedAlternatives.length}`);
          }

          const missingAnchors = hydratedAlternatives.filter(whop => !anchorBySlug.has(whop.slug));
          if (missingAnchors.length > 0) {
            console.warn(`⚠️ Missing anchor texts: ${missingAnchors.length}/${hydratedAlternatives.length}`);
          }
        }

        // Debug hook for troubleshooting
        if (typeof window !== 'undefined') {
          (window as any).__whpAltDebug = {
            slug: currentWhopSlug,
            canonicalSlug,
            count: hydratedAlternatives.length,
            hydrated: hydratedAlternatives.map(w => w.slug),
            useGraph,
            graphUsed: useGraph && hydratedAlternatives.length > 0,
            editorialDesc: !!editorialDescription
          };
        }

        // Fetch explore link
        try {
          const neighbors = await loadNeighbors();
          const exploreSlug = getExploreFor(neighbors as any, canonicalSlug);

          // Avoid duplicates: if explore equals a shown alternative, skip
          const shownSlugs = new Set(hydratedAlternatives.map(r => r.slug));
          if (exploreSlug && !shownSlugs.has(exploreSlug)) {
            const details = await fetchWhopDetails([exploreSlug]);
            if (details && details.length > 0) {
              const item = details[0];
              setExplore({
                slug: item.slug,
                name: item.name,
                category: item.category ?? undefined
              });
            }
          }
        } catch {
          // Silent fail for explore link
        }

        setLoading(false);
      } catch (e: any) {
        console.error('Error fetching alternatives:', e);
        setErr(e?.message || 'Failed to load alternatives');
        setLoading(false);
      }
    })();
  }, [currentWhopSlug]);

  if (loading) {
    return (
      <div className="mt-12">
        <SectionPanel
          title="You might also consider…"
          subtitle="Alternative offers that might interest you"
        >
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="rounded-lg p-4 border h-20" style={{ backgroundColor: 'var(--background-color)', borderColor: 'var(--border-color)' }}>
                  <div className="flex items-center gap-4 h-full">
                    <div className="w-12 h-12 rounded-md bg-gray-300 flex-shrink-0"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-gray-300 rounded"></div>
                      <div className="h-3 bg-gray-200 rounded"></div>
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </SectionPanel>
      </div>
    );
  }

  if (err || alternatives.length === 0) return null;

  return (
    <div className="mt-12">
      <SectionPanel
        title="You might also consider…"
        subtitle={desc || "Alternative offers that might interest you"}
      >
        <div className="space-y-4">
          {alternatives.map((whop, index) => {
            // Use anchor text if available, fallback to whop name
            const displayTitle = anchorTexts.get(whop.slug) || whop.name;

            return (
              <OfferCardLink
                key={whop.id}
                slug={whop.slug}
                title={displayTitle}
                subtitle={whop.description}
                priceText={whop.price}
                imageUrl={whop.logo}
                badgeText={getPromoText(whop)}
                category={whop.category}
                rating={whop.rating}
                priority={index < 2} // Prefetch first 2
              />
            );
          })}
        </div>

        {/* Explore link (optional, small + unobtrusive) */}
        {explore && (
          <div
            className="mt-6 rounded-lg border p-4"
            style={{ borderColor: 'var(--border-color)', backgroundColor: 'var(--background-color)' }}
          >
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span style={{ color: 'var(--text-secondary)' }}>
                Explore another{explore.category ? ` in ${explore.category}` : ''}:
              </span>
              <Link
                href={`/whop/${explore.slug}`}
                className="inline-flex items-center font-medium hover:opacity-80 transition-opacity"
                style={{ color: 'var(--accent-color)' }}
              >
                {explore.name}
                <svg xmlns="http://www.w3.org/2000/svg" className="ml-1 h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        )}

        {/* JSON-LD Structured Data for SEO */}
        {alternatives.length > 0 && (
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: JSON.stringify({
                "@context": "https://schema.org",
                "@type": "ItemList",
                "name": "You might also consider…",
                "itemListElement": alternatives.map((whop, index) => ({
                  "@type": "ListItem",
                  "position": index + 1,
                  "url": `${getBaseUrl()}/whop/${whop.slug}`
                }))
              })
            }}
          />
        )}
      </SectionPanel>
    </div>
  );
}