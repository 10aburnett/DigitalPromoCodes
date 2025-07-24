'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { normalizeImagePath } from '@/lib/image-utils';
import InitialsAvatar from './InitialsAvatar';

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
  currentWhopId: string;
}

export default function RecommendedWhops({ currentWhopId }: RecommendedWhopsProps) {
  const [recommendations, setRecommendations] = useState<RecommendedWhop[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchRecommendations = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/whops/${currentWhopId}/recommendations`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch recommendations');
        }
        
        const data = await response.json();
        
        // Clean up the recommendations data to match our interface
        const cleanedRecommendations = (data.recommendations || []).map((rec: any) => {
          // Remove the similarityScore property for clean display
          const { similarityScore, ...cleanRec } = rec;
          return cleanRec;
        });
        
        setRecommendations(cleanedRecommendations);
        
        // Log debug info in development
        if (process.env.NODE_ENV === 'development' && data.debug) {
          console.log('🎯 Recommendation Debug:', data.debug);
        }
      } catch (err) {
        console.error('Error fetching recommendations:', err);
        setError('Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    if (currentWhopId) {
      fetchRecommendations();
    }
  }, [currentWhopId]);

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
            href={`/whop/${whop.slug}`}
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
                  {whop.logo ? (
                    <Image
                      src={normalizeImagePath(whop.logo)}
                      alt={`${whop.name} logo`}
                      width={48}
                      height={48}
                      className="w-full h-full object-contain"
                      style={{ maxWidth: '100%', maxHeight: '100%' }}
                      onError={(e) => {
                        // Simple @avif fallback - try without @avif suffix
                        const currentSrc = (e.target as HTMLImageElement).src;
                        if (currentSrc.includes('@avif')) {
                          (e.target as HTMLImageElement).src = currentSrc.replace('@avif', '');
                        }
                      }}
                    />
                  ) : (
                    <InitialsAvatar 
                      name={whop.name}
                      size="md"
                      shape="square"
                      className="w-full h-full"
                    />
                  )}
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
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full flex-shrink-0" 
                          style={{ 
                            backgroundColor: 'var(--accent-color)', 
                            color: 'white' 
                          }}>
                      {getPromoText(whop)}
                    </span>
                    
                    {whop.price && (
                      <span className="text-xs font-semibold flex-shrink-0" 
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