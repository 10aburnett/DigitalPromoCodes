import { NextResponse } from 'next/server';
import { getNoindexWhops } from '@/lib/data';

export async function GET() {
  try {
    const noindexWhops = await getNoindexWhops(50000); // Large limit for all NOINDEX pages
    
    const xml = [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
      ...noindexWhops
        .filter(whop => !whop.retired) // Don't include retired pages (they return 410)
        .map(whop => 
          `<url><loc>https://whpcodes.com/whop/${whop.slug}</loc><lastmod>${new Date().toISOString()}</lastmod></url>`
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
    return new NextResponse('Error generating deindex sitemap', { status: 500 });
  }
}