// src/components/HomePageServer.tsx
// Server component for homepage - no client state, pure server rendering
import Link from 'next/link';
import WhopCard from '@/components/WhopCard';
import FilterControlsWrapper from '@/components/FilterControlsWrapper';

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
  price?: string | null;
  priceText?: string;
  priceBadge?: string;
}

interface HomePageServerProps {
  items: Whop[];
  currentPage: number;
  totalPages: number;
  total: number;
}

export default function HomePageServer({
  items,
  currentPage,
  totalPages,
  total,
}: HomePageServerProps) {
  const pageHref = (n: number) => `/?page=${n}`;

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);

    // Adjust start page if we're near the end
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(1, endPage - maxVisiblePages + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return pages;
  };

  return (
    <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px] mt-[50px] md:mt-0">
      <h1 className="text-4xl font-bold text-center mt-2 mb-8">
        <span style={{ color: 'var(--accent-color)' }}>WHP</span>
        <span style={{ color: 'var(--text-color)' }}>Codes</span>
        <span style={{ color: 'var(--text-color)' }}> - Whop Promo Codes, Coupons & Discounts</span>
      </h1>

      {/* Client island for search/filters */}
      <FilterControlsWrapper />

      <div className="h-6"></div>

      {/* Results count */}
      {total > 0 && (
        <p className="mb-6 text-center mt-4 md:mt-0" style={{ color: 'var(--text-secondary)' }}>
          Showing {((currentPage - 1) * 15) + 1}-{Math.min(currentPage * 15, total)} of {total} results
        </p>
      )}

      {/* Mobile-only Pagination Controls (Top) */}
      {totalPages > 1 && (
        <div className="md:hidden flex justify-center items-center gap-1 sm:gap-2 mt-4 mb-6 px-2 overflow-x-auto">
          {/* Previous Button */}
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              prefetch={false}
              className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Link>
          ) : (
            <span className="px-3 sm:px-5 py-2.5 rounded-lg border opacity-50 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              aria-disabled="true"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </span>
          )}

          {/* Page Numbers */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {getPageNumbers().map((pageNum) => (
              <Link
                key={pageNum}
                href={pageHref(pageNum)}
                prefetch={false}
                aria-current={pageNum === currentPage ? 'page' : undefined}
                className={`px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base flex-shrink-0 min-w-[36px] sm:min-w-[44px] ${
                  pageNum === currentPage ? 'font-bold' : ''
                }`}
                style={{
                  backgroundColor: pageNum === currentPage ? 'var(--accent-color)' : 'var(--background-secondary)',
                  borderColor: pageNum === currentPage ? 'var(--accent-color)' : 'var(--border-color)',
                  color: pageNum === currentPage ? 'white' : 'var(--text-color)'
                }}
              >
                {pageNum}
              </Link>
            ))}
          </div>

          {/* Next Button */}
          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1)}
              prefetch={false}
              className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </Link>
          ) : (
            <span className="px-3 sm:px-5 py-2.5 rounded-lg border opacity-50 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              aria-disabled="true"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </span>
          )}
        </div>
      )}

      {/* Desktop-only Pagination Controls (Top) */}
      {totalPages > 1 && (
        <div className="hidden md:flex justify-center items-center gap-1 sm:gap-2 mt-4 mb-6 px-2 overflow-x-auto">
          {/* Previous Button */}
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              prefetch={false}
              className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Link>
          ) : (
            <span className="px-3 sm:px-5 py-2.5 rounded-lg border opacity-50 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              aria-disabled="true"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </span>
          )}

          {/* Page Numbers */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {getPageNumbers().map((pageNum) => (
              <Link
                key={pageNum}
                href={pageHref(pageNum)}
                prefetch={false}
                aria-current={pageNum === currentPage ? 'page' : undefined}
                className={`px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base flex-shrink-0 min-w-[36px] sm:min-w-[44px] ${
                  pageNum === currentPage ? 'font-bold' : ''
                }`}
                style={{
                  backgroundColor: pageNum === currentPage ? 'var(--accent-color)' : 'var(--background-secondary)',
                  borderColor: pageNum === currentPage ? 'var(--accent-color)' : 'var(--border-color)',
                  color: pageNum === currentPage ? 'white' : 'var(--text-color)'
                }}
              >
                {pageNum}
              </Link>
            ))}
          </div>

          {/* Next Button */}
          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1)}
              prefetch={false}
              className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </Link>
          ) : (
            <span className="px-3 sm:px-5 py-2.5 rounded-lg border opacity-50 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              aria-disabled="true"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </span>
          )}
        </div>
      )}

      {/* Whop Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        {items.map((whop) => (
          <WhopCard
            key={whop.id}
            promo={{
              id: whop.id,
              whopName: whop.name,
              slug: whop.slug,
              promoType: whop.promoCodes[0]?.type || 'discount',
              promoValue: parseInt(whop.promoCodes[0]?.value || '0'),
              promoText: whop.promoCodes[0]?.title || 'Exclusive Access',
              logoUrl: whop.logo || '',
              promoCode: whop.promoCodes[0]?.code || null,
              affiliateLink: whop.affiliateLink || '',
              isActive: true,
              price: whop.price,
              priceText: whop.priceText,
              priceBadge: whop.priceBadge,
              whopId: whop.id,
              promoCodeId: whop.promoCodes[0]?.id
            }}
          />
        ))}
      </div>
      {/* Pagination Controls (Bottom) */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center gap-1 sm:gap-2 mt-8 mb-8 px-2 overflow-x-auto">
          {/* Previous Button */}
          {currentPage > 1 ? (
            <Link
              href={pageHref(currentPage - 1)}
              prefetch={false}
              className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </Link>
          ) : (
            <span className="px-3 sm:px-5 py-2.5 rounded-lg border opacity-50 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              aria-disabled="true"
            >
              <span className="hidden sm:inline">Previous</span>
              <span className="sm:hidden">Prev</span>
            </span>
          )}

          {/* Page Numbers */}
          <div className="flex items-center gap-1 sm:gap-2 min-w-0">
            {getPageNumbers().map((pageNum) => (
              <Link
                key={pageNum}
                href={pageHref(pageNum)}
                prefetch={false}
                aria-current={pageNum === currentPage ? 'page' : undefined}
                className={`px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base flex-shrink-0 min-w-[36px] sm:min-w-[44px] ${
                  pageNum === currentPage ? 'font-bold' : ''
                }`}
                style={{
                  backgroundColor: pageNum === currentPage ? 'var(--accent-color)' : 'var(--background-secondary)',
                  borderColor: pageNum === currentPage ? 'var(--accent-color)' : 'var(--border-color)',
                  color: pageNum === currentPage ? 'white' : 'var(--text-color)'
                }}
              >
                {pageNum}
              </Link>
            ))}
          </div>

          {/* Next Button */}
          {currentPage < totalPages ? (
            <Link
              href={pageHref(currentPage + 1)}
              prefetch={false}
              className="px-3 sm:px-5 py-2.5 rounded-lg border transition-all duration-200 hover:opacity-80 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </Link>
          ) : (
            <span className="px-3 sm:px-5 py-2.5 rounded-lg border opacity-50 text-sm sm:text-base whitespace-nowrap flex-shrink-0"
              style={{
                backgroundColor: 'var(--background-secondary)',
                borderColor: 'var(--border-color)',
                color: 'var(--text-color)'
              }}
              aria-disabled="true"
            >
              <span className="hidden sm:inline">Next</span>
              <span className="sm:hidden">Next</span>
            </span>
          )}
        </div>
      )}

      {/* No results message */}
      {items.length === 0 && (
        <div className="col-span-full text-center py-12">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No results found
          </p>
        </div>
      )}
    </div>
  );
}
