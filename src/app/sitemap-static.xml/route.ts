import { prisma } from '@/lib/prisma';

export async function GET() {
  const baseUrl = 'https://whpcodes.com';
  
  try {
    // Get all legal pages (if they exist)
    let legalPages = [];
    try {
      legalPages = await prisma.legalPage.findMany({
        select: {
          slug: true,
          updatedAt: true
        }
      });
    } catch (error) {
      console.log('No legal pages table found');
    }

    // Static pages
    const staticPages = [
      { url: '', priority: '1.0', changefreq: 'daily' },
      { url: 'blog', priority: '0.8', changefreq: 'weekly' },
      { url: 'subscribe', priority: '0.7', changefreq: 'monthly' },
      { url: 'unsubscribe', priority: '0.4', changefreq: 'monthly' },
      { url: 'about', priority: '0.8', changefreq: 'monthly' },
      { url: 'contact', priority: '0.6', changefreq: 'monthly' },
      { url: 'privacy', priority: '0.5', changefreq: 'yearly' },
      { url: 'terms', priority: '0.5', changefreq: 'yearly' }
    ];

    // Generate sitemap XML for static pages
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages.map(page => `
  <url>
    <loc>${baseUrl}${page.url ? `/${page.url}` : ''}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
  ${legalPages.map(page => `
  <url>
    <loc>${baseUrl}/${page.slug}</loc>
    <lastmod>${page.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.4</priority>
  </url>`).join('')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400' // Cache for 24 hours since static
      }
    });
  } catch (error) {
    console.error('Error generating static sitemap:', error);
    return new Response('Error generating static sitemap', { status: 500 });
  }
}