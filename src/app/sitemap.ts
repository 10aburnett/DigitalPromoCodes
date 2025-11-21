import type { MetadataRoute } from 'next';

export default function sitemap(): MetadataRoute.Sitemap {
  // Minimal sitemap for domain deindexing - only robots.txt to satisfy XML validation
  return [
    {
      url: 'https://whpcodes.com/robots.txt',
      lastModified: new Date(),
    },
  ];
}
