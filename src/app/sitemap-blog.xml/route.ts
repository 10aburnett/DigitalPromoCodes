import { prisma } from '@/lib/prisma';
import { siteOrigin } from '@/lib/site-origin';

export async function GET() {
  const baseUrl = siteOrigin();
  
  try {
    console.log('Generating blog sitemap...');

    // Get all published blog posts
    const blogPosts = await prisma.blogPost.findMany({
      where: { published: true },
      select: {
        slug: true,
        updatedAt: true,
        createdAt: true,
        pinned: true
      },
      orderBy: [
        { pinned: 'desc' },
        { publishedAt: 'desc' }
      ]
    });

    console.log(`Found ${blogPosts.length} published blog posts for sitemap`);

    // Create XML sitemap for blog posts
    const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url>
    <loc>${baseUrl}/blog</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>
  ${blogPosts.map(post => `
  <url>
    <loc>${baseUrl}/blog/${post.slug}</loc>
    <lastmod>${post.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>${post.pinned ? '0.9' : '0.7'}</priority>
  </url>`).join('')}
</urlset>`;

    console.log(`Generated blog sitemap with ${blogPosts.length + 1} URLs (${blogPosts.length} posts + 1 blog index)`);

    return new Response(sitemap, {
      headers: {
        'Content-Type': 'application/xml',
        'Cache-Control': 'public, max-age=3600, s-maxage=3600'
      }
    });

  } catch (error) {
    console.error('Error generating blog sitemap:', error);
    return new Response('Error generating blog sitemap', { status: 500 });
  }
}