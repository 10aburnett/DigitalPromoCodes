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

// PATCH /api/admin/comments/[id] - Update comment status
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { status, flaggedReason } = body

    if (!['APPROVED', 'REJECTED', 'FLAGGED', 'PENDING'].includes(status)) {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
    }

    const comment = await prisma.comment.update({
      where: { id: params.id },
      data: {
        status,
        flaggedReason: status === 'FLAGGED' ? flaggedReason : null,
      },
      include: {
        BlogPost: {
          select: {
            title: true,
            slug: true,
          }
        }
      }
    })

    return NextResponse.json(comment)
  } catch (error) {
    console.error('Error updating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/comments/[id] - Delete comment
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.comment.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}