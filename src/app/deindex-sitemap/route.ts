import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { siteOrigin } from '@/lib/site-origin';

export async function GET() {
  const baseUrl = siteOrigin();
  try {
    const rows = await prisma.whop.findMany({
      where: { indexingStatus: 'NOINDEX', retirement: 'NONE' },
      select: { locale: true, slug: true, updatedAt: true },
    });

    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...rows.map(r =>
        `<url><loc>${baseUrl}/offer/${r.slug}</loc><lastmod>${(r.updatedAt ?? new Date()).toISOString()}</lastmod></url>`
      ),
      '</urlset>',
    ].join('');

    return new NextResponse(xml, { 
      headers: { 
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300' // 5-minute cache for faster updates
      } 
    });
  } catch (error) {
    console.error('Error generating deindex sitemap:', error);
    // Safe empty sitemap (200) so dev isn't blocked
    const empty = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
    return new NextResponse(empty, { headers: { 'Content-Type': 'application/xml' } });
  }
}