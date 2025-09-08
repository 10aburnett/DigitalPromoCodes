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

export type AdminPost = {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  published: boolean;
  pinned: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  author: { id: string | null; name: string };
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
      // prefer scalar authorName; fall back to relation name; then to "Unknown"
      name: (p.authorName ?? p.User?.name ?? 'Unknown').trim(),
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
      // prefer scalar authorName; fall back to relation name; then to "Unknown"
      name: (post.authorName ?? post.User?.name ?? 'Unknown').trim(),
    },
  };
}

function normalize(p: any): AdminPost {
  return {
    id: p.id,
    title: p.title,
    slug: p.slug,
    excerpt: p.excerpt ?? null,
    published: !!p.published,
    pinned: !!p.pinned,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
    // prefer scalar authorName; fall back to relation User name
    author: { id: p.authorId ?? null, name: (p.authorName ?? p.User?.name ?? "Admin").trim() },
  };
}

/** Return ALL posts for admin (drafts + published). No filters by default. */
export async function getAdminBlogPosts(opts?: { page?: number; limit?: number }) {
  const page = Math.max(1, opts?.page ?? 1);
  const limit = Math.min(100, Math.max(1, opts?.limit ?? 50));

  const [total, rows] = await prisma.$transaction([
    prisma.blogPost.count(),
    prisma.blogPost.findMany({
      orderBy: [{ pinned: "desc" }, { publishedAt: "desc" }, { createdAt: "desc" }],
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        published: true,
        pinned: true,
        publishedAt: true,
        createdAt: true,
        updatedAt: true,
        authorId: true,
        authorName: true,
        User: { select: { id: true, name: true } }, // relation is User
      },
    }),
  ]);

  const items = rows.map(normalize);
  return { ok: true as const, page, limit, total, items };
}