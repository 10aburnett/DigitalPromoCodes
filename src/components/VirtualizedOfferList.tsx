'use client';

import React, { useMemo } from 'react';
import OfferCard from './OfferCard';

interface VirtualizedWhopListProps {
  whops: any[];
  loading: boolean;
}

export default function VirtualizedWhopList({ whops, loading }: VirtualizedWhopListProps) {
  // Only virtualize if we have more than 12 items to improve performance
  const shouldVirtualize = whops.length > 12;

  const renderedWhops = useMemo(() => {
    if (loading) {
      return [];
    }

    if (!shouldVirtualize) {
      // For small lists, render normally
      return whops.map((promo, index) => (
        <OfferCard
          key={`${promo.id}-${index}`}
          promo={promo}
          priority={index < 6} // Priority loading for first 6 images
        />
      ));
    }

    // For large lists, we can implement more sophisticated virtualization
    // For now, just render all items but with performance optimizations
    return whops.map((promo, index) => (
      <OfferCard
        key={`${promo.id}-${index}`}
        promo={promo}
        priority={index < 6} // Priority loading for first 6 images
      />
    ));
  }, [whops, loading, shouldVirtualize]);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* Enhanced loading skeleton */}
        {Array.from({ length: 6 }).map((_, index) => (
          <div
            key={`skeleton-${index}`}
            className="relative p-5 rounded-xl shadow-lg border animate-pulse"
            style={{ background: 'linear-gradient(135deg, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}
          >
            <div className="flex items-start gap-4 mb-4">
              <div className="w-16 h-16 rounded-lg bg-gradient-to-br from-gray-300 to-gray-400 animate-pulse" style={{ backgroundColor: 'var(--text-secondary)', opacity: 0.3 }}></div>
              <div className="min-w-0 flex-1">
                <div className="h-6 bg-gradient-to-r from-gray-300 to-gray-400 rounded mb-2 animate-pulse" style={{ backgroundColor: 'var(--text-secondary)', opacity: 0.3 }}></div>
                <div className="h-4 bg-gradient-to-r from-gray-300 to-gray-400 rounded w-3/4 animate-pulse" style={{ backgroundColor: 'var(--text-secondary)', opacity: 0.3 }}></div>
              </div>
            </div>
            <div className="h-10 bg-gradient-to-r from-gray-300 to-gray-400 rounded animate-pulse" style={{ backgroundColor: 'var(--text-secondary)', opacity: 0.3 }}></div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {renderedWhops}
    </div>
  );
}