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

    const reviews = await prisma.review.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        Whop: {
          select: {
            id: true,
            name: true,
            slug: true,
          }
        }
      }
    })

    return NextResponse.json(reviews)
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