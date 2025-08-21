import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface RouteParams {
  params: {
    id: string
  }
}

// PATCH /api/admin/reviews/[id] - Update review verification status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { verified } = body

    if (typeof verified !== 'boolean') {
      return NextResponse.json({ error: 'Invalid verified status' }, { status: 400 })
    }

    const review = await prisma.review.update({
      where: { id: params.id },
      data: { verified },
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

    return NextResponse.json(review)
  } catch (e: any) {
    console.error('[api/admin/reviews/[id]] fail', e)
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

// DELETE /api/admin/reviews/[id] - Delete review
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.review.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (e: any) {
    console.error('[api/admin/reviews/[id]] delete fail', e)
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