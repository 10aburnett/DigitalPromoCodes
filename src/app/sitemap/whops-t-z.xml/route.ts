// app/sitemap/whops-t-z.xml/route.ts
import { NextResponse } from 'next/server';
import { generateWhopSitemap, entriesToXML } from '@/lib/sitemap-utils';

/**
 * Whops T-Z Sitemap Shard (Phase F3)
 *
 * Returns a sitemap of all whop pages with slugs starting T-Z.
 * Applies quality gates via whereIndexable().
 */

export const runtime = 'nodejs';
export const dynamic = 'force-static';
export const revalidate = 3600; // 1 hour cache

export async function GET() {
  const entries = await generateWhopSitemap('t', 'z');
  const xml = entriesToXML(entries);

  return new NextResponse(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
