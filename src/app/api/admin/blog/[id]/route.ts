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