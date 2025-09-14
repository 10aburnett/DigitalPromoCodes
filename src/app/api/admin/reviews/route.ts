import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/reviews - List all reviews for moderation
export async function GET() {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 1) No include — just scalars + FK ids
    const rows = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        author: true,
        content: true,
        rating: true,
        createdAt: true,
        updatedAt: true,
        verified: true,
        whopId: true,
      },
    });

    // 2) Collect whop ids
    const whopIds = [...new Set(rows.map(r => r.whopId).filter(Boolean))] as string[];

    // 3) Fetch whops by id
    const whops = whopIds.length ? await prisma.whop.findMany({ 
      where: { id: { in: whopIds } }, 
      select: { id: true, slug: true, name: true } 
    }) : [];

    const whopById = new Map(whops.map(w => [w.id, w]));

    // 4) Join results
    const items = rows.map(r => ({
      ...r,
      whop: r.whopId ? whopById.get(r.whopId) ?? null : null,
    }));

    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[api/admin/reviews] fail', e)
    return NextResponse.json(
      { 
        error: e?.message, 
        code: e?.code, 
        meta: e?.meta ?? null, 
        stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
      },
      { status: 500 }
    )
  }
}

// POST /api/admin/reviews - Create new review
export async function POST(request: NextRequest) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('[admin/reviews POST] received body:', JSON.stringify(body, null, 2))
    
    let { whopId, whopSlug, slug, rating, author, content, verified } = body

    // Normalize rating
    const ratingNum = Number(rating);
    if (!Number.isFinite(ratingNum) || ratingNum < 1 || ratingNum > 5) {
      return NextResponse.json({ error: 'rating must be 1–5' }, { status: 400 });
    }

    // Resolve whop by id first, then slug, then name (if you want)
    let whop = null;
    if (whopId) {
      const idCoerced = /^\d+$/.test(String(whopId)) ? Number(whopId) : String(whopId);
      whop = await prisma.whop.findUnique({ 
        where: { id: idCoerced as any }, 
        select: { id: true } 
      });
    }
    
    if (!whop && (whopSlug || slug)) {
      const slugToUse = decodeURIComponent((whopSlug || slug).toString().trim());
      whop = await prisma.whop.findFirst({
        where: { 
          OR: [
            { slug: slugToUse }, 
            { name: { equals: slugToUse, mode: 'insensitive' } }
          ] 
        },
        select: { id: true }
      });
    }
    
    if (!whop) {
      return NextResponse.json({ 
        error: 'Whop not found in database',
        debug: { whopId, whopSlug, slug, attempted: { whopId, whopSlug, slug } }
      }, { status: 400 });
    }

    const now = new Date();
    const review = await prisma.review.create({
      data: {
        id: randomUUID(), // ✅ Required by production DB
        whopId: whop.id,
        rating: ratingNum,
        author: author || 'Anonymous',
        content: content || '',
        verified: verified || false,
        createdAt: now,
        updatedAt: now, // ✅ Required by production DB
      },
      select: {
        id: true,
        author: true,
        content: true,
        rating: true,
        createdAt: true,
        updatedAt: true,
        verified: true,
        whopId: true,
      }
    })

    return NextResponse.json(review, { 
      status: 201,
      headers: { 'Cache-Control': 'no-store' }
    });
  } catch (e: any) {
    console.error('[api/admin/reviews POST] fail', e)
    return NextResponse.json(
      { 
        error: e?.message, 
        code: e?.code, 
        meta: e?.meta ?? null, 
        stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined
      },
      { status: 500 }
    )
  }
}