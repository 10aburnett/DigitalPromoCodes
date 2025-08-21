import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'

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
    const { whopId, rating, author, content, verified } = body

    // Validate required fields
    if (!whopId || typeof rating !== 'number') {
      return NextResponse.json({ 
        error: 'whopId and numeric rating are required' 
      }, { status: 400 })
    }

    // Ensure whop exists
    const whopExists = await prisma.whop.findUnique({ 
      where: { id: whopId }, 
      select: { id: true }
    })
    
    if (!whopExists) {
      return NextResponse.json({ 
        error: 'Invalid whopId' 
      }, { status: 400 })
    }

    const review = await prisma.review.create({
      data: {
        whopId,
        rating,
        author: author || 'Anonymous',
        content: content || '',
        verified: verified || false,
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