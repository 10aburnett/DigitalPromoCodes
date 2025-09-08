import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RouteParams {
  params: {
    slug: string
  }
}

// GET /api/blog/[slug] - Get a single blog post by slug
export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { 
        slug: params.slug,
        published: true 
      },
      include: {
        User: {
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