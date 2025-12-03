import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/whops/search?q=term&limit=20 - Server-side search for whops
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100) // Max 100 results
    
    if (!query.trim()) {
      return NextResponse.json([])
    }

    // Optimized search with LIKE pattern and limit
    const whops = await prisma.deal.findMany({
      where: {
        name: {
          contains: query,
          mode: 'insensitive' // Case insensitive search
        }
      },
      select: {
        id: true,
        name: true,
        slug: true
      },
      orderBy: { name: 'asc' },
      take: limit
    })

    return NextResponse.json(whops)
  } catch (error) {
    console.error('Error searching whops:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}