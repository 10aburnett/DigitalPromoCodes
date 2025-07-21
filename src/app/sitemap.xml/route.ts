import { prisma } from '@/lib/prisma';

const WHOPS_PER_SITEMAP = 1000; // Reasonable chunk size

export async function GET() {
  const baseUrl = 'https://whpcodes.com';
  
  try {
    // Count total published whops
    const totalWhops = await prisma.whop.count({
      where: {
        publishedAt: { not: null }
      }
    });

    console.log(`Sitemap Index: Found ${totalWhops} published whops`);

    // Calculate number of sitemap pages needed
    const totalPages = Math.ceil(totalWhops / WHOPS_PER_SITEMAP);

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
      { url: 'about', priority: '0.8', changefreq: 'monthly' },
      { url: 'contact', priority: '0.6', changefreq: 'monthly' },
      { url: 'privacy', priority: '0.5', changefreq: 'yearly' },
      { url: 'terms', priority: '0.5', changefreq: 'yearly' }
    ];

    // If we have more than 1000 URLs total, use sitemap index
    if (totalWhops > 1000) {
      console.log(`Using sitemap index with ${totalPages} pages`);
      
      // Generate sitemap index XML
      const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
  ${Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `
  <sitemap>
    <loc>${baseUrl}/sitemap-${page}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('')}
</sitemapindex>`;

      return new Response(sitemapIndex, {
        headers: {
          'Content-Type': 'application/xml',
          'Cache-Control': 'public, max-age=3600, s-maxage=3600'
        }
      });
    } else {
      // Small site - use single sitemap
      const whops = await prisma.whop.findMany({
        where: {
          publishedAt: { not: null }
        },
        select: {
          slug: true,
          updatedAt: true
        }
      });

      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${staticPages.map(page => `
  <url>
    <loc>${baseUrl}${page.url ? `/${page.url}` : ''}</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('')}
  ${whops.map(whop => `
  <url>
    <loc>${baseUrl}/whop/${whop.slug}</loc>
    <lastmod>${whop.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
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
          'Cache-Control': 'public, max-age=3600, s-maxage=3600'
        }
      });
    }
  } catch (error) {
    console.error('Error generating sitemap:', error);
    return new Response('Error generating sitemap', { status: 500 });
  }
}