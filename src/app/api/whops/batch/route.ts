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

    const whops = await prisma.deal.findMany({
      where: { slug: { in: slugs } },
      include: {
        PromoCode: {
          select: { id: true, title: true, type: true, value: true, code: true }
        },
        Review: {
          select: { rating: true }
        }
      }
    });

    // Map PromoCode -> promoCodes and calculate average rating
    const payload = whops.map(w => {
      const ratings = w.Review?.map(r => r.rating).filter(Boolean) || [];
      const reviewsCount = ratings.length;
      const averageRating = reviewsCount > 0
        ? ratings.reduce((sum, rating) => sum + rating, 0) / reviewsCount
        : undefined; // Don't coalesce to 0

      return {
        ...w,
        promoCodes: w.PromoCode || [],
        // Important: only include rating when there are actual reviews
        rating: reviewsCount > 0 ? Number(averageRating) : undefined,
        reviewsCount
      };
    });

    return new Response(JSON.stringify({ whops: payload }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, no-cache, max-age=0, must-revalidate'
      }
    });
  } catch (err) {
    console.error('batch whops error', err);
    return new Response(JSON.stringify({ error: 'Internal error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}