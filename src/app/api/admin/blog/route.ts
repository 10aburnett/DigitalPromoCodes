import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'

// GET /api/admin/blog - List all blog posts
export async function GET() {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const posts = await prisma.blogPost.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        author: {
          select: {
            name: true,
          }
        }
      }
    })

    return NextResponse.json(posts)
  } catch (error) {
    console.error('Error fetching blog posts:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// POST /api/admin/blog - Create new blog post
export async function POST(request: NextRequest) {
  console.log('POST /api/admin/blog - Starting request processing')
  
  try {
    console.log('Verifying admin token...')
    const adminUser = await verifyAdminToken()
    console.log('Admin user verification result:', adminUser)
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      console.log('Authorization failed - adminUser:', adminUser)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    console.log('Parsing request body...')
    const body = await request.json()
    console.log('Request body parsed:', body)
    const { title, slug, content, excerpt, published } = body

    // Check if slug already exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug }
    })

    if (existingPost) {
      return NextResponse.json({ error: 'Slug already exists' }, { status: 400 })
    }

    const post = await prisma.blogPost.create({
      data: {
        title,
        slug,
        content,
        excerpt: excerpt || null,
        published: published || false,
        publishedAt: published ? new Date() : null,
        authorId: adminUser.id,
      },
      include: {
        author: {
          select: {
            name: true,
          }
        }
      }
    })

    console.log('Blog post created successfully:', post)
    return NextResponse.json(post)
  } catch (error) {
    console.error('Error creating blog post:', error)
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    return NextResponse.json({ 
      error: 'Internal server error', 
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}