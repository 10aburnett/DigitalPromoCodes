// app/api/revalidate/route.ts
import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';
import crypto from 'crypto';

/**
 * On-demand revalidation endpoint (Phase D2)
 *
 * Usage:
 *   POST /api/revalidate
 *   Headers:
 *     x-revalidate-secret: <REVALIDATE_SECRET>
 *   Body (JSON):
 *     { "tags": ["whop:example-slug", "hubs"] }
 */

export const runtime = 'nodejs'; // required for crypto
export const dynamic = 'force-dynamic'; // this route must always execute on demand

function timingSafeEqual(a: string, b: string): boolean {
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

export async function POST(req: Request) {
  const secretHeader = req.headers.get('x-revalidate-secret');
  const expected = process.env.REVALIDATE_SECRET;

  // 🔒 Auth check
  if (!secretHeader || !expected || !timingSafeEqual(secretHeader, expected)) {
    return NextResponse.json({ ok: false, error: 'Unauthorized' }, { status: 401 });
  }

  let payload: { tags?: string[] } = {};
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'Invalid JSON body' }, { status: 400 });
  }

  const { tags } = payload;
  if (!Array.isArray(tags) || tags.length === 0) {
    return NextResponse.json({ ok: false, error: 'Provide tags[]' }, { status: 400 });
  }

  // ✅ Revalidate each tag
  tags.forEach((tag) => revalidateTag(tag));

  console.log('[REVALIDATE]', {
    triggered: new Date().toISOString(),
    tags,
  });

  return NextResponse.json({ ok: true, revalidated: tags });
}
