import React from 'react';
import { FilterState, WhopCategory, getCategoryLabel } from '@/types/whop';

interface FilterControlsProps {
  filters: FilterState;
  onFilterChange: (filters: Partial<FilterState>) => void;
  casinos: string[];
  className?: string;
  formRef?: React.RefObject<HTMLFormElement>;
  onSubmit?: (e: React.FormEvent<HTMLFormElement>) => void;
  submitMode?: 'manual' | 'auto';
}

// All available categories in a logical order
const WHOP_CATEGORIES: WhopCategory[] = [
  'TRADING',
  'AI', 
  'SOCIAL_MEDIA',
  'SPORTS_BETTING',
  'BUSINESS',
  'ECOMMERCE',
  'GAMING',
  'PERSONAL_DEVELOPMENT',
  'PERSONAL_FINANCE',
  'RESELLING',
  'CAREERS',
  'FITNESS',
  'RECREATION',
  'COMPUTER_SCIENCE',
  'REAL_ESTATE',
  'DATING',
  'TRAVEL',
  'LANGUAGES',
  'OTHER'
];

export default function FilterControls({
  filters,
  onFilterChange,
  casinos,
  className = '',
  formRef,
  onSubmit,
  submitMode = 'auto'
}: FilterControlsProps) {
  const dropdownStyle = {
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%238b8c98'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`,
    backgroundRepeat: 'no-repeat',
    backgroundPosition: 'right 12px center',
    backgroundSize: '16px'
  };

  return (
    <form
      ref={formRef}
      onSubmit={onSubmit}
      method="GET"
      action="/"
      className={`w-full max-w-2xl mx-auto ${className}`}
    >
      {/* Desktop view - horizontal layout */}
      <div className="hidden sm:flex gap-3">
        {/* Search Bar */}
        <div className="relative flex-1">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor"
              className="w-5 h-5" style={{ color: 'var(--text-muted)' }}>
              <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
            </svg>
          </div>
          <input
            id="main-search-input"
            name="search"
            type="search"
            placeholder="Search courses..."
            defaultValue={filters.searchTerm}
            onChange={submitMode === 'auto' ? (e) => onFilterChange({ searchTerm: e.target.value }) : undefined}
            className="w-full pl-12 pr-4 h-12 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
            style={{
              backgroundColor: 'var(--background-secondary)',
              color: 'var(--text-color)'
            }}
          />
        </div>

        {/* Category Dropdown */}
        <select
          value={filters.whopCategory}
          onChange={(e) => onFilterChange({ whopCategory: e.target.value as WhopCategory | '' })}
          className="h-12 px-4 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none pr-10 min-w-[180px]"
          style={{ 
            backgroundColor: 'var(--background-secondary)', 
            color: 'var(--text-color)',
            ...dropdownStyle
          }}
        >
          <option value="">All Categories</option>
          {WHOP_CATEGORIES.map(category => (
            <option key={category} value={category}>
              {getCategoryLabel(category)}
            </option>
          ))}
        </select>

        {/* Sort Dropdown */}
        <select
          value={filters.sortBy}
          onChange={(e) => onFilterChange({ sortBy: e.target.value as FilterState['sortBy'] })}
          className="h-12 px-4 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none pr-10 min-w-[160px]"
          style={{ 
            backgroundColor: 'var(--background-secondary)', 
            color: 'var(--text-color)',
            ...dropdownStyle
          }}
        >
          <option value="">Sort By</option>
          <option value="newest">Newest Added</option>
          <option value="highest-rated">Highest Rated</option>
          <option value="highest">Highest Value</option>
          <option value="lowest">Lowest Value</option>
          <option value="alpha-asc">A-Z</option>
          <option value="alpha-desc">Z-A</option>
        </select>
      </div>

      {/* Mobile view - vertical layout */}
      <div className="sm:hidden flex flex-col gap-1 md:gap-3">
        {/* Search Bar - Full width on mobile */}
        <div className="w-full">
          <div className="relative">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" 
                className="w-5 h-5" style={{ color: 'var(--text-muted)' }}>
                <path fillRule="evenodd" d="M9 3.5a5.5 5.5 0 100 11 5.5 5.5 0 000-11zM2 9a7 7 0 1112.452 4.391l3.328 3.329a.75.75 0 11-1.06 1.06l-3.329-3.328A7 7 0 012 9z" clipRule="evenodd" />
              </svg>
            </div>
            <input
              id="main-search-input-mobile"
              name="search"
              type="search"
              placeholder="Search courses..."
              defaultValue={filters.searchTerm}
              onChange={submitMode === 'auto' ? (e) => onFilterChange({ searchTerm: e.target.value }) : undefined}
              className="w-full pl-12 pr-4 h-12 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all"
              style={{
                backgroundColor: 'var(--background-secondary)',
                color: 'var(--text-color)'
              }}
            />
          </div>
        </div>

        {/* Filter Controls - Row on desktop, stack on mobile */}
        <div className="flex flex-col gap-1 md:gap-3">
          {/* Category Dropdown */}
          <select
            value={filters.whopCategory}
            onChange={(e) => onFilterChange({ whopCategory: e.target.value as WhopCategory | '' })}
            className="h-12 px-4 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none pr-10 w-full"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              color: 'var(--text-color)',
              ...dropdownStyle
            }}
          >
            <option value="">All Categories</option>
            {WHOP_CATEGORIES.map(category => (
              <option key={category} value={category}>
                {getCategoryLabel(category)}
              </option>
            ))}
          </select>

          {/* Sort Dropdown */}
          <select
            value={filters.sortBy}
            onChange={(e) => onFilterChange({ sortBy: e.target.value as FilterState['sortBy'] })}
            className="h-12 px-4 rounded-xl border-0 focus:outline-none focus:ring-1 focus:ring-blue-500 transition-all appearance-none pr-10 w-full"
            style={{ 
              backgroundColor: 'var(--background-secondary)', 
              color: 'var(--text-color)',
              ...dropdownStyle
            }}
          >
            <option value="">Sort By</option>
            <option value="newest">Newest Added</option>
            <option value="highest-rated">Highest Rated</option>
            <option value="highest">Highest Value</option>
            <option value="lowest">Lowest Value</option>
            <option value="alpha-asc">A-Z</option>
            <option value="alpha-desc">Z-A</option>
          </select>
        </div>
      </div>
    </form>
  );
} 