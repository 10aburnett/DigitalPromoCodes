'use client';

import Script from 'next/script';
import { useState, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import HomePage from '@/components/HomePage';
import { lazy } from 'react';

// Lazy load non-critical components (SEO-safe only)
const StatisticsSection = lazy(() => import('@/components/StatisticsSection'));
const CallToAction = lazy(() => import('@/components/CallToAction'));

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

interface InitialData {
  whops: Whop[];
  totalUsers: number;
  whopNames: string[];
  totalCount: number;
}

const SearchParamsWrapper = ({ children }: { children: React.ReactNode }) => (
  <div>{children}</div>
);

// Loading component for Suspense
const HomePageLoading = () => (
  <div className="text-center py-20">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent" style={{ borderColor: 'var(--accent-color)', borderRightColor: 'transparent' }}></div>
    <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
  </div>
);

export default function Home() {
  const router = useRouter();
  const [data, setData] = useState<InitialData>({
    whops: [],
    totalUsers: 0,
    whopNames: [],
    totalCount: 0
  });
  const [loading, setLoading] = useState(true);
  const [mountKey, setMountKey] = useState(0);
  const currentYear = new Date().getFullYear();

  // Force re-mount when navigating from admin to ensure clean state
  useEffect(() => {
    const handleNavigation = () => {
      setMountKey(prev => prev + 1);
    };

    // Listen for page visibility changes which can indicate navigation from admin
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        setMountKey(prev => prev + 1);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('focus', handleNavigation);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('focus', handleNavigation);
    };
  }, []);

  useEffect(() => {
    async function fetchInitialData() {
      try {
        // Fetch critical data in parallel for faster loading
        // Use default sorting to ensure promo code whops appear first
        const [whopsResponse, statsResponse] = await Promise.all([
          fetch('/api/whops?page=1&limit=15&sortBy=default'),
          fetch('/api/statistics')
        ]);

        if (!whopsResponse.ok) throw new Error('Failed to fetch whops');
        const whopsResult = await whopsResponse.json();

        let statsResult = { totalUsers: 0 };
        if (statsResponse.ok) {
          statsResult = await statsResponse.json();
        }

        // Fetch whop names separately and non-blocking
        setTimeout(async () => {
          try {
            const allWhopsResponse = await fetch('/api/whops?limit=1000');
            if (allWhopsResponse.ok) {
              const allWhopsResult = await allWhopsResponse.json();
              const whopNames = [...new Set(allWhopsResult.data.map((whop: any) => whop.whopName || whop.name))].filter(Boolean);
              
              setData(prev => ({
                ...prev,
                whopNames: whopNames
              }));
            }
          } catch (error) {
            console.error('Error fetching whop names:', error);
          }
        }, 0);

        setData({
          whops: whopsResult.data,
          totalUsers: statsResult.totalUsers || 0,
          whopNames: [],
          totalCount: whopsResult.pagination.total
        });
      } catch (error) {
        console.error('Error fetching initial data:', error);
        // Set default values on error
        setData({
          whops: [],
          totalUsers: 0,
          whopNames: [],
          totalCount: 0
        });
      } finally {
        setLoading(false);
      }
    }

    fetchInitialData();
  }, [mountKey]); // Re-fetch data when mount key changes

  if (loading) {
    return (
      <main className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
        <HomePageLoading />
      </main>
    );
  }

  return (
    <main className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      {/* Schema.org JSON-LD structured data */}
      <Script id="homepage-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        'name': `WHPCodes - Best Whop Promo Codes ${currentYear}`,
        'description': `Discover the best Whop promo codes and digital product discounts in ${currentYear}. Our expertly curated list includes trusted digital products offering exclusive access, courses, communities, and more.`,
        'url': 'https://whpcodes.com',
        'potentialAction': {
          '@type': 'SearchAction',
          'target': {
            '@type': 'EntryPoint',
            'urlTemplate': 'https://whpcodes.com/?searchTerm={search_term_string}'
          },
          'query-input': 'required name=search_term_string'
        }
      })}} />

      {/* Schema.org JSON-LD structured data for organization */}
      <Script id="organization-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        'name': 'WHPCodes',
        'url': 'https://whpcodes.com',
        'logo': {
          '@type': 'ImageObject',
          'url': 'https://whpcodes.com/logo.png',
          'width': 400,
          'height': 400
        },
        'description': `We review and compare the best Whop promo codes and digital product discounts in ${currentYear}.`,
        'sameAs': [
          'https://twitter.com/whpcodes',
          'https://www.facebook.com/whpcodes'
        ],
        'contactPoint': {
          '@type': 'ContactPoint',
          'contactType': 'customer service',
          'url': 'https://whpcodes.com/contact'
        }
      })}} />

      {/* Schema.org JSON-LD structured data for offers */}
      <Script id="offers-schema" type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        'name': `Best Whop Promo Codes ${currentYear}`,
        'description': `Curated list of the best Whop promo codes and discount codes for ${currentYear}`,
        'numberOfItems': data.totalCount,
        'itemListElement': data.whops.slice(0, 10).map((whop, index) => ({
          '@type': 'ListItem',
          'position': index + 1,
          'item': {
            '@type': 'Product',
            'name': whop.name,
            'description': whop.description,
            'url': `https://whpcodes.com/whop/${whop.slug}`,
            'image': whop.logo,
            'aggregateRating': {
              '@type': 'AggregateRating',
              'ratingValue': whop.rating,
              'bestRating': 5,
              'worstRating': 1
            },
            'offers': whop.promoCodes.map(promo => ({
              '@type': 'Offer',
              'name': promo.title,
              'description': promo.description,
              'url': `https://whpcodes.com/whop/${whop.slug}`,
              'availability': 'https://schema.org/InStock',
              'validFrom': new Date().toISOString(),
              'priceSpecification': {
                '@type': 'PriceSpecification',
                'price': promo.value && promo.value !== '0' ? `${promo.value}% off` : 'Exclusive Access'
              }
            }))
          }
        }))
      })}} />

      {/* Suspense wrapper for HomePage component */}
      <Suspense fallback={<HomePageLoading />}>
        <SearchParamsWrapper>
          <HomePage 
            initialWhops={data.whops}
            initialTotal={data.totalCount}
            whopNames={data.whopNames}
            totalUsers={data.totalUsers}
            key={mountKey}
          />
        </SearchParamsWrapper>
      </Suspense>

      {/* Statistics Section */}
      <Suspense fallback={<div className="py-16 text-center" style={{ color: 'var(--text-secondary)' }}>Loading statistics...</div>}>
        <StatisticsSection />
      </Suspense>

      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
        <div className="mt-24 mb-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full px-6 py-3 mb-6 transition-theme" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-color)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>
                {data.totalUsers > 0 ? (
                  (() => {
                    const roundedUsers = Math.round(data.totalUsers / 10) * 10;
                    return `Trusted by ${roundedUsers >= 1000 ? `${Math.floor(roundedUsers / 1000)}K+` : `${roundedUsers}+`} Users`;
                  })()
                ) : (
                  'Verified Promo Codes'
                )}
              </span>
            </div>
            
            <h2 className="text-4xl md:text-5xl font-bold mb-6 bg-gradient-to-r bg-clip-text text-transparent leading-tight py-2" style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))` }}>
              WHPCodes
            </h2>
            
            <p className="max-w-3xl mx-auto text-lg md:text-xl leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              Discover the best Whop promo codes and digital product discounts. Get exclusive access to premium communities, courses, and digital products at discounted prices.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>Expert Reviews</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Our team thoroughly tests each digital product and promo code to ensure you get the best deals with genuine value and access.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>Exclusive Access</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Get special promo codes and exclusive discounts that you won't find anywhere else, negotiated exclusively for our community.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>Always Updated</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                Our promo code database is updated daily to ensure all offers are current, active, and provide maximum value to users.
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <Suspense fallback={<div className="py-8 text-center" style={{ color: 'var(--text-secondary)' }}>Loading...</div>}>
            <CallToAction />
          </Suspense>
        </div>
      </div>
    </main>
  );
} 