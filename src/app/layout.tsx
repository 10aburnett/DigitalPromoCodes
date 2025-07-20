import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConditionalLayout } from '@/components/ConditionalLayout';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import Script from 'next/script';
import { GA_TRACKING_ID } from '@/lib/analytics';

const inter = Inter({ subsets: ['latin'] });
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

  return {
    title: `Best Whop Promo Codes & Discount Codes ${currentYear} - Exclusive Digital Product Deals`,
    description: `Find verified Whop promo codes, discount codes & coupons for ${currentYear}. Get exclusive access to premium digital products, courses, & communities at discounted prices. Each code updated daily!`,
    keywords: 'whop promo codes, whop discount codes, whop coupons, digital product discounts, community access codes, course promo codes, whop deals, exclusive discounts',
    metadataBase: new URL('https://whpcodes.com'),
    openGraph: {
      title: `Best Whop Promo Codes & Discount Codes ${currentYear} - Exclusive Digital Product Deals`,
      description: `Find verified Whop promo codes, discount codes & coupons for ${currentYear}. Get exclusive access to premium digital products, courses, & communities at discounted prices. Each code updated daily!`,
      url: 'https://whpcodes.com',
      type: 'website',
      siteName: 'WHPCodes',
      images: [
        {
          url: '/logo.png',
          width: 1200,
          height: 630,
          alt: 'WHPCodes - Best Whop Promo Codes & Discount Codes'
        }
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Best Whop Promo Codes & Discount Codes ${currentYear} - Exclusive Digital Product Deals`,
      description: `Find verified Whop promo codes, discount codes & coupons for ${currentYear}. Get exclusive access to premium digital products, courses, & communities at discounted prices. Each code updated daily!`,
      images: ['/logo.png'],
      creator: '@whpcodes',
      site: '@whpcodes'
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    alternates: {
      canonical: 'https://whpcodes.com',
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

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let faviconUrl = '/favicon.ico'; // Default fallback
  
  try {
    faviconUrl = await getFaviconUrl();
  } catch (error) {
    console.error('Error in RootLayout favicon fetch:', error);
    // Use default favicon if there's an error
    faviconUrl = `/favicon.ico?v=${STATIC_VERSION}`;
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6366f1" />
        <meta name="author" content="WHPCodes" />
        <meta name="language" content="en" />
        <meta name="distribution" content="global" />
        <meta name="rating" content="general" />
        <meta name="revisit-after" content="1 days" />
        <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
        <meta property="og:locale" content="en_US" />
        <meta name="geo.region" content="US" />
        <meta name="geo.placename" content="United States" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="//whpcodes.com" />
        <link rel="dns-prefetch" href="//www.googletagmanager.com" />
        <link rel="dns-prefetch" href="//vercel.app" />
        <link rel="preconnect" href="https://vercel.app" />
        <link rel="preload" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" as="style" />
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" media="all" />
        <link rel="preload" href="/logo.png" as="image" />
        <link rel="preload" href="/api/whops?page=1&limit=15" as="fetch" crossOrigin="anonymous" />
        <link rel="preload" href="/api/statistics" as="fetch" crossOrigin="anonymous" />
        {/* Comprehensive favicon setup for all browsers */}
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="icon" type="image/x-icon" href="/favicon.ico" />
        <link rel="icon" type="image/png" sizes="32x32" href="/favicon-32x32.png" />
        <link rel="icon" type="image/png" sizes="16x16" href="/favicon-16x16.png" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <link rel="icon" type="image/png" sizes="192x192" href="/android-chrome-192x192.png" />
        <link rel="icon" type="image/png" sizes="512x512" href="/android-chrome-512x512.png" />
        <meta name="msapplication-TileColor" content="#4285f4" />
        <meta name="theme-color" content="#4285f4" />
        <link rel="manifest" href="/site.webmanifest" />
      </head>
      <body className={`${inter.className} overflow-x-hidden`} style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
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
        
        {/* Google Analytics */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HK4S4718K1"
          strategy="afterInteractive"
        />
        <Script id="google-analytics" strategy="afterInteractive">
          {`
            window.dataLayer = window.dataLayer || [];
            function gtag(){dataLayer.push(arguments);}
            gtag('js', new Date());
            gtag('config', 'G-HK4S4718K1');
          `}
        </Script>
      </body>
    </html>
  );
} 