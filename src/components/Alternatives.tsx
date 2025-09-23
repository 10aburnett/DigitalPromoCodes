'use client';
import { useEffect, useState } from 'react';
import WhopCardLink from './WhopCardLink';
import SectionPanel from './SectionPanel';
import { getBaseUrl } from '@/lib/base-url';
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';

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

  // simple fallback title from slug
  const pretty = (s: string) =>
    s.replace(/[-_]+/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());

  // Base URL helper for SSR compatibility
  async function fetchWhopDetails(slugs: string[]) {
    const base = getBaseUrl();
    if (!slugs.length) return [];

    try {
      const res = await fetch(
        `${base}/api/whops/batch?slugs=${encodeURIComponent(slugs.join(','))}`,
        { cache: 'no-store' }
      );
      if (!res.ok) return [];
      const json = await res.json();
      return json.whops ?? [];
    } catch {
      return [];
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
      const t0 = performance.now();

      try {
        setErr(null);
        setAlternatives([]);
        setAnchorTexts(new Map());
        setDesc('');
        setLoading(true);

        const base = getBaseUrl();
        const useGraph =
          process.env.NEXT_PUBLIC_USE_GRAPH_LINKS === 'true' ||
          process.env.USE_GRAPH_LINKS === 'true';

        let hydratedAlternatives: AlternativeWhop[] = [];
        let anchorBySlug = new Map<string, string>();
        let editorialDescription = '';

        // Try deterministic neighbors.json first
        if (useGraph) {
          try {
            const neighbors = await loadNeighbors();
            const slugs = getNeighborSlugsFor(neighbors, currentWhopSlug, 'alternatives').slice(0, 5);

            if (slugs.length) {
              // Hydrate with batch API to get full whop details
              const whopDetails = await fetchWhopDetails(slugs);

              if (whopDetails.length > 0) {
                // Also try to get editorial descriptions and anchor texts from API
                try {
                  const res = await fetch(
                    `${base}/api/whops/${encodeURIComponent(currentWhopSlug)}/alternatives`,
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

                // Transform whop details to alternatives format
                hydratedAlternatives = whopDetails.map((whop: any) => ({
                  id: whop.id,
                  name: whop.name,
                  slug: whop.slug,
                  logo: whop.logo,
                  description: whop.description,
                  category: whop.category,
                  price: whop.price,
                  rating: whop.rating || 0,
                  promoCodes: whop.promoCodes || []
                }));

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

        // Fallback: use API's computed list directly (no rich cards, just links)
        const res = await fetch(
          `${base}/api/whops/${encodeURIComponent(currentWhopSlug)}/alternatives`,
          { cache: 'no-store' }
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();

        const altSlugs = (data?.alternatives ?? [])
          .slice(0, 5)
          .map((a: any) => a.slug)
          .filter(Boolean);

        if (altSlugs.length > 0) {
          // Try to hydrate these with batch API too
          const whopDetails = await fetchWhopDetails(altSlugs);

          if (whopDetails.length > 0) {
            // Map anchor texts from API data
            for (const a of data?.alternatives ?? []) {
              if (a?.slug) anchorBySlug.set(a.slug, a.anchorText || a.name || pretty(a.slug));
            }

            hydratedAlternatives = whopDetails.map((whop: any) => ({
              id: whop.id,
              name: whop.name,
              slug: whop.slug,
              logo: whop.logo,
              description: whop.description,
              category: whop.category,
              price: whop.price,
              rating: whop.rating || 0,
              promoCodes: whop.promoCodes || []
            }));

            setAlternatives(hydratedAlternatives);
            setAnchorTexts(anchorBySlug);
            setDesc(data?.editorialDescription || '');
          }
        }

        // Enhanced dev logging and error tracking
        if (DEBUG) {
          const graphUsed = useGraph && hydratedAlternatives.length > 0;
          const loadTime = (performance.now() - t0).toFixed(1);

          console.log(`🔄 Alternatives for "${currentWhopSlug}": ${loadTime}ms`, {
            useGraph,
            graphUsed,
            count: hydratedAlternatives.length,
            anchors: anchorBySlug.size,
            editorialDesc: !!editorialDescription,
            source: graphUsed ? 'graph+batch' : 'api+batch'
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
              <WhopCardLink
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