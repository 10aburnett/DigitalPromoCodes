import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'

export const dynamic = 'force-dynamic';

// DELETE /api/admin/mailing-list/[id] - Delete a specific subscriber
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = params

    // Check if subscriber exists
    const subscriber = await prisma.mailingList.findUnique({
      where: { id }
    })

    if (!subscriber) {
      return NextResponse.json({ error: 'Subscriber not found' }, { status: 404 })
    }

    // Delete the subscriber
    await prisma.mailingList.delete({
      where: { id }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Subscriber deleted successfully' 
    })
  } catch (error) {
    console.error('Error deleting subscriber:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}