import { NextRequest } from 'next/server'
import { prisma } from '@/lib/prisma'

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const postId = searchParams.get('postId')
    const title = searchParams.get('title') || ''

    if (!postId) {
      return Response.json({ error: 'Post ID is required' }, { status: 400 })
    }

    // Extract keywords from the current post title for better matching
    const titleWords = title
      .toLowerCase()
      .split(/[\s\-_.,!?()]+/)
      .filter(word => word.length > 3 && !['with', 'from', 'this', 'that', 'they', 'them', 'their', 'there', 'then', 'than', 'when', 'where', 'what', 'will', 'would', 'could', 'should'].includes(word))
      .slice(0, 5) // Take top 5 keywords

    // Build search conditions for related posts
    const searchConditions = titleWords.length > 0 ? {
      OR: titleWords.map(word => ({
        OR: [
          { title: { contains: word, mode: 'insensitive' as const } },
          { content: { contains: word, mode: 'insensitive' as const } },
          { excerpt: { contains: word, mode: 'insensitive' as const } }
        ]
      }))
    } : {}

    // Fetch related posts using title/content similarity
    const relatedPosts = await prisma.blogPost.findMany({
      where: {
        AND: [
          { published: true },
          { id: { not: postId } },
          ...(titleWords.length > 0 ? [searchConditions] : [])
        ]
      },
      select: {
        id: true,
        title: true,
        slug: true,
        excerpt: true,
        publishedAt: true,
        author: {
          select: { name: true }
        }
      },
      orderBy: [
        { pinned: 'desc' },
        { publishedAt: 'desc' }
      ],
      take: 6
    })

    // If we don't have enough related posts based on keywords, fill with recent posts
    if (relatedPosts.length < 3) {
      const recentPosts = await prisma.blogPost.findMany({
        where: {
          AND: [
            { published: true },
            { id: { not: postId } },
            { id: { notIn: relatedPosts.map(p => p.id) } }
          ]
        },
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          author: {
            select: { name: true }
          }
        },
        orderBy: [
          { pinned: 'desc' },
          { publishedAt: 'desc' }
        ],
        take: 3 - relatedPosts.length
      })

      relatedPosts.push(...recentPosts)
    }

    return Response.json({ 
      posts: relatedPosts.slice(0, 3), // Limit to 3 related posts
      total: relatedPosts.length
    })

  } catch (error) {
    console.error('Error fetching related posts:', error)
    return Response.json({ error: 'Failed to fetch related posts' }, { status: 500 })
  }
}