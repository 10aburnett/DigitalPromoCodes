'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';
import FilterControls from '@/components/FilterControls';
import { FilterState } from '@/types/whop';

export default function FilterControlsWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Get current filter values from URL
  const filters: FilterState = {
    searchTerm: searchParams.get('search') || '',
    whopCategory: (searchParams.get('whopCategory') || '') as any,
    sortBy: (searchParams.get('sortBy') || '') as FilterState['sortBy'],
    promoType: '',
    whop: '',
  };

  // Handle filter changes by updating URL (GET method for SSR support)
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Update/remove parameters
    if (newFilters.searchTerm !== undefined) {
      if (newFilters.searchTerm) {
        params.set('search', newFilters.searchTerm);
      } else {
        params.delete('search');
      }
    }

    if (newFilters.whopCategory !== undefined) {
      if (newFilters.whopCategory) {
        params.set('whopCategory', newFilters.whopCategory);
      } else {
        params.delete('whopCategory');
      }
    }

    if (newFilters.sortBy !== undefined) {
      if (newFilters.sortBy) {
        params.set('sortBy', newFilters.sortBy);
      } else {
        params.delete('sortBy');
      }
    }

    // Reset to page 1 when filters change
    params.delete('page');

    // Navigate with new params
    const newURL = params.toString() ? `/?${params.toString()}` : '/';
    router.push(newURL);
  }, [router, searchParams]);

  return (
    <FilterControls
      filters={filters}
      onFilterChange={handleFilterChange}
      casinos={[]} // Not used for whops
    />
  );
}
