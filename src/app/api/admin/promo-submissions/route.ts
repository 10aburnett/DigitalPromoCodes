import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/promo-submissions - Get promo code submissions for admin review
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'ALL'
    
    // Build where clause based on status filter
    const whereClause: any = {}
    if (status !== 'ALL') {
      whereClause.status = status
    }

    // 1) pull submissions WITHOUT the broken include
    const subs = await prisma.promoCodeSubmission.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        title: true,
        description: true,
        code: true,
        value: true,
        submitterName: true,
        submitterEmail: true,
        submitterMessage: true,
        status: true,
        reviewedAt: true,
        reviewedBy: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
        whopId: true,
        customCourseName: true,
        isGeneral: true,
      },
    });

    // 2) collect target whops by id
    const ids = [...new Set(subs.map(s => s.whopId).filter(Boolean))] as string[];

    // 3) fetch whops by id
    const whopsById = ids.length ? await prisma.whop.findMany({ 
      where: { id: { in: ids } }, 
      select: { id: true, slug: true, name: true } 
    }) : [];

    const byId = new Map(whopsById.map(w => [w.id, w]));

    // 4) join results
    const items = subs.map(s => ({
      ...s,
      whop: s.whopId ? byId.get(s.whopId) ?? null : null,
    }));

    return NextResponse.json(items);
  } catch (e: any) {
    console.error('[api/admin/promo-submissions] fail', e)
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