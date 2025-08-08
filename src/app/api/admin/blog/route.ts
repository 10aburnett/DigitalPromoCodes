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
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser) {
      return NextResponse.json({ 
        error: 'Authentication required',
        debug: 'No admin token found or token invalid'
      }, { status: 401 })
    }
    
    if (adminUser.role !== 'ADMIN') {
      return NextResponse.json({ 
        error: 'Insufficient permissions',
        debug: `User role: ${adminUser.role}, required: ADMIN`
      }, { status: 403 })
    }

    const body = await request.json()
    const { title, slug, content, excerpt, published } = body

    // Validate required fields
    if (!title || !slug || !content) {
      return NextResponse.json({ 
        error: 'Missing required fields',
        debug: `title: ${!!title}, slug: ${!!slug}, content: ${!!content}`
      }, { status: 400 })
    }

    // Check if slug already exists
    const existingPost = await prisma.blogPost.findUnique({
      where: { slug }
    })

    if (existingPost) {
      return NextResponse.json({ 
        error: 'Slug already exists',
        debug: `Slug "${slug}" is already in use`
      }, { status: 400 })
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

    return NextResponse.json(post)
  } catch (error) {
    return NextResponse.json({ 
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : String(error),
      stack: process.env.NODE_ENV === 'development' ? (error instanceof Error ? error.stack : 'No stack') : undefined
    }, { status: 500 })
  }
}