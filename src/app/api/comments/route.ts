import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// Hate speech and harmful content detection
const BLOCKED_PATTERNS = [
  // Racial slurs and hate speech (using partial patterns to avoid false positives)
  /n[i1!]gg[e3]r/i,
  /f[a@]gg[o0]t/i,
  /k[i1!]ke/i,
  /ch[i1!]nk/i,
  /sp[i1!]c/i,
  /w[e3]tb[a@]ck/i,
  /r[a@]gh[e3][a@]d/i,
  // Nazi/extremist content
  /h[i1!]tl[e3]r/i,
  /n[a@]z[i1!]/i,
  /14\/88/i,
  /wh[i1!]t[e3]\s*p[o0]w[e3]r/i,
  /s[i1!]eg\s*h[e3][i1!]l/i,
  // Homophobic slurs
  /tr[a@]nn[y1!]/i,
  /d[y1!]ke/i,
  // Threats and violence
  /k[i1!]ll\s*y[o0]urs[e3]lf/i,
  /k[y1!]s/i,
  /d[i1!][e3]\s*(sl[o0]wly|p[a@][i1!]nfully)/i,
  /r[a@]p[e3]\s*(y[o0]u|h[e3]r|h[i1!]m)/i,
]

function containsHateSpeech(content: string): { isBlocked: boolean; reason?: string } {
  const normalizedContent = content.toLowerCase().replace(/[^a-z0-9\s]/g, '')
  
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(normalizedContent)) {
      return { isBlocked: true, reason: 'Contains hate speech or harmful content' }
    }
  }
  
  return { isBlocked: false }
}

// POST /api/comments - Submit a new comment
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { content, authorName, authorEmail, blogPostId } = body

    // Validate required fields
    if (!content || !authorName || !authorEmail || !blogPostId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(authorEmail)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Check if blog post exists
    const blogPost = await prisma.blogPost.findUnique({
      where: { id: blogPostId, published: true }
    })

    if (!blogPost) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // Content moderation
    const moderation = containsHateSpeech(content)
    const status = moderation.isBlocked ? 'FLAGGED' : 'PENDING'
    const flaggedReason = moderation.reason || null

    // Create comment
    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        blogPostId,
        status,
        flaggedReason,
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: moderation.isBlocked 
        ? 'Comment flagged for review due to content policy violation'
        : 'Comment submitted for review'
    })
  } catch (error) {
    console.error('Error creating comment:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

// GET /api/comments?blogPostId=xxx - Get approved comments for a blog post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blogPostId = searchParams.get('blogPostId')

    if (!blogPostId) {
      return NextResponse.json({ error: 'blogPostId is required' }, { status: 400 })
    }

    const comments = await prisma.comment.findMany({
      where: {
        blogPostId,
        status: 'APPROVED'
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        content: true,
        authorName: true,
        createdAt: true,
      }
    })

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}