import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/promo-submissions/update-status - Update submission status and create promo code if approved
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { submissionId, status, adminNotes } = body

    if (!submissionId || !status) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Get the submission with whop details
    const submission = await prisma.promoCodeSubmission.findUnique({
      where: { id: submissionId },
      include: { whop: true }
    })

    if (!submission) {
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }

    // Start transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Update submission status
      const updatedSubmission = await tx.promoCodeSubmission.update({
        where: { id: submissionId },
        data: {
          status,
          reviewedAt: new Date(),
          reviewedBy: 'Admin', // TODO: Get actual admin user when auth is implemented
          adminNotes
        }
      })

      // If approved and not general, create a new PromoCode record
      if (status === 'APPROVED' && !submission.isGeneral && submission.whopId) {
        await tx.promoCode.create({
          data: {
            id: `community_${submissionId}`, // Prefix to identify community submissions
            title: submission.title,
            description: submission.description,
            code: submission.code,
            type: 'DISCOUNT', // Default type - can be improved later
            value: submission.value,
            whopId: submission.whopId,
            createdAt: new Date(),
            updatedAt: new Date()
          }
        })
      }

      return updatedSubmission
    })

    return NextResponse.json({ 
      success: true, 
      message: status === 'APPROVED' ? 'Submission approved and promo code created' : `Submission ${status.toLowerCase()}`,
      submission: result 
    })

  } catch (error: any) {
    console.error('Error updating submission status:', error)
    
    // Handle duplicate key error for promo code creation
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A promo code with this ID already exists' 
      }, { status: 409 })
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}