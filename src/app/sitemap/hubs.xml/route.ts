// app/sitemap/hubs.xml/route.ts
import { NextResponse } from 'next/server';
import { unstable_cache } from 'next/cache';
import { entriesToXML, type SitemapEntry } from '@/lib/sitemap-utils';

/**
 * Hubs Sitemap (Phase F3)
 *
 * Returns a sitemap of all static hub pages (home, blog, etc).
 * These are the core marketing/informational pages.
 * Now supports on-demand revalidation via cache tags.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600; // 1 hour cache

async function buildHubsXml(): Promise<string> {
  const baseUrl = process.env.SITE_ORIGIN || 'https://whpcodes.com';
  const now = new Date().toISOString();

  // Define all static hub pages
  const hubPages = [
    { path: '/', changefreq: 'daily' as const, priority: 1.0 },
    { path: '/blog', changefreq: 'daily' as const, priority: 0.9 },
    { path: '/about', changefreq: 'monthly' as const, priority: 0.7 },
    { path: '/contact', changefreq: 'monthly' as const, priority: 0.6 },
    { path: '/privacy', changefreq: 'yearly' as const, priority: 0.5 },
    { path: '/terms', changefreq: 'yearly' as const, priority: 0.5 },
  ];

  const entries: SitemapEntry[] = hubPages.map(page => ({
    url: `${baseUrl}${page.path}`,
    lastmod: now,
    changefreq: page.changefreq,
    priority: page.priority,
  }));

  console.log(`[SITEMAP] Generated ${entries.length} hub entries`);

  return entriesToXML(entries);
}

// Cache + tag so /api/revalidate can refresh hubs xml instantly
const getHubsXmlCached = unstable_cache(
  buildHubsXml,
  ['sitemap:hubs'],
  {
    tags: ['sitemaps', 'sitemap:hubs'],
    revalidate: 3600
  }
);

export async function GET() {
  const xml = await getHubsXmlCached();

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
