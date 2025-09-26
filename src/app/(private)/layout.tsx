import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import '../globals.css';
import { AuthProvider } from "@/components/AuthProvider";
import { Toaster } from "react-hot-toast";
import { LanguageProvider } from '@/contexts/LanguageContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { ConditionalLayout } from '@/components/ConditionalLayout';
import { prisma } from '@/lib/prisma';
import { unstable_cache } from 'next/cache';
import Script from 'next/script';

const inter = Inter({
  subsets: ['latin'],
  display: 'swap',
  preload: true,
  fallback: ['system-ui', 'arial']
});

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

  // Private/admin pages: noindex, nofollow, no schema markup
  return {
    title: 'Admin - WHPCodes',
    robots: {
      index: false,
      follow: false,
      noarchive: true,
      nosnippet: true,
      noimageindex: true,
      googleBot: {
        index: false,
        follow: false,
        'max-image-preview': 'none',
        'max-snippet': 0,
        'max-video-preview': 0,
      },
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

export default async function PrivateLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  let faviconUrl = '/favicon.ico'; // Default fallback

  try {
    faviconUrl = await getFaviconUrl();
  } catch (error) {
    console.error('Error in PrivateLayout favicon fetch:', error);
    // Use default favicon if there's an error
    faviconUrl = `/favicon.ico?v=${STATIC_VERSION}`;
  }

  return (
    <html lang="en">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#6366f1" />
        {/* Private/admin routes: explicit noindex */}
        <meta name="robots" content="noindex, nofollow, noarchive, nosnippet, noimageindex" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <script dangerouslySetInnerHTML={{__html: `
          (function() {
            const savedTheme = localStorage.getItem('theme');
            const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            let initialTheme = 'light'; // Default to light for faster rendering

            if (savedTheme === 'dark' || (savedTheme === 'system' && systemPrefersDark)) {
              initialTheme = 'dark';
            }

            document.documentElement.setAttribute('data-theme', initialTheme);
            document.documentElement.classList.add(initialTheme);
          })();
        `}} />
        <style dangerouslySetInnerHTML={{__html: `
          :root {
            --font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
            --theme-transition: background-color 0.3s ease, color 0.3s ease, border-color 0.3s ease;
            --border-radius-large: 12px;
            --btn-border-radius: 6px;
            --card-spacing: 30px;
            --background-color: #ffffff;
            --background-secondary: #f8fafc;
            --background-tertiary: #e2e8f0;
            --container-color: #f8fafc;
            --text-color: #1e293b;
            --text-secondary: #64748b;
            --text-muted: #94a3b8;
            --accent-color: #3b82f6;
            --accent-hover: #2563eb;
            --success-color: #059669;
            --warning-color: #d97706;
            --error-color: #dc2626;
            --border-color: #e2e8f0;
            --shadow-color: rgba(0, 0, 0, 0.1);
            --menu-item-color: #64748b;
            --header-shadow: 2px 0 3px 0 #00000015;
            --promo-bg: #ffffff;
            --promo-bg-gradient: linear-gradient(45deg, #ffffff, #f8fafc);
            --promo-border: 1px solid #e2e8f0;
            --promo-shadow: 0 0 4px 0 #0000000d;
            --card-bg: #ffffff;
            --card-border: #e2e8f0;
            --input-bg: #ffffff;
            --input-border: #d1d5db;
            --input-focus: #3b82f6;
          }
          [data-theme="dark"] {
            --background-color: #1a1b23;
            --background-secondary: #2a2d3a;
            --background-tertiary: #3f4451;
            --container-color: #2a2d3a;
            --text-color: #f1f1f1;
            --text-secondary: #a4a5b0;
            --text-muted: #6b7280;
            --accent-color: #6366f1;
            --accent-hover: #5855eb;
            --success-color: #68D08B;
            --warning-color: #f59e0b;
            --error-color: #dc2626;
            --border-color: #3f4451;
            --shadow-color: rgba(0, 0, 0, 0.1);
            --menu-item-color: #a7a9b4;
            --header-shadow: 2px 0 3px 0 #00000085;
            --promo-bg: #2a2d3a;
            --promo-bg-gradient: linear-gradient(45deg, #2a2d3a, #1f2937);
            --promo-border: 1px solid #3f4451;
            --promo-shadow: 0 0 4px 0 #0f0f14ad;
            --card-bg: #2a2d3a;
            --card-border: #3f4451;
            --input-bg: #3e4050;
            --input-border: #404055;
            --input-focus: #68D08B;
          }
          * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
          }
          html {
            transition: var(--theme-transition);
          }
          body {
            font-family: var(--font-family);
            background-color: var(--background-color);
            color: var(--text-color);
            line-height: 1.6;
            overflow-x: hidden;
            display: flex;
            flex-direction: column;
            min-height: 100vh;
            transition: var(--theme-transition);
          }
          .container {
            max-width: 1200px;
            margin: 0 auto;
            padding: 0 1rem;
          }
          @media (max-width: 640px) {
            .container {
              padding: 0 0.5rem;
            }
          }
        `}} />

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

        {/* NO JSON-LD SCHEMA MARKUP ON PRIVATE/ADMIN ROUTES */}
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

        {/* Google Analytics - Deferred */}
        <Script
          src="https://www.googletagmanager.com/gtag/js?id=G-HK4S4718K1"
          strategy="lazyOnload"
        />
        <Script id="google-analytics" strategy="lazyOnload">
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