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

// GET /api/admin/reviews/[id] - Get single review
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const review = await prisma.review.findUnique({
      where: { id: params.id },
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

    if (!review) {
      return NextResponse.json({ error: 'Review not found' }, { status: 404 })
    }

    // Get whop details if whopId exists
    let whop = null
    if (review.whopId) {
      whop = await prisma.whop.findUnique({
        where: { id: review.whopId },
        select: { id: true, name: true, slug: true }
      })
    }

    return NextResponse.json({
      ...review,
      whop
    })
  } catch (e: any) {
    console.error('[api/admin/reviews/[id]] GET fail', e)
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