import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'; // IMPORTANT for Prisma on Vercel
export const dynamic = 'force-dynamic';

// Accept "", null, undefined ➜ turn into undefined (no parent)
const ParentId = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.string().trim().min(1).optional()
);

// Validation schema for comment submission
const CommentSchema = z.object({
  content: z.string().trim().min(1, 'Comment must be at least 1 character').max(4000),
  authorName: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  authorEmail: z.string().trim().email('Valid email required').toLowerCase().max(320),
  blogPostId: z.string().min(1, 'Missing blog post ID').optional(),
  postSlug: z.string().min(1, 'Missing post slug').optional(),
  parentId: ParentId.optional(),
  // Honeypot field (keep hidden on client)
  website: z.string().max(0).optional().or(z.literal('')),
}).refine((data) => {
  return data.blogPostId || data.postSlug;
}, { message: "Either blogPostId or postSlug is required" });

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

async function parseRequest(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return CommentSchema.parse(await req.json());
  }
  // Handle form submissions
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const form = await req.formData();
    return CommentSchema.parse({
      content: String(form.get('content') ?? form.get('comment') ?? ''),
      authorName: String(form.get('authorName') ?? form.get('name') ?? ''),
      authorEmail: String(form.get('authorEmail') ?? form.get('email') ?? ''),
      blogPostId: String(form.get('blogPostId') ?? ''),
      postSlug: String(form.get('postSlug') ?? ''),
      parentId: form.get('parentId'),
      website: String(form.get('website') ?? ''),
    });
  }
  // Fallback
  try {
    return CommentSchema.parse(await req.json());
  } catch {
    return CommentSchema.parse({});
  }
}

// POST /api/comments - Submit a new comment
export async function POST(request: NextRequest) {
  try {
    console.log('Comment submission received');
    
    // Parse and validate the data
    const data = await parseRequest(request);
    console.log('Processing comment submission:', { 
      authorName: data.authorName, 
      authorEmail: data.authorEmail, 
      blogPostId: data.blogPostId,
      postSlug: data.postSlug 
    });
    
    // Check honeypot (spam protection)
    if (data.website && data.website.length > 0) {
      console.log('Honeypot triggered, rejecting spam comment');
      return NextResponse.json({
        error: 'Invalid comment data',
        details: { website: ['This field should be empty'] }
      }, { status: 400 });
    }
    
    const { content, authorName, authorEmail, blogPostId, postSlug, parentId } = data;

    // Resolve blog post - prefer postSlug, fallback to blogPostId
    let blogPost;
    if (postSlug) {
      blogPost = await prisma.blogPost.findUnique({
        where: { slug: postSlug, published: true },
        select: { id: true }
      });
    } else if (blogPostId) {
      blogPost = await prisma.blogPost.findUnique({
        where: { id: blogPostId, published: true },
        select: { id: true }
      });
    }

    if (!blogPost) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // If this is a reply, check if parent comment exists and is approved
    if (parentId) {
      const parentComment = await prisma.comment.findUnique({
        where: { id: parentId },
        select: { id: true, status: true, blogPostId: true }
      })

      if (!parentComment) {
        return NextResponse.json({ error: 'Parent comment not found' }, { status: 404 })
      }

      if (parentComment.status !== 'APPROVED') {
        return NextResponse.json({ error: 'Cannot reply to non-approved comments' }, { status: 400 })
      }

      if (parentComment.blogPostId !== blogPost.id) {
        return NextResponse.json({ error: 'Invalid parent comment' }, { status: 400 })
      }
    }

    // Content moderation - auto-approve unless severely offensive
    const moderation = containsHateSpeech(content)
    const status = moderation.isBlocked ? 'FLAGGED' : 'APPROVED'
    const flaggedReason = moderation.reason || null

    // Create comment - production DB requires explicit id and updatedAt
    const now = new Date();
    const comment = await prisma.comment.create({
      data: {
        id: randomUUID(), // ✅ Required by production DB
        content: content.trim(),
        authorName: authorName.trim(),
        authorEmail: authorEmail.trim(),
        blogPostId: blogPost.id,
        parentId: parentId || null,
        status,
        flaggedReason,
        createdAt: now,
        updatedAt: now, // ✅ Required by production DB
      },
      select: {
        id: true,
        content: true,
        authorName: true,
        createdAt: true,
        status: true
      }
    })

    console.log('Comment created successfully:', comment.id);

    return NextResponse.json({ 
      success: true, 
      message: moderation.isBlocked 
        ? 'Comment flagged for review due to content policy violation'
        : 'Comment posted successfully',
      comment: {
        id: comment.id,
        content: comment.content,
        authorName: comment.authorName,
        createdAt: comment.createdAt,
        upvotes: 0,
        downvotes: 0,
        userVote: null
      }
    })
  } catch (err: any) {
    console.error('Comments API error:', err);
    
    // Zod validation errors
    if (err?.name === 'ZodError') {
      return NextResponse.json({
        error: 'Invalid comment data',
        details: err.flatten()
      }, { status: 400 });
    }
    
    // Prisma duplicate key (unlikely but handle it)
    if (err?.code === 'P2002') {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Comment already submitted'
      }, { status: 200 });
    }
    
    // Generic server error
    return NextResponse.json({
      error: 'Server error',
      details: err?.message ?? String(err),
      code: err?.code
    }, { status: 500 });
  }
}

// GET /api/comments?blogPostId=xxx OR ?postSlug=xxx - Get approved comments for a blog post
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const blogPostId = searchParams.get('blogPostId')
    const postSlug = searchParams.get('postSlug')

    if (!blogPostId && !postSlug) {
      return NextResponse.json({ error: 'blogPostId or postSlug is required' }, { status: 400 })
    }

    // Resolve blog post
    let post;
    if (postSlug) {
      post = await prisma.blogPost.findUnique({
        where: { slug: postSlug },
        select: { id: true }
      });
    } else if (blogPostId) {
      post = { id: blogPostId };
    }

    if (!post) {
      return NextResponse.json({ error: 'Blog post not found' }, { status: 404 })
    }

    // Get user IP for vote status
    const forwarded = request.headers.get('x-forwarded-for')
    const voterIP = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

    // Get ALL approved comments for this blog post (flattened)
    const allComments = await prisma.comment.findMany({
      where: {
        blogPostId: post.id,
        status: 'APPROVED'
      },
      select: {
        id: true,
        content: true,
        authorName: true,
        createdAt: true,
        upvotes: true,
        downvotes: true,
        parentId: true,
        CommentVote: {
          where: { voterIP },
          select: { voteType: true }
        }
      }
    })

    // Build nested structure programmatically (supports infinite nesting)
    const commentMap = new Map()
    const rootComments = []

    // Transform comments and create map
    allComments.forEach(comment => {
      const transformedComment = {
        ...comment,
        userVote: comment.CommentVote.length > 0 ? comment.CommentVote[0].voteType : null,
        CommentVote: undefined,
        replies: []
      }
      commentMap.set(comment.id, transformedComment)
    })

    // Build parent-child relationships
    allComments.forEach(comment => {
      const transformedComment = commentMap.get(comment.id)
      if (comment.parentId) {
        const parent = commentMap.get(comment.parentId)
        if (parent) {
          parent.replies.push(transformedComment)
        }
      } else {
        rootComments.push(transformedComment)
      }
    })

    // Sort replies recursively by creation date
    const sortReplies = (comments) => {
      comments.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime())
      comments.forEach(comment => {
        if (comment.replies.length > 0) {
          sortReplies(comment.replies)
        }
      })
    }

    sortReplies(rootComments)
    const comments = rootComments.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())

    return NextResponse.json(comments)
  } catch (error) {
    console.error('Error fetching comments:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}