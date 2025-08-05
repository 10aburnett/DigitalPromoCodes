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
    console.log('Blog POST API called')
    const adminUser = await verifyAdminToken()
    console.log('Admin user from token:', adminUser)
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      console.log('Authorization failed:', { adminUser })
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    console.log('Request body:', body)
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

    console.log('Blog post created successfully:', post.id)
    return NextResponse.json(post)
  } catch (error) {
    console.error('Error creating blog post:', error)
    console.error('Error details:', error instanceof Error ? error.message : 'Unknown error')
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}