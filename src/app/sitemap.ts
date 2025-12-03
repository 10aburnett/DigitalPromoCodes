import type { MetadataRoute } from 'next';
import { siteOrigin } from '@/lib/site-origin';

// Sitemap index for DigitalPromoCodes
// References sub-sitemaps for offers and blog
export default function sitemap(): MetadataRoute.Sitemap {
  const origin = siteOrigin();
  const now = new Date();

  // Main sitemap index with static pages and references to sub-sitemaps
  return [
    // Homepage
    {
      url: origin,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 1.0,
    },
    // Static pages
    {
      url: `${origin}/blog`,
      lastModified: now,
      changeFrequency: 'daily',
      priority: 0.9,
    },
    {
      url: `${origin}/submit-code`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.6,
    },
    {
      url: `${origin}/subscribe`,
      lastModified: now,
      changeFrequency: 'monthly',
      priority: 0.5,
    },
    {
      url: `${origin}/contact`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${origin}/about`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.4,
    },
    {
      url: `${origin}/privacy`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
    {
      url: `${origin}/terms`,
      lastModified: now,
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
