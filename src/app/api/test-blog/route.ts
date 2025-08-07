import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const diagnostics = {
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ? 'Present' : 'Missing',
    databaseUrlLength: process.env.DATABASE_URL?.length || 0
  }

  try {
    // Test basic database connectivity
    await prisma.$connect()
    
    // Test table existence
    const tableCheck = await prisma.$queryRaw`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'BlogPost'`
    
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
      diagnostics,
      tableExists: Array.isArray(tableCheck) && tableCheck.length > 0
    })
  } catch (error) {
    console.error('Database error:', error)
    return NextResponse.json({ 
      success: false, 
      error: error.message,
      stack: error.stack,
      diagnostics,
      errorCode: error.code,
      errorName: error.name
    }, { status: 500 })
  } finally {
    await prisma.$disconnect()
  }
}