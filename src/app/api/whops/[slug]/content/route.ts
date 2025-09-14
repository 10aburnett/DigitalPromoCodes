import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function PUT(req: Request, { params }: { params: { slug: string } }) {
  try {
    const raw = params.slug ?? '';
    const key = decodeURIComponent(raw);

    // allow either id or slug
    const whop = await prisma.whop.findFirst({
      where: { OR: [{ id: key }, { slug: key }] },
      select: { id: true, slug: true },
    });
    if (!whop) return NextResponse.json({ error: 'Whop not found' }, { status: 404 });

    const body = await req.json();
    const data: Record<string, any> = { updatedAt: new Date() };
    const fields = [
      'aboutContent','howToRedeemContent','promoDetailsContent',
      'featuresContent','termsContent','faqContent'
    ] as const;
    for (const f of fields) if (body[f] !== undefined) data[f] = String(body[f]);

    const updated = await prisma.whop.update({
      where: { id: whop.id },
      data,
      select: { slug: true }
    });

    revalidatePath(`/whop/${updated.slug}`);
    revalidatePath(`/whops`);
    revalidatePath(`/admin/whops/${updated.slug}`);
    revalidatePath(`/admin/whops/${updated.slug}/content`);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('PUT /whops/[slug]/content error:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
    });
    return NextResponse.json({ error: 'Server error' }, { status: 500 });
  }
}