// src/app/api/admin/blog/route.ts
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/* ---------- helpers ---------- */
const BodySchema = z.object({
  title: z.string().min(3),
  slug: z.string().min(3).regex(/^[a-z0-9-]+$/),
  excerpt: z.string().optional().nullable(),
  content: z.any().optional().nullable(),
  published: z.boolean().default(false),
  pinned: z.boolean().default(false),
  authorName: z.string().optional(),
  authorId: z.string().optional(),
});

const slugify = (s: string) =>
  s.toLowerCase().trim().replace(/['"]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');

const toBool = (v: unknown): boolean | undefined => {
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string') {
    const s = v.toLowerCase().trim();
    if (['true','1','on','yes'].includes(s)) return true;
    if (['false','0','off','no',''].includes(s)) return false;
  }
  return undefined;
};

async function readBody(req: Request): Promise<Record<string, any>> {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) return req.json();
  if (ct.includes('multipart/form-data')) {
    const fd = await req.formData(); const o: Record<string, any> = {};
    fd.forEach((v, k) => { if (typeof v === 'string') o[k] = v; });
    return o;
  }
  return req.json();
}

export async function GET(req: Request) {
  // Auth using correct import path
  try {
    const adminUser = await verifyAdminToken();
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch (e) {
    console.error('verifyAdminToken failed:', e);
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const page  = Math.max(1, parseInt(searchParams.get('page')  || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(searchParams.get('limit') || '50', 10)));

    const [total, rows] = await prisma.$transaction([
      prisma.blogPost.count(),
      prisma.blogPost.findMany({
        orderBy: [{ pinned: 'desc' }, { publishedAt: 'desc' }, { createdAt: 'desc' }],
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
          authorName: true,
        },
      }),
    ]);

    const items = rows.map(p => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      excerpt: p.excerpt ?? null,
      published: !!p.published,
      pinned: !!p.pinned,
      publishedAt: p.publishedAt ? p.publishedAt.toISOString() : null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
      author: { id: null, name: (p.authorName ?? 'Admin').trim() },
    }));

    // ultra-compatible payload (covers most client shapes)
    return NextResponse.json(
      {
        ok: true,
        page, limit,
        total, count: total, length: items.length,
        items,               // common
        posts: items,        // some code uses posts
        rows: items,         // some code uses rows
        list: items,         // some code uses list
        results: items,      // some code uses results
        data: items,         // some fetchers expect data = array
        payload: { items },  // some expect data.items or payload.items
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    console.error('GET /api/admin/blog failed:', err);
    return NextResponse.json({ error: 'Failed to fetch posts' }, { status: 500 });
  }
}

/* ======================= POST (create) ======================= */
export async function POST(req: Request) {
  const adminUser = await verifyAdminToken();
  if (!adminUser || adminUser.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const raw = await readBody(req);
    const pre: Record<string, any> = { ...raw };

    const pb = toBool(pre.published); if (pb !== undefined) pre.published = pb;
    const pn = toBool(pre.pinned);    if (pn !== undefined) pre.pinned    = pn;

    if (pre.slug) pre.slug = slugify(String(pre.slug));
    else if (pre.title) pre.slug = slugify(String(pre.title));

    const body = BodySchema.parse(pre);

    const dup = await prisma.blogPost.findFirst({ where: { slug: body.slug } });
    if (dup) return NextResponse.json({ error: 'Slug already exists', code: 'SLUG_EXISTS' }, { status: 409 });

    const now = new Date();
    const data: any = {
      id: randomUUID(), // ✅ Required by production DB
      title: body.title,
      slug: body.slug,
      excerpt: body.excerpt ?? null,
      content: body.content ?? null,
      published: body.published ?? false,
      publishedAt: body.published ? now : null,
      pinned: body.pinned ?? false,
      pinnedAt: body.pinned ? now : null,
      authorName: body.authorName ?? adminUser.name ?? 'Admin',
      createdAt: now,
      updatedAt: now, // ✅ Required by production DB
    };

    // Optional FK: only set if it truly exists (prevents P2003)
    const authorId = typeof body.authorId === 'string' ? body.authorId.trim() : undefined;
    if (authorId) {
      const exists = await prisma.user.count({ where: { id: authorId } });
      if (exists) data.authorId = authorId;
    } else {
      // fallback to authenticated admin user if they exist
      const exists = await prisma.user.count({ where: { id: adminUser.id } });
      if (exists) data.authorId = adminUser.id;
    }

    const post = await prisma.blogPost.create({ data });
    return NextResponse.json({ ok: true, post }, { status: 201 });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: 'Validation failed', code: 'VALIDATION_FAILED', details: err.issues }, { status: 400 });
    }
    if (err instanceof Prisma.PrismaClientKnownRequestError) {
      if (err.code === 'P2002') return NextResponse.json({ error: 'Unique constraint failed', code: 'P2002' }, { status: 409 });
      if (err.code === 'P2003') return NextResponse.json({ error: 'Invalid relation/foreign key (authorId)', code: 'P2003' }, { status: 400 });
      if (err.code === 'P2011') return NextResponse.json({ error: 'Null constraint violation', code: 'P2011' }, { status: 400 });
    }
    console.error('POST /api/admin/blog failed:', err);
    return NextResponse.json({ error: 'Failed to create post', code: 'UNKNOWN', details: String(err) }, { status: 400 });
  }
}