'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { normalizeImagePath } from '@/lib/image-utils';
import InitialsAvatar from './InitialsAvatar';
import { loadNeighbors, getNeighborSlugsFor } from '@/lib/graph';

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

// Base URL helper for SSR compatibility
function getBaseUrl() {
  // Prefer explicit env, fallback to window in CSR, finally to localhost for dev
  if (process.env.NEXT_PUBLIC_BASE_URL) return process.env.NEXT_PUBLIC_BASE_URL;
  if (typeof window !== 'undefined') return window.location.origin;
  return 'http://localhost:3000';
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
  const [imageStates, setImageStates] = useState<{[key: string]: { imagePath: string; imageError: boolean }}>({});

  useEffect(() => {
    const fetchRecommendationsData = async () => {
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
        
        // Initialize image states for all recommendations
        const newImageStates: {[key: string]: { imagePath: string; imageError: boolean }} = {};
        cleanedRecommendations.forEach((whop: RecommendedWhop) => {
          // Check if logoUrl is empty/null/undefined first
          if (!whop.logo || 
              whop.logo.trim() === '' || 
              whop.logo === 'null' || 
              whop.logo === 'undefined' ||
              whop.logo === 'NULL' ||
              whop.logo === 'UNDEFINED') {
            newImageStates[whop.id] = { imagePath: '', imageError: true };
            return;
          }

          let normalizedPath = normalizeImagePath(whop.logo);
          
          // If the path is empty or clearly invalid, go straight to InitialsAvatar
          if (!normalizedPath || 
              normalizedPath.trim() === '' ||
              normalizedPath === '/images/.png' || 
              normalizedPath === '/images/undefined.png' ||
              normalizedPath === '/images/Simplified Logo.png' ||
              normalizedPath === '/images/null.png' ||
              normalizedPath === '/images/NULL.png' ||
              normalizedPath === '/images/UNDEFINED.png' ||
              normalizedPath.endsWith('/.png') ||
              normalizedPath.includes('/images/undefined') ||
              normalizedPath.includes('/images/null') ||
              normalizedPath.includes('Simplified Logo')) {
            newImageStates[whop.id] = { imagePath: '', imageError: true };
            return;
          }
          
          newImageStates[whop.id] = { imagePath: normalizedPath, imageError: false };
        });
        
        setImageStates(newImageStates);

        // Log debug info in development (only for API fallback path where data exists)
        if (process.env.NODE_ENV === 'development' && typeof data !== 'undefined' && data?.debug) {
          console.log('🎯 Recommendation Debug:', data.debug);
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
      <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
        <h2 className="text-xl sm:text-2xl font-bold mb-6">Recommended for You</h2>
        <div className="grid grid-cols-1 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="animate-pulse">
              <div className="rounded-lg p-4 border h-24" style={{ backgroundColor: 'var(--background-color)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-center gap-3 h-full">
                  <div className="w-12 h-12 rounded-md bg-gray-300 flex-shrink-0"></div>
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
      </section>
    );
  }

  if (error || recommendations.length === 0) {
    return null; // Don't show anything if there's an error or no recommendations
  }

  // Load alternative logo paths to try
  const getAlternativeLogoPaths = (whopName: string, originalPath: string) => {
    const cleanName = whopName.replace(/[^a-zA-Z0-9]/g, '');
    return [
      `/images/${whopName} Logo.png`,
      `/images/${whopName.replace(/\s+/g, '')} Logo.png`,
      `/images/${cleanName} Logo.png`,
      `/images/${cleanName}Logo.png`,
      '/images/Simplified Logo.png'
    ];
  };

  // Try next image in case of error
  const handleImageError = (whopId: string, whopName: string) => {
    const currentState = imageStates[whopId];
    if (!currentState) return;
    
    const { imagePath } = currentState;
    console.error(`Image failed to load: ${imagePath} for ${whopName}`);
    
    // If the current path has @avif, try without it first
    if (imagePath.includes('@avif')) {
      const pathWithoutAvif = imagePath.replace('@avif', '');
      console.log(`Trying without @avif: ${pathWithoutAvif}`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imagePath: pathWithoutAvif }
      }));
      return;
    }
    
    // If the path looks like a placeholder or default image, go straight to InitialsAvatar
    if (imagePath.includes('Simplified Logo') || 
        imagePath.includes('default') || 
        imagePath.includes('placeholder') ||
        imagePath.includes('no-image') ||
        imagePath.includes('missing')) {
      console.log(`Placeholder detected, showing initials for ${whopName}`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imageError: true }
      }));
      return;
    }
    
    // Get alternative paths
    const alternativePaths = getAlternativeLogoPaths(whopName, imagePath);
    const currentIndex = alternativePaths.indexOf(imagePath);
    
    if (currentIndex < alternativePaths.length - 1) {
      // Try next alternative
      const nextPath = alternativePaths[currentIndex + 1];
      console.log(`Trying alternative path: ${nextPath}`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imagePath: nextPath }
      }));
    } else {
      // All alternatives failed, show initials
      console.log(`All image paths failed for ${whopName}, showing initials`);
      setImageStates(prev => ({
        ...prev,
        [whopId]: { ...prev[whopId], imageError: true }
      }));
    }
  };

  const truncateDescription = (text: string | null, maxLength: number = 100) => {
    if (!text || text.length <= maxLength) return text || '';
    return text.substring(0, maxLength).trim() + '...';
  };

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

  const getCategoryBadge = (category: string | null) => {
    if (!category) return null;
    
    return (
      <span className="text-xs px-2 py-1 rounded-full font-medium mb-2 inline-block" 
            style={{ 
              backgroundColor: 'var(--background-tertiary)', 
              color: 'var(--text-secondary)' 
            }}>
        {category}
      </span>
    );
  };

  return (
    <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold mb-2">Recommended for You</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Similar offers based on your current selection
        </p>
      </div>
      
      {/* Single column layout for better alignment within constrained width */}
      <div className="space-y-4">
        {recommendations.map((whop, index) => (
          <Link 
            key={whop.id} 
            href={`/whop/${whop.slug.toLowerCase()}`}
            className="group block"
            prefetch={index < 2} // Prefetch first 2 for better SEO and performance
          >
            <div className="rounded-lg p-4 border transition-all duration-200 hover:shadow-lg hover:scale-[1.02] group-hover:border-opacity-70" 
                 style={{ 
                   backgroundColor: 'var(--background-color)', 
                   borderColor: 'var(--border-color)',
                   boxShadow: '0 2px 6px rgba(0,0,0,0.08)'
                 }}>
              <div className="flex items-center gap-4">
                {/* Logo Section */}
                <div className="w-12 h-12 rounded-md overflow-hidden flex-shrink-0 bg-gray-800 flex items-center justify-center">
                  {(() => {
                    const imageState = imageStates[whop.id];
                    if (!imageState || imageState.imageError || !imageState.imagePath || imageState.imagePath.trim() === '') {
                      return (
                        <InitialsAvatar 
                          name={whop.name}
                          size="md"
                          shape="square"
                          className="w-full h-full"
                        />
                      );
                    }
                    return (
                      <Image
                        src={imageState.imagePath}
                        alt={`${whop.name} logo`}
                        width={48}
                        height={48}
                        className="w-full h-full object-contain"
                        style={{ maxWidth: '100%', maxHeight: '100%' }}
                        onError={() => handleImageError(whop.id, whop.name)}
                        unoptimized={imageState.imagePath.includes('@avif')}
                        sizes="48px"
                        placeholder="blur"
                        blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAYEBQYFBAYGBQYHBwYIChAKCgkJChQODwwQFxQYGBcUFhYaHSUfGhsjHBYWICwgIyYnKSopGR8tMC0oMCUoKSj/2wBDAQcHBwoIChMKChMoGhYaKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCgoKCj/wAARCAAEAAQDASIAAhEBAxEB/8QAFQABAQAAAAAAAAAAAAAAAAAAAAv/xAAhEAACAQMDBQAAAAAAAAAAAAABAgMABAUGIWGRkqGx0f/EABUBAQEAAAAAAAAAAAAAAAAAAAMF/8QAGhEAAgIDAAAAAAAAAAAAAAAAAAECEgMRkf/aAAwDAQACEQMRAD8AltJagyeH0AthI5xdrLcNM91BF5pX2HaH9bcfaSXWGaRmknyytN5cFrKDsRXSJfAhvT7WinYGCvchOjJAMfNIXGiULZQ8qEzJQdEKKRjFiYqKJKEJxZJXiEH0RRN6mJzN5hJ8tP/Z"
                      />
                    );
                  })()}
                </div>

                {/* Content Section */}
                <div className="flex-1 min-w-0">
                  {/* Category badge */}
                  {getCategoryBadge(whop.category)}
                  
                  {/* Title and Rating */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <h3 className="font-semibold text-sm sm:text-base leading-tight group-hover:opacity-80 transition-opacity line-clamp-2 flex-1" 
                        style={{ color: 'var(--text-color)' }}>
                      {whop.name}
                    </h3>
                    {whop.rating > 0 && (
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <span className="text-yellow-400 text-xs">★</span>
                        <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>
                          {whop.rating.toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>
                  
                  {/* Description */}
                  <p className="text-xs sm:text-sm leading-relaxed line-clamp-2 mb-3" 
                     style={{ color: 'var(--text-secondary)' }}>
                    {truncateDescription(whop.description)}
                  </p>
                  
                  {/* Footer with promo and price */}
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0" 
                          style={{ 
                            backgroundColor: 'var(--accent-color)', 
                            color: 'white' 
                          }}>
                      {getPromoText(whop)}
                    </span>
                    
                    {whop.price && (
                      <span className="
                        order-2 md:order-none
                        basis-full md:basis-auto
                        w-full md:w-auto
                        text-right md:text-left
                        md:ml-auto
                        text-xs font-semibold
                        leading-tight
                        truncate md:whitespace-nowrap
                        max-w-full
                      " 
                            style={{ 
                              color: whop.price === 'Free' ? 'var(--success-color)' : 'var(--text-secondary)' 
                            }}>
                        {whop.price}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
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
    </section>
  );
} 