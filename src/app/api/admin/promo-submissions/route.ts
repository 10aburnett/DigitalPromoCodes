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

    const submissions = await prisma.promoCodeSubmission.findMany({
      where: whereClause,
      include: {
        whop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: [
        { createdAt: 'desc' } // Newest submissions first
      ]
    })

    return NextResponse.json(submissions)
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