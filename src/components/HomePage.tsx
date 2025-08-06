'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FilterState } from '@/types/whop';
import WhopCard from '@/components/WhopCard';
import FilterControls from '@/components/FilterControls';
import StatisticsSection from '@/components/StatisticsSection';
import VirtualizedWhopList from '@/components/VirtualizedWhopList';
import { useLanguage } from '@/contexts/LanguageContext';

// Define the types for our data
interface PromoCode {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

interface Whop {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
  rating: number;
  displayOrder: number;
  affiliateLink: string | null;
  promoCodes: PromoCode[];
}

interface PaginationResponse {
  data: any[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasMore: boolean;
  };
}

interface HomePageProps {
  initialWhops: any[];
  initialTotal: number;
  totalUsers: number;
  key?: number;
}

export default function HomePage({ initialWhops, initialTotal, totalUsers, key }: HomePageProps) {
  const { t } = useLanguage();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  
  // Initialize filters from URL parameters - reset completely on key change
  const [filters, setFilters] = useState<FilterState>({
    searchTerm: '',
    promoType: '',
    whopCategory: '',
    whop: '',
    sortBy: ''
  });
  
  const [whops, setWhops] = useState<any[]>(initialWhops);
  const [pagination, setPagination] = useState({
    page: parseInt(searchParams.get('page') || '1'),
    totalPages: Math.ceil(initialTotal / 15),
    total: initialTotal
  });
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);

  // Reset all state when key changes (navigation from admin)
  useEffect(() => {
    if (key !== undefined) {
      setFilters({
        searchTerm: searchParams.get('search') || '',
        promoType: '',
        whopCategory: searchParams.get('whopCategory') || '',
        whop: searchParams.get('whop') || '',
        sortBy: searchParams.get('sortBy') || ''
      });
      setWhops(initialWhops);
      setPagination({
        page: parseInt(searchParams.get('page') || '1'),
        totalPages: Math.ceil(initialTotal / 15),
        total: initialTotal
      });
      setIsInitialized(false);
      setLoading(false);
      
      // Clear any existing timeout
      if (searchTimeout) {
        clearTimeout(searchTimeout);
        setSearchTimeout(null);
      }
    }
  }, [key, searchParams, initialWhops, initialTotal, searchTimeout]);

  // Update URL with current filter and pagination state
  const updateURL = useCallback((newFilters: FilterState, newPage: number = 1) => {
    const params = new URLSearchParams();
    
    // Add filter parameters
    if (newFilters.searchTerm) params.set('search', newFilters.searchTerm);
    if (newFilters.whopCategory) params.set('whopCategory', newFilters.whopCategory);
    if (newFilters.whop) params.set('whop', newFilters.whop);
    if (newFilters.sortBy) params.set('sortBy', newFilters.sortBy);
    if (newPage > 1) params.set('page', newPage.toString());
    
    const newURL = `/${params.toString() ? `?${params.toString()}` : ''}`;
    router.replace(newURL, { scroll: false });
  }, [router]);

  // Fetch whops data with pagination and filters
  const fetchWhops = useCallback(async (page: number = 1, newFilters?: FilterState) => {
    if (loading) return;
    
    setLoading(true);
    
    try {
      const filtersToUse = newFilters || filters;
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15'
      });
      
      // Add filters to params
      if (filtersToUse.searchTerm) params.append('search', filtersToUse.searchTerm);
      if (filtersToUse.whopCategory) params.append('whopCategory', filtersToUse.whopCategory);
      if (filtersToUse.whop) params.append('whop', filtersToUse.whop);
      // Always add sortBy parameter - use 'default' if empty to ensure promo code prioritization
      params.append('sortBy', filtersToUse.sortBy || 'default');
      
      const response = await fetch(`/api/whops?${params.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch whops');
      
      const result: PaginationResponse = await response.json();
      
      console.log(`Fetched page ${page}, got ${result.data.length} whops`);
      
      setWhops(result.data);
      setPagination({
        page: result.pagination.page,
        totalPages: result.pagination.totalPages,
        total: result.pagination.total
      });
      
      // Update URL with current state
      updateURL(filtersToUse, page);
      
    } catch (error) {
      console.error('Error fetching whops:', error);
    } finally {
      setLoading(false);
    }
  }, [filters, loading, pagination.page, updateURL]);

  // Handle filter changes with debouncing for search
  const handleFilterChange = useCallback((newFilters: Partial<FilterState>) => {
    const updatedFilters = { ...filters, ...newFilters };
    setFilters(updatedFilters);
    
    // For search term, add debouncing
    if (newFilters.searchTerm !== undefined) {
    // Clear existing timeout
    if (searchTimeout) {
      clearTimeout(searchTimeout);
    }
    
      // Set new timeout for search
      const timeout = setTimeout(() => {
        fetchWhops(1, updatedFilters);
      }, 300); // 300ms debounce
      
      setSearchTimeout(timeout);
    } else {
      // For other filters (category, sort, etc.), fetch immediately
      fetchWhops(1, updatedFilters);
    }
  }, [filters, router, searchTimeout, fetchWhops]);

  // Handle page changes
  const handlePageChange = (newPage: number) => {
    if (newPage >= 1 && newPage <= pagination.totalPages && !loading) {
      // Scroll to top IMMEDIATELY before any DOM updates
      window.scrollTo({ top: 0, behavior: 'instant' });
      fetchWhops(newPage);
    }
  };

  // Initialize with URL parameters on mount
  useEffect(() => {
    if (!isInitialized) {
      const urlFilters = {
        searchTerm: searchParams.get('search') || '',
        promoType: '',
        whopCategory: searchParams.get('whopCategory') || '',
        whop: searchParams.get('whop') || '',
        sortBy: searchParams.get('sortBy') || ''
      };
      
      const urlPage = parseInt(searchParams.get('page') || '1');
      
      // Check if URL has any filters that differ from initial state
      const hasURLFilters = Object.values(urlFilters).some(value => value !== '') || urlPage > 1;
      
      if (hasURLFilters) {
        setFilters(urlFilters);
        fetchWhops(urlPage, urlFilters);
      }
      
      setIsInitialized(true);
    }
  }, [isInitialized, searchParams, fetchWhops]);

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, pagination.page - Math.floor(maxVisiblePages / 2));
    let endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (searchTimeout) {
        clearTimeout(searchTimeout);
      }
    };
  }, [searchTimeout]);

  return (
    <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
      <h1 className="text-4xl font-bold text-center mt-2 mb-12">
        <span style={{ color: 'var(--accent-color)' }}>WHP</span>
        <span style={{ color: 'var(--text-color)' }}>Codes</span>
        <span style={{ color: 'var(--text-color)' }}> - Whop Promo Codes, Coupons & Discounts</span>
      </h1>
      
      <div className="mb-12" data-filter-section>
        <FilterControls
          filters={filters}
          onFilterChange={handleFilterChange}
          casinos={[]}
        />
      </div>

      {/* Results count */}
      {pagination.total > 0 && (
        <div className="mb-6 text-center" style={{ color: 'var(--text-secondary)' }}>
          Showing {((pagination.page - 1) * 15) + 1}-{Math.min(pagination.page * 15, pagination.total)} of {pagination.total} results
        </div>
      )}

      {/* Mobile-only Pagination Controls (Top) */}
      {pagination.totalPages > 1 && !loading && (
        <div className="md:hidden flex justify-center items-center gap-1 sm:gap-2 mt-4 mb-6 px-2 overflow-x-auto">
          {/* Previous Button */}
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)'
            }}
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base flex-shrink-0 min-w-[36px] sm:min-w-[44px] ${
                  pageNum === pagination.page ? 'font-bold' : ''
                }`}
                style={{ 
                  backgroundColor: pageNum === pagination.page ? 'var(--accent-color)' : 'var(--background-secondary)',
                  borderColor: pageNum === pagination.page ? 'var(--accent-color)' : 'var(--border-color)',
                  color: pageNum === pagination.page ? 'white' : 'var(--text-color)'
                }}
              >
                {pageNum}
              </button>
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)'
            }}
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
          </button>
        </div>
      )}

      {/* Desktop-only Pagination Controls (Top) */}
      {pagination.totalPages > 1 && !loading && (
        <div className="hidden md:flex justify-center items-center gap-1 sm:gap-2 mt-4 mb-6 px-2 overflow-x-auto">
          {/* Previous Button */}
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)'
            }}
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base flex-shrink-0 min-w-[36px] sm:min-w-[44px] ${
                  pageNum === pagination.page ? 'font-bold' : ''
                }`}
                style={{ 
                  backgroundColor: pageNum === pagination.page ? 'var(--accent-color)' : 'var(--background-secondary)',
                  borderColor: pageNum === pagination.page ? 'var(--accent-color)' : 'var(--border-color)',
                  color: pageNum === pagination.page ? 'white' : 'var(--text-color)'
                }}
              >
                {pageNum}
              </button>
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)'
            }}
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
          </button>
        </div>
      )}

      <VirtualizedWhopList whops={whops} loading={loading} />
      
      {/* Loading indicator */}
      {loading && (
        <div className="text-center py-8">
          <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-solid border-r-transparent" style={{ borderColor: 'var(--accent-color)', borderRightColor: 'transparent' }}></div>
          <p className="mt-2" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
        </div>
      )}
      
      {/* Pagination Controls */}
      {pagination.totalPages > 1 && !loading && (
        <div className="flex justify-center items-center gap-1 sm:gap-2 mt-8 mb-8 px-2 overflow-x-auto">
          {/* Previous Button */}
          <button
            onClick={() => handlePageChange(pagination.page - 1)}
            disabled={pagination.page === 1}
            className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)'
            }}
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </button>

          {/* Page Numbers */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {getPageNumbers().map((pageNum) => (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base flex-shrink-0 min-w-[36px] sm:min-w-[44px] ${
                  pageNum === pagination.page ? 'font-bold' : ''
                }`}
                style={{ 
                  backgroundColor: pageNum === pagination.page ? 'var(--accent-color)' : 'var(--background-secondary)',
                  borderColor: pageNum === pagination.page ? 'var(--accent-color)' : 'var(--border-color)',
                  color: pageNum === pagination.page ? 'white' : 'var(--text-color)'
                }}
              >
                {pageNum}
              </button>
            ))}
          </div>

          {/* Next Button */}
          <button
            onClick={() => handlePageChange(pagination.page + 1)}
            disabled={pagination.page === pagination.totalPages}
            className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              borderColor: 'var(--border-color)',
              color: 'var(--text-color)'
            }}
          >
            <span className="hidden sm:inline">Next</span>
            <span className="sm:hidden">Next</span>
          </button>
        </div>
      )}
      
      {/* No results message */}
      {whops.length === 0 && !loading && (
        <div className="col-span-full text-center py-12">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            {t('home.noResults')}
          </p>
        </div>
      )}
    </div>
  );
} 