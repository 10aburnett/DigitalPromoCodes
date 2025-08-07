import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { published: true },
      select: {
        id: true,
        title: true,
        slug: true,
        published: true,
        createdAt: true
      },
      take: 5
    })
    
    return NextResponse.json({ 
      success: true, 
      count: posts.length,
      posts,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}