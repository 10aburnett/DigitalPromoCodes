'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WhopCardLink from './WhopCardLink';
import SectionPanel from './SectionPanel';
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';
import { getBaseUrl } from '@/lib/base-url';
import { normalizeSlug, encodeSlugForAPI } from '@/lib/slug-normalize';

interface PromoCode {
  id: string;
  title: string;
  type: string;
  value: string;
  code: string | null;
}

interface RecommendedWhop {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string | null;
  category: string | null;
  price: string | null;
  rating: number;
  promoCodes: PromoCode[];
  similarityScore?: number; // Optional since it's added by the API but not needed in display
}

interface RecommendedWhopsProps {
  currentWhopSlug: string;
}

async function fetchRecommendations(encodedSlug: string) {
  const base = getBaseUrl();
  const url = `${base}/api/whops/${encodedSlug}/recommendations`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch recommendations: ${res.status}`);
  return res.json();
}

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
    const raw = getNeighborSlugsFor(neighbors, currentWhopSlug, 'recommendations');
    const slugs = Array.from(new Set(raw.filter(Boolean))).slice(0, 12);
    if (slugs.length === 0) {
      reasons.push('graph: no slugs');
      return { items: [], reasons };
    }

    // batch hydrate
    const batched = await fetchWhopDetails(slugs);
    if (Array.isArray(batched) && batched.length > 0) {
      return { items: batched.slice(0, 4), reasons };
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
      return { items: salvaged.slice(0, 4), reasons };
    }

    reasons.push('graph salvage empty');
    return { items: [], reasons };
  } catch (e) {
    reasons.push(`graph error: ${String(e)}`);
    return { items: [], reasons };
  }
}

export default function RecommendedWhops({ currentWhopSlug }: RecommendedWhopsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedWhop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendationsData = async () => {
      const DEBUG = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true';
      const t0 = performance.now();
      let dataSource = 'none';          // <- never "unknown"
      let data: any | undefined = undefined;

      try {
        setLoading(true);

        // Fix double encoding: decode once, normalize, then encode once for API
        const raw = currentWhopSlug || '';
        const canonicalSlug = normalizeSlug(raw);  // This handles decoding + normalization
        const apiSlug = encodeSlugForAPI(canonicalSlug);

        if (DEBUG) console.log('slug check', { currentWhopSlug, canonicalSlug, apiSlug });

        // 1) Graph-first (if flag on)
        const useGraph = process.env.NEXT_PUBLIC_USE_GRAPH_LINKS === 'true' || process.env.USE_GRAPH_LINKS === 'true';
        let cleanedRecommendations: RecommendedWhop[] = [];

        if (useGraph) {
          // Add decisive runtime check for graph presence
          const neighbors = await loadNeighbors();
          if (DEBUG) {
            const exists = !!neighbors[canonicalSlug];
            const lenRec = neighbors[canonicalSlug]?.recommendations?.length ?? 0;
            const lenAlt = neighbors[canonicalSlug]?.alternatives?.length ?? 0;
            console.log('graph presence', { canonicalSlug, exists, lenRec, lenAlt });
          }

          const { items, reasons } = await hydrateViaGraph(canonicalSlug);
          if (items.length > 0) {
            cleanedRecommendations = items.map(({ similarityScore, ...rest }: any) => rest);
            dataSource = 'graph+batch';
          } else {
            // keep the reasons so we can log them later
            dataSource = 'graph-empty';
            if (DEBUG) console.warn('Graph-first empty:', reasons);
          }
        }

        // 2) API fallback
        if (cleanedRecommendations.length === 0) {
          try {
            data = await fetchRecommendations(apiSlug);
            const apiRecs = (data?.recommendations || []).map(({ similarityScore, ...r }: any) => r);
            if (apiRecs.length > 0) {
              cleanedRecommendations = apiRecs;
              dataSource = 'api';
            } else {
              dataSource = dataSource === 'none' ? 'api-empty' : `${dataSource}+api-empty`;
            }
          } catch (e) {
            dataSource = dataSource === 'none' ? 'api-error' : `${dataSource}+api-error`;
            if (DEBUG) console.warn('API error:', e);
          }
        }

        // 3) Final fallback to graph regardless of flag
        if (cleanedRecommendations.length === 0) {
          const { items, reasons } = await hydrateViaGraph(canonicalSlug);
          if (items.length > 0) {
            cleanedRecommendations = items.map(({ similarityScore, ...rest }: any) => rest);
            dataSource = dataSource.includes('graph') ? `${dataSource}` : 'graph-fallback';
            if (DEBUG) console.log('♻️ Used graph fallback for recommendations.');
          } else {
            if (DEBUG) console.warn('Graph fallback empty:', reasons);
            dataSource = dataSource.includes('graph') ? `${dataSource}+fallback-empty` : 'graph-fallback-empty';
          }
        }

        setRecommendations(cleanedRecommendations);

        // --- DEBUG (always derives graphUsed from dataSource)
        if (DEBUG) {
          const loadTime = (performance.now() - t0).toFixed(1);
          const graphUsed = dataSource.includes('graph');
          console.log('slug check', { currentWhopSlug, canonicalSlug, apiSlug });
          console.log(`🎯 RecommendedWhops for "${canonicalSlug}": ${loadTime}ms`, {
            useGraph,
            graphUsed,
            count: cleanedRecommendations.length,
            source: dataSource,
          });

          if (!graphUsed && data?.debug) {
            console.log('📊 API Debug:', {
              total: data.debug.totalCandidates,
              filtered: data.debug.filteredCount,
            });
          }
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
        setRecommendations([]); // Graceful fallback with empty array
      } finally {
        setLoading(false);
      }
    };

    if (currentWhopSlug) {
      fetchRecommendationsData();
    }
  }, [currentWhopSlug]);

  if (loading) {
    return (
      <SectionPanel
        title="Recommended for You"
        subtitle="Similar offers based on your current selection"
      >
        <div className="space-y-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="rounded-lg p-4 border h-24" style={{ backgroundColor: 'var(--background-color)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-4 h-full">
                  <div className="w-16 h-16 rounded-md bg-gray-300 flex-shrink-0"></div>
                  <div className="flex-1 space-y-2">
                    <div className="h-4 bg-gray-300 rounded"></div>
                    <div className="h-3 bg-gray-200 rounded"></div>
                    <div className="flex justify-between items-center mt-2">
                      <div className="h-6 bg-gray-300 rounded-full w-20"></div>
                      <div className="h-4 bg-gray-200 rounded w-12"></div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </SectionPanel>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Don't show anything if there's an error or no recommendations
  }


  const getPromoText = (whop: RecommendedWhop) => {
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

  return (
    <SectionPanel
      title="Recommended for You"
      subtitle="Similar offers based on your current selection"
    >
      {/* Single column layout for better alignment within constrained width */}
      <div className="space-y-4">
        {recommendations.map((whop, index) => (
          <WhopCardLink
            key={whop.id}
            slug={whop.slug}
            title={whop.name}
            subtitle={whop.description}
            priceText={whop.price}
            imageUrl={whop.logo}
            badgeText={getPromoText(whop)}
            category={whop.category}
            rating={whop.rating}
            priority={index < 2} // Prefetch first 2 for better SEO and performance
          />
        ))}
      </div>

      {/* View More Link - SEO-friendly with consistent URL structure */}
      <div className="mt-8 text-center">
        <Link
          href="/"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-all duration-200 hover:opacity-80 hover:scale-105"
          style={{
            color: 'var(--accent-color)',
            border: '1px solid var(--accent-color)'
          }}
        >
          Explore All Offers
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* JSON-LD Structured Data for SEO */}
      {recommendations.length > 0 && (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "ItemList",
              "name": "Recommended for You",
              "itemListElement": recommendations.map((whop, index) => ({
                "@type": "ListItem",
                "position": index + 1,
                "url": `${getBaseUrl()}/whop/${whop.slug}`
              }))
            })
          }}
        />
      )}
    </SectionPanel>
  );
} 