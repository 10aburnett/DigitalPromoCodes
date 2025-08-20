import { prisma } from '@/lib/prisma';

const WHOPS_PER_SITEMAP = 1000; // Reasonable chunk size

// Force dynamic rendering since we can't know all pages at build time
export const dynamic = 'force-dynamic';

export async function GET(request: Request, { params }: { params: { page: string } }) {
  const baseUrl = 'https://whpcodes.com';
  const page = parseInt(params?.page || '1') || 1;
  
  try {
    // Calculate offset for pagination
    const skip = (page - 1) * WHOPS_PER_SITEMAP;
    
    // Get paginated indexable whops only
    const whops = await prisma.whop.findMany({
      where: { indexingStatus: 'INDEX', retirement: 'NONE' },
      select: {
        slug: true,
        locale: true,
        updatedAt: true
      },
      skip,
      take: WHOPS_PER_SITEMAP,
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`Sitemap page ${page}: Found ${whops.length} whops (skip: ${skip})`);

    // Generate sitemap XML for this page
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  ${whops.map(whop => `
  <url>
    <loc>${baseUrl}/whop/${whop.slug}</loc>
    <lastmod>${whop.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('')}
</urlset>`;

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=300, s-maxage=300'  // Reduced cache for faster updates
      }
    });
  } catch (error) {
    console.error(`Error generating sitemap page ${page}:`, error);
    // Safe empty sitemap (200) so dev isn't blocked
    const empty = `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`;
    return new Response(empty, { headers: { 'Content-Type': 'application/xml' } });
  }
}