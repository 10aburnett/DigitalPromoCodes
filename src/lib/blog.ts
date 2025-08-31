// src/lib/blog.ts
import { prisma } from '@/lib/prisma';

export type BlogListItem = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  publishedAt: Date | null;
  pinned: boolean;
  author: { name: string }; // normalized shape the UI expects
};

export type BlogPostFull = BlogListItem & {
  content: string | null;
  updatedAt: Date | null;
  readingTime?: number;
  headings?: any[];
};

export async function getPublishedBlogPosts(): Promise<BlogListItem[]> {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }],
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      pinned: true,
      authorName: true,                 // scalar fallback
      User: { select: { name: true } }, // use actual relation field, not "author"
    },
  });

  // Normalize to { author: { name } } for UI compatibility
  return posts.map((p) => ({
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? null,
    publishedAt: p.publishedAt ?? null,
    pinned: p.pinned ?? false,
    author: {
      // prefer relation name; fall back to scalar; then to "Unknown"
      name: (p.User?.name ?? p.authorName ?? 'Unknown').trim(),
    },
  }));
}

export async function getBlogPostBySlug(slug: string): Promise<BlogPostFull | null> {
  const post = await prisma.blogPost.findFirst({
    where: { 
      slug: slug,
      published: true 
    },
    select: {
      id: true,
      title: true,
      content: true,
      excerpt: true,
      publishedAt: true,
      updatedAt: true,
      slug: true,
      pinned: true,
      authorName: true,
      User: { select: { name: true } }, // use actual relation field, not "author"
    },
  });

  if (!post) return null;

  return {
    id: post.id,
    title: post.title,
    slug: post.slug,
    excerpt: post.excerpt ?? null,
    publishedAt: post.publishedAt ?? null,
    updatedAt: post.updatedAt ?? null,
    pinned: post.pinned ?? false,
    content: post.content ?? null,
    author: {
      // prefer relation name; fall back to scalar; then to "Unknown"
      name: (post.User?.name ?? post.authorName ?? 'Unknown').trim(),
    },
  };
}