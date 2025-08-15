import Script from 'next/script';
import { Suspense } from 'react';
import HomePage from '@/components/HomePage';
import StatisticsSection from '@/components/StatisticsSection';
import CallToAction from '@/components/CallToAction';
import { getTranslation } from '@/lib/i18n';

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

// Server-side data fetching function
async function getInitialData() {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
  
  try {
    // Fetch initial whops data
    const whopsResponse = await fetch(`${baseUrl}/api/whops?page=1&limit=15`, {
      cache: 'no-store'
    });
    
    if (!whopsResponse.ok) {
      console.error('Failed to fetch whops:', whopsResponse.status);
      return {
        initialWhops: [],
        totalUsers: 0,
        whopNames: [],
        totalCount: 0
      };
    }
    
    const whopsResult: PaginationResponse = await whopsResponse.json();

    // Fetch statistics for total users
    const statsResponse = await fetch(`${baseUrl}/api/statistics`, {
      cache: 'no-store'
    });
    
    if (!statsResponse.ok) {
      console.error('Failed to fetch statistics:', statsResponse.status);
      return {
        initialWhops: whopsResult.data,
        totalUsers: 0,
        whopNames: [],
        totalCount: whopsResult.pagination.total
      };
    }
    
    const statsResult = await statsResponse.json();

    // Fetch all whop names for filtering
    const allWhopsResponse = await fetch(`${baseUrl}/api/whops?limit=1000`, {
      cache: 'no-store'
    });
    
    if (!allWhopsResponse.ok) {
      console.error('Failed to fetch all whops:', allWhopsResponse.status);
      return {
        initialWhops: whopsResult.data,
        totalUsers: statsResult.totalUsers || 0,
        whopNames: [],
        totalCount: whopsResult.pagination.total
      };
    }
    
    const allWhopsResult: PaginationResponse = await allWhopsResponse.json();
    const whopNames = [...new Set(allWhopsResult.data.map((whop: any) => whop.whopName || whop.name))].filter(Boolean);

    return {
      initialWhops: whopsResult.data,
      totalUsers: statsResult.totalUsers || 0,
      whopNames: whopNames as string[],
      totalCount: whopsResult.pagination.total
    };
  } catch (error) {
    console.error('Error in getInitialData:', error);
    return {
      initialWhops: [],
      totalUsers: 0,
      whopNames: [],
      totalCount: 0
    };
  }
}

// Loading component for Suspense
const HomePageLoading = () => (
  <div className="text-center py-20">
    <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-r-transparent" style={{ borderColor: 'var(--accent-color)', borderRightColor: 'transparent' }}></div>
    <p className="mt-4 text-lg" style={{ color: 'var(--text-secondary)' }}>Loading...</p>
  </div>
);

export const runtime = "nodejs";

// Generate static params for all supported locales
export function generateStaticParams() {
  return ["en","es","nl","fr","de","it","pt","zh"].map((locale) => ({ locale }));
}

export default async function LocalizedHome({ params }: { params: { locale: string } }) {
  const { initialWhops, totalUsers, whopNames, totalCount } = await getInitialData();
  const currentYear = new Date().getFullYear();
  const locale = params.locale as any; // Type assertion for i18n

  // Create unique key for this locale to ensure proper remounting
  const pageKey = params.locale.length + params.locale.charCodeAt(0);

  return (
    <main key={pageKey} className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
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
        'logo': '/logo.png',
        'description': `We review and compare the best Whop promo codes and digital product discounts in ${currentYear}.`,
        'sameAs': [
          'https://twitter.com/whpcodes',
          'https://www.facebook.com/whpcodes'
        ]
      })}} />

      {/* Client-side interactive homepage component with Suspense */}
      <Suspense fallback={<HomePageLoading />}>
        <HomePage 
          key={pageKey}
          initialWhops={initialWhops}
          initialTotal={totalCount}
          totalUsers={totalUsers}
        />
      </Suspense>

      {/* Statistics Section */}
      <StatisticsSection />

      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1280px]">
        <div className="mt-24 mb-16">
          {/* Hero Section */}
          <div className="text-center mb-16">
            <div className="inline-flex items-center gap-2 rounded-full px-6 py-3 mb-6 transition-theme" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', border: '1px solid rgba(99, 102, 241, 0.2)' }}>
              <div className="w-2 h-2 rounded-full animate-pulse" style={{ backgroundColor: 'var(--accent-color)' }}></div>
              <span className="text-sm font-medium" style={{ color: 'var(--accent-color)' }}>
                {totalUsers > 0 ? (
                  (() => {
                    const roundedUsers = Math.round(totalUsers / 10) * 10;
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
              {getTranslation('home.subtitle', locale)}
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
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>{getTranslation('home.expertReviews', locale)}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {getTranslation('home.expertReviewsDesc', locale)}
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                {/* Key icon for Exclusive Access - ensuring exact match with English version */}
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1721 9z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>{getTranslation('home.exclusiveAccess', locale)}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {getTranslation('home.exclusiveAccessDesc', locale)}
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center" style={{ backgroundColor: 'var(--accent-color)' }}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--text-color)' }}>{getTranslation('home.alwaysUpdated', locale)}</h3>
              <p style={{ color: 'var(--text-secondary)' }}>
                {getTranslation('home.alwaysUpdatedDesc', locale)}
              </p>
            </div>
          </div>

          {/* Call to Action */}
          <Suspense fallback={<div>Loading...</div>}>
            <CallToAction />
          </Suspense>
        </div>
      </div>
    </main>
  );
} 