// app/sitemap.xml/route.ts
import { NextResponse } from 'next/server';
import { siteOrigin } from '@/lib/site-origin';

/**
 * Sitemap Index (Phase F1)
 *
 * Returns a sitemap index XML that references all shard sitemaps.
 * This is the main entry point that search engines will crawl.
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600; // 1 hour cache

export async function GET() {
  const baseUrl = siteOrigin();
  const now = new Date().toISOString();

  // List of all sitemap shards
  const sitemaps = [
    `${baseUrl}/sitemap/hubs.xml`,
    `${baseUrl}/sitemap/whops-a-f.xml`,
    `${baseUrl}/sitemap/whops-g-m.xml`,
    `${baseUrl}/sitemap/whops-n-s.xml`,
    `${baseUrl}/sitemap/whops-t-z.xml`,
  ];

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemaps.map(url => `  <sitemap>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
