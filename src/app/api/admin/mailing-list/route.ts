import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// GET /api/admin/mailing-list - List all mailing list subscribers
export async function GET(request: NextRequest) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'all'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = (page - 1) * limit

    // Build where clause based on status filter
    const where = status === 'all' ? {} : { 
      status: status.toUpperCase() as 'ACTIVE' | 'UNSUBSCRIBED' | 'BOUNCED'
    }

    const [subscribers, total] = await Promise.all([
      prisma.mailingList.findMany({
        where,
        orderBy: { subscribedAt: 'desc' },
        skip: offset,
        take: limit,
      }),
      prisma.mailingList.count({ where })
    ])

    // Get statistics - handle case where no records exist
    let stats = []
    try {
      stats = await prisma.mailingList.groupBy({
        by: ['status'],
        _count: true,
      })
    } catch (error) {
      // If groupBy fails (no records), use empty array
      stats = []
    }

    const statsMap = stats.reduce((acc, stat) => {
      acc[stat.status.toLowerCase()] = stat._count
      return acc
    }, {} as Record<string, number>)

    return NextResponse.json({
      subscribers,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      },
      stats: {
        active: statsMap.active || 0,
        unsubscribed: statsMap.unsubscribed || 0,
        bounced: statsMap.bounced || 0,
        total: stats.reduce((sum, stat) => sum + stat._count, 0)
      }
    })
  } catch (error) {
    console.error('Error fetching mailing list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}