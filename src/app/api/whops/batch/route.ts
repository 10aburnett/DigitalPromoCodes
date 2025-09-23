// src/app/api/whops/batch/route.ts
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const raw = searchParams.get('slugs') || '';
    const slugs = raw.split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
    if (slugs.length === 0) {
      return new Response(JSON.stringify({ whops: [] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const whops = await prisma.whop.findMany({
      where: { slug: { in: slugs } },
      include: {
        PromoCode: {
          select: { id: true, title: true, type: true, value: true, code: true }
        }
      }
    });

    // Map PromoCode -> promoCodes to match your card component props
    const payload = whops.map(w => ({ ...w, promoCodes: w.PromoCode || [] }));

    return new Response(JSON.stringify({ whops: payload }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (err) {
    console.error('batch whops error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}