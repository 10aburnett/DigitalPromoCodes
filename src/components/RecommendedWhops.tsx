'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import WhopCardLink from './WhopCardLink';
import SectionPanel from './SectionPanel';
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';
import { getBaseUrl } from '@/lib/base-url';

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

async function fetchRecommendations(slug: string) {
  const base = getBaseUrl();
  const url = `${base}/api/whops/${encodeURIComponent(slug)}/recommendations`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Failed to fetch recommendations: ${res.status}`);
  return res.json();
}

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

export default function RecommendedWhops({ currentWhopSlug }: RecommendedWhopsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedWhop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendationsData = async () => {
      const DEBUG = process.env.NODE_ENV === 'development' || process.env.NEXT_PUBLIC_DEBUG === 'true';
      const t0 = performance.now();

      try {
        setLoading(true);
        const useGraph = process.env.NEXT_PUBLIC_USE_GRAPH_LINKS === 'true' || process.env.USE_GRAPH_LINKS === 'true';

        let cleanedRecommendations: RecommendedWhop[] = [];

        // 1) Try neighbors.json (deterministic, orphan-safe)
        if (useGraph) {
          try {
            const neighbors = await loadNeighbors();
            const slugs = getNeighborSlugsFor(neighbors, currentWhopSlug, 'recommendations').slice(0, 4);
            if (slugs.length) {
              // Hydrate with full whop details
              const whopDetails = await fetchWhopDetails(slugs);
              cleanedRecommendations = whopDetails.map((whop: any) => {
                const { similarityScore, ...cleanRec } = whop;
                return cleanRec;
              });
            }
          } catch { /* fall back silently */ }
        }

        // 2) Fallback to API (dynamic) if graph didn't work or returned empty
        if (cleanedRecommendations.length === 0) {
          const data = await fetchRecommendations(currentWhopSlug);
          cleanedRecommendations = (data.recommendations || []).map((rec: any) => {
            const { similarityScore, ...cleanRec } = rec;
            return cleanRec;
          });
        }

        setRecommendations(cleanedRecommendations);

        // Enhanced dev logging and error tracking
        if (DEBUG) {
          const graphUsed = useGraph && cleanedRecommendations.length > 0;
          const loadTime = (performance.now() - t0).toFixed(1);

          console.log(`🎯 RecommendedWhops for "${currentWhopSlug}": ${loadTime}ms`, {
            useGraph,
            graphUsed,
            count: cleanedRecommendations.length,
            source: graphUsed ? 'graph+batch' : 'api'
          });

          // Log missing hydration (graph had slugs but batch API failed)
          if (useGraph && cleanedRecommendations.length === 0) {
            console.warn('⚠️ Graph hydration failed - falling back to API');
          }

          // API fallback debug info (trim noisy payloads)
          if (!graphUsed && typeof data !== 'undefined' && data?.debug) {
            console.log('📊 API Debug:', {
              total: data.debug.totalCandidates,
              filtered: data.debug.filteredCount
            });
          }

          // Log potential 404s/missing data
          const invalidItems = cleanedRecommendations.filter(whop => !whop.name || !whop.slug);
          if (invalidItems.length > 0) {
            console.error(`❌ Invalid recommendations: ${invalidItems.length}/${cleanedRecommendations.length}`);
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