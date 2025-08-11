import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/whops/list - Get list of whops for dropdowns
export async function GET() {
  try {
    const whops = await prisma.whop.findMany({
      select: {
        id: true,
        name: true,
        slug: true
      },
      orderBy: { name: 'asc' }
    })

    return NextResponse.json(whops)
  } catch (error) {
    console.error('Error fetching whops list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}