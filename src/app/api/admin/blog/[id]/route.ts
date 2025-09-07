// src/app/api/admin/blog/[id]/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type Params = { params: { id?: string } };

export async function GET(_req: Request, { params }: Params) {
  const id = (params?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    const rows = await prisma.$queryRaw<
      Array<{
        id: string; title: string | null; slug: string | null; excerpt: string | null;
        content: string | null; published: boolean | null; pinned: boolean | null;
        publishedAt: Date | null; createdAt: Date | null; updatedAt: Date | null; authorName: string | null;
      }>
    >`
      SELECT
        id, title, slug, excerpt,
        content::text AS content,    -- force TEXT so no JSON parsing happens
        published, pinned, "publishedAt", "createdAt", "updatedAt", "authorName"
      FROM "BlogPost"
      WHERE id = ${id}
      LIMIT 1
    `;
    if (!rows.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true, post: rows[0] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Failed to load post', code: e?.code ?? 'UNKNOWN', details: e?.message ?? String(e) }, { status: 500 });
  }
}

export async function PATCH(req: Request, { params }: Params) {
  const id = (params?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  let body: any = {};
  try { 
    body = await req.json(); 
  } catch {
    // body stays empty if JSON parsing fails
  }

  const action: 'publish' | 'pin' | undefined = body?.action;
  // optional: allow explicit value; if omitted we toggle
  const explicitValue: boolean | undefined = typeof body?.value === 'boolean' ? body.value : undefined;

  if (!action) {
    return NextResponse.json({ error: 'Missing action' }, { status: 400 });
  }

  try {
    if (action === 'publish') {
      const current = await prisma.blogPost.findUnique({
        where: { id },
        select: { published: true },
      });
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const next = explicitValue ?? !current.published;
      const updated = await prisma.blogPost.update({
        where: { id },
        data: {
          published: next,
          publishedAt: next ? new Date() : null,
        },
        select: {
          id: true, title: true, slug: true, excerpt: true,
          published: true, publishedAt: true, pinned: true, pinnedAt: true,
          authorName: true, updatedAt: true,
        },
      });
      return NextResponse.json({ ok: true, post: updated });
    }

    if (action === 'pin') {
      const current = await prisma.blogPost.findUnique({
        where: { id },
        select: { pinned: true },
      });
      if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 });

      const next = explicitValue ?? !current.pinned;
      const updated = await prisma.blogPost.update({
        where: { id },
        data: {
          pinned: next,
          pinnedAt: next ? new Date() : null,
        },
        select: {
          id: true, title: true, slug: true, excerpt: true,
          published: true, publishedAt: true, pinned: true, pinnedAt: true,
          authorName: true, updatedAt: true,
        },
      });
      return NextResponse.json({ ok: true, post: updated });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    console.error('PATCH /api/admin/blog/[id] failed', e);
    return NextResponse.json(
      { error: 'Failed to update', code: e?.code ?? 'UNKNOWN', details: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}

export async function DELETE(req: Request, { params }: Params) {
  const id = (params?.id ?? '').trim();
  if (!id) return NextResponse.json({ error: 'Missing id' }, { status: 400 });

  try {
    await prisma.blogPost.delete({
      where: { id },
    });
    
    return NextResponse.json({ ok: true, message: 'Post deleted successfully' });
  } catch (e: any) {
    console.error('DELETE /api/admin/blog/[id] failed', e);
    
    if (e.code === 'P2025') {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 });
    }
    
    return NextResponse.json(
      { error: 'Failed to delete post', code: e?.code ?? 'UNKNOWN', details: e?.message ?? String(e) },
      { status: 500 },
    );
  }
}