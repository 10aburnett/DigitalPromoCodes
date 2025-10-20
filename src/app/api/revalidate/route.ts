import { NextResponse } from 'next/server';
import { revalidateTag } from 'next/cache';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const tags: string[] = Array.isArray(body?.tags) ? body.tags.map(String) : [];
    for (const t of tags) revalidateTag(t);
    return NextResponse.json({ ok: true, tags });
  } catch (e: any) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 400 });
  }
}
