import { prisma } from '@/lib/prisma';
import { siteOrigin } from '@/lib/site-origin';
import { whereIndexable } from '@/lib/where-indexable';

export default async function sitemap() {
  const origin = siteOrigin();

  const [whops, posts] = await Promise.all([
    prisma.whop.findMany({
      where: whereIndexable(),
      select: { slug: true, updatedAt: true },
      orderBy: { displayOrder: 'asc' },
      take: 5000,
    }),
    prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true, publishedAt: true },
    }),
  ]);

  const staticPages = ['', 'about', 'contact', 'privacy', 'terms'].map(p => ({
    url: `${origin}/${p}`,
    lastModified: new Date(),
    changeFrequency: 'weekly' as const,
    priority: p === '' ? 1 : 0.6,
  }));

  const whopUrls = whops.map(w => ({
    url: `${origin}/whop/${w.slug}`,
    lastModified: w.updatedAt ?? new Date(),
    changeFrequency: 'daily' as const,
    priority: 0.9,
  }));

  const blogUrls = posts.map(p => ({
    url: `${origin}/blog/${p.slug}`,
    lastModified: p.updatedAt ?? p.publishedAt ?? new Date(),
    changeFrequency: 'weekly' as const,
    priority: 0.7,
  }));

  return [...staticPages, ...whopUrls, ...blogUrls];
}
