'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useRef } from 'react';
import FilterControls from '@/components/FilterControls';
import type { FilterState } from '@/types/offer';

export default function FilterControlsWrapper() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const formRef = useRef<HTMLFormElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const DEBOUNCE_MS = 350; // adjust if you want faster/slower

  // Get current filter values from URL
  const filters: FilterState = {
    searchTerm: searchParams.get('search') || '',
    whopCategory: (searchParams.get('whopCategory') || '') as any,
    sortBy: (searchParams.get('sortBy') || 'relevance') as FilterState['sortBy'],
    promoType: '',
    whop: '',
  };

  // Called when user changes filters:
  // - searchTerm: debounce navigation
  // - selects (whopCategory/sortBy): navigate immediately
  const onFilterChange = useCallback((next: Partial<FilterState>) => {
    const params = new URLSearchParams(searchParams.toString());

    // Debounced search
    if (next.searchTerm !== undefined) {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        const current = searchParams.get('search') || '';
        if ((next.searchTerm || '') === current) return; // nothing to do

        if (next.searchTerm) params.set('search', String(next.searchTerm));
        else params.delete('search');
        params.delete('page');
        router.replace(params.toString() ? `/?${params.toString()}` : '/');
      }, DEBOUNCE_MS);
      return;
    }

    // Cancel any pending search debounce when category/sort changes
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    // Category/sort changes navigate immediately
    if (next.whopCategory !== undefined) {
      const current = searchParams.get('whopCategory') || '';
      if (String(next.whopCategory) === current) return; // nothing to do

      next.whopCategory ? params.set('whopCategory', String(next.whopCategory)) : params.delete('whopCategory');
    }

    if (next.sortBy !== undefined) {
      const current = searchParams.get('sortBy') || '';
      if (String(next.sortBy) === current) return; // nothing to do

      next.sortBy ? params.set('sortBy', String(next.sortBy)) : params.delete('sortBy');
    }

    // Reset to page 1 when filters change
    params.delete('page');

    // Navigate with new params
    router.replace(params.toString() ? `/?${params.toString()}` : '/');
  }, [router, searchParams]);

  // Handle form submit (Enter key or button click)
  const onSubmit = useCallback((e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // Cancel any pending debounce and navigate immediately with the submitted value
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
      debounceRef.current = null;
    }

    const form = e.currentTarget;
    const data = new FormData(form);
    const params = new URLSearchParams(searchParams.toString());

    const search = (data.get('search') || '').toString().trim();
    if (search) {
      params.set('search', search);
    } else {
      params.delete('search');
    }

    // Reset to page 1 when search changes
    params.delete('page');

    // Navigate with new params
    router.replace(params.toString() ? `/?${params.toString()}` : '/');
  }, [router, searchParams]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, []);

  return (
    <FilterControls
      formRef={formRef}
      filters={filters}
      onFilterChange={onFilterChange}
      onSubmit={onSubmit}
      casinos={[]}
      submitMode="auto"
    />
  );
}
