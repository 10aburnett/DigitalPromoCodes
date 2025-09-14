import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { randomUUID } from 'crypto'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
export const revalidate = 0

// POST /api/comments/[id]/vote - Vote on a comment
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const body = await request.json()
    const { voteType } = body
    const commentId = params.id

    // Validate voteType
    if (!voteType || !['UPVOTE', 'DOWNVOTE'].includes(voteType)) {
      return NextResponse.json({ error: 'Valid vote type required (UPVOTE or DOWNVOTE)' }, { status: 400 })
    }

    // Get user IP address for vote tracking
    const forwarded = request.headers.get('x-forwarded-for')
    const voterIP = forwarded ? forwarded.split(',')[0] : request.headers.get('x-real-ip') || 'unknown'

    // Check if comment exists and is approved
    const comment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { id: true, status: true }
    })

    if (!comment) {
      return NextResponse.json({ error: 'Comment not found' }, { status: 404 })
    }

    if (comment.status !== 'APPROVED') {
      return NextResponse.json({ error: 'Cannot vote on non-approved comments' }, { status: 400 })
    }

    // Check if user has already voted on this comment
    const existingVote = await prisma.commentVote.findUnique({
      where: {
        commentId_voterIP: {
          commentId,
          voterIP
        }
      }
    })

    const now = new Date()

    // Use transaction to handle vote changes atomically
    const result = await prisma.$transaction(async (tx) => {
      if (existingVote) {
        if (existingVote.voteType === voteType) {
          // Remove vote if same type (toggle off)
          await tx.commentVote.delete({
            where: { id: existingVote.id }
          })

          // Update comment vote counts
          if (voteType === 'UPVOTE') {
            await tx.comment.update({
              where: { id: commentId },
              data: {
                upvotes: { decrement: 1 },
                updatedAt: now // ✅ Required by production DB
              }
            })
          } else {
            await tx.comment.update({
              where: { id: commentId },
              data: {
                downvotes: { decrement: 1 },
                updatedAt: now // ✅ Required by production DB
              }
            })
          }

          return { action: 'removed', voteType: null }
        } else {
          // Change vote type
          await tx.commentVote.update({
            where: { id: existingVote.id },
            data: {
              voteType,
              updatedAt: now // ✅ Required by production DB
            }
          })

          // Update comment vote counts (remove old, add new)
          if (voteType === 'UPVOTE') {
            await tx.comment.update({
              where: { id: commentId },
              data: {
                upvotes: { increment: 1 },
                downvotes: { decrement: 1 },
                updatedAt: now // ✅ Required by production DB
              }
            })
          } else {
            await tx.comment.update({
              where: { id: commentId },
              data: {
                downvotes: { increment: 1 },
                upvotes: { decrement: 1 },
                updatedAt: now // ✅ Required by production DB
              }
            })
          }

          return { action: 'changed', voteType }
        }
      } else {
        // Create new vote
        await tx.commentVote.create({
          data: {
            id: randomUUID(), // ✅ Required by production DB
            commentId,
            voterIP,
            voteType,
            createdAt: now,
            updatedAt: now // ✅ Required by production DB
          }
        })

        // Update comment vote counts
        if (voteType === 'UPVOTE') {
          await tx.comment.update({
            where: { id: commentId },
            data: {
              upvotes: { increment: 1 },
              updatedAt: now // ✅ Required by production DB
            }
          })
        } else {
          await tx.comment.update({
            where: { id: commentId },
            data: {
              downvotes: { increment: 1 },
              updatedAt: now // ✅ Required by production DB
            }
          })
        }

        return { action: 'added', voteType }
      }
    })

    // Get updated vote counts
    const updatedComment = await prisma.comment.findUnique({
      where: { id: commentId },
      select: { upvotes: true, downvotes: true }
    })

    return NextResponse.json({
      success: true,
      action: result.action,
      userVote: result.voteType,
      upvotes: updatedComment?.upvotes || 0,
      downvotes: updatedComment?.downvotes || 0
    })

  } catch (err: any) {
    console.error('Comment vote error:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack
    });
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}