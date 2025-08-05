import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { verifyAdminToken } from '@/lib/auth-utils'

interface RouteParams {
  params: {
    id: string
  }
}

// GET /api/admin/blog/[id] - Get single blog post
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const post = await prisma.blogPost.findUnique({
      where: { id: params.id },
      include: {
        author: {
          select: {
            name: true,
          }
        }
      }
    })

    if (!post) {
      return NextResponse.json({ error: 'Post not found' }, { status: 404 })
    }

    return NextResponse.json(post)
  } catch (error) {
    console.error('Error fetching blog post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// PATCH /api/admin/blog/[id] - Update blog post
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { title, slug, content, excerpt, published } = body

    // Check if slug already exists (excluding current post)
    if (slug) {
      const existingPost = await prisma.blogPost.findFirst({
        where: { 
          slug,
          id: { not: params.id }
        }
      })

      if (existingPost) {
        return NextResponse.json({ error: 'Slug already exists' }, { status: 400 })
      }
    }

    // Prepare update data
    const updateData: any = {}
    
    if (title !== undefined) updateData.title = title
    if (slug !== undefined) updateData.slug = slug
    if (content !== undefined) updateData.content = content
    if (excerpt !== undefined) updateData.excerpt = excerpt || null
    
    if (published !== undefined) {
      updateData.published = published
      // Set publishedAt when publishing for the first time
      if (published) {
        const currentPost = await prisma.blogPost.findUnique({
          where: { id: params.id },
          select: { publishedAt: true }
        })
        
        if (!currentPost?.publishedAt) {
          updateData.publishedAt = new Date()
        }
      } else {
        updateData.publishedAt = null
      }
    }

    const post = await prisma.blogPost.update({
      where: { id: params.id },
      data: updateData,
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
    console.error('Error updating blog post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// DELETE /api/admin/blog/[id] - Delete blog post
export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const adminUser = await verifyAdminToken()
    
    if (!adminUser || adminUser.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    await prisma.blogPost.delete({
      where: { id: params.id }
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error deleting blog post:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}