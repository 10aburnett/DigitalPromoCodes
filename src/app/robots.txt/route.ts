export async function GET() {
  const baseUrl = 'https://whpcodes.com';
  
  const robots = `User-agent: *
Allow: /

# Disallow admin and API routes
Disallow: /admin/
Disallow: /api/
Disallow: /_next/

# Allow important pages
Allow: /about
Allow: /contact
Allow: /privacy
Allow: /terms
Allow: /whop/

# Sitemaps
Sitemap: ${baseUrl}/sitemap.xml
Sitemap: ${baseUrl}/deindex-sitemap

# Crawl delay
Crawl-delay: 1`;

  return new Response(robots, {
    headers: {
      'Content-Type': 'text/plain',
      'Cache-Control': 'public, max-age=86400'
    }
  });
}