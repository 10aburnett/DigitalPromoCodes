import type { Metadata } from 'next';
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConditionalLayout } from '@/components/ConditionalLayout';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import { absoluteUrl } from '@/lib/urls';
import { buildOrgSite } from '@/lib/jsonld';
import JsonLd from '@/components/JsonLd';
import { siteOrigin } from '@/lib/site-origin';
import { SITE_BRAND, SITE_TAGLINE, SITE_DESCRIPTION } from '@/lib/brand';

const currentYear = new Date().getFullYear();

// Use a static version for cache busting to prevent hydration mismatches
const STATIC_VERSION = '1.0.0';

// Cache the favicon fetching for 1 hour with better error handling
const getFaviconUrl = unstable_cache(
  async () => {
    try {
      const settings = await prisma.settings.findFirst();
      const baseUrl = settings?.faviconUrl || '/favicon.ico';
      // Use static version to prevent hydration mismatches
      return `${baseUrl}?v=${STATIC_VERSION}`;
    } catch (error) {
      console.error('Error fetching favicon from settings:', error);
      return `/favicon.ico?v=${STATIC_VERSION}`;
    }
  },
  ['favicon-url'],
  {
    revalidate: 3600, // Cache for 1 hour
    tags: ['favicon']
  }
);

export async function generateMetadata(): Promise<Metadata> {
  let faviconUrl = '/favicon.ico'; // Default fallback

  try {
    faviconUrl = await getFaviconUrl();
  } catch (error) {
    console.error('Error in generateMetadata favicon fetch:', error);
    // Use default favicon if there's an error
    faviconUrl = `/favicon.ico?v=${STATIC_VERSION}`;
  }

  const title = `${SITE_BRAND} - Verified Promo Codes & Exclusive Deals ${currentYear}`;
  const description = `${SITE_DESCRIPTION} Find verified promo codes, discount codes & exclusive offers for ${currentYear}. Updated daily!`;

  return {
    title,
    description,
    keywords: 'promo codes, discount codes, deals, coupons, digital product discounts, community access, course discounts, exclusive offers, verified codes',
    metadataBase: new URL(siteOrigin()),
    openGraph: {
      title,
      description,
      url: siteOrigin(),
      type: 'website',
      siteName: SITE_BRAND,
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          alt: `${SITE_BRAND} - Verified Promo Codes & Exclusive Deals`
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `${SITE_BRAND} - Verified Promo Codes & Exclusive Deals ${currentYear}`,
      description,
      images: ['/logo.png'],
      // Twitter handles removed until new brand accounts exist
    },
    verification: {
      google: 'your-google-verification-code',
    },
    icons: {
      icon: [
        {
          url: faviconUrl,
          type: 'image/svg+xml',
        },
        {
          url: faviconUrl.replace('.svg', '.ico'),
          sizes: '32x32',
          type: 'image/x-icon',
        }
      ],
      shortcut: faviconUrl,
      apple: faviconUrl,
    },
  };
}

export default async function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let faviconUrl = '/favicon.ico'; // Default fallback

  try {
    faviconUrl = await getFaviconUrl();
  } catch (error) {
    console.error('Error in PublicLayout favicon fetch:', error);
    // Use default favicon if there's an error
    faviconUrl = `/favicon.ico?v=${STATIC_VERSION}`;
  }

  // Build Organization + WebSite JSON-LD (SSR only, no DB queries)
  const orgSiteSchema = buildOrgSite({
    org: {
      name: SITE_BRAND,
      url: absoluteUrl(),
      logo: absoluteUrl('/logo.png'),
      // sameAs removed until new brand social accounts exist
    },
    site: {
      name: SITE_BRAND,
      url: absoluteUrl(),
      searchTarget: absoluteUrl('/?search={search_term_string}')
    }
  });

  return (
    <>
      <JsonLd data={orgSiteSchema[0]} />
      <JsonLd data={orgSiteSchema[1]} />
      <AuthProvider>
        <LanguageProvider>
          <ThemeProvider>
            <ConditionalLayout faviconUrl={faviconUrl}>
              {children}
            </ConditionalLayout>
          </ThemeProvider>
        </LanguageProvider>
      </AuthProvider>
      <Toaster position="top-right" />
    </>
  );
}
