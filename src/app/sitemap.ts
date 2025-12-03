import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';

export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  // Minimal sitemap for domain deindexing - only robots.txt to satisfy XML validation
  return [
    {
      url: `${origin}/robots.txt`,
      lastModified: new Date(),
    },
  ];
}
