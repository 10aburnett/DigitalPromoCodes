import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';

// Production robots.txt for DigitalPromoCodes
// Allows full crawling with sitemap references

export default function robots(): MetadataRoute.Robots {
  const origin = siteOrigin();

  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/admin/', '/api/', '/_next/', '/static/'],
      },
    ],
    sitemap: [
      `${origin}/sitemap.xml`,
      `${origin}/sitemap/whops-a-f.xml`,
      `${origin}/sitemap/whops-g-m.xml`,
      `${origin}/sitemap/whops-n-s.xml`,
      `${origin}/sitemap/whops-t-z.xml`,
      `${origin}/sitemap-blog.xml`,
    ],
  };
}
