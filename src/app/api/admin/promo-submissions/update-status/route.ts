import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// POST /api/admin/promo-submissions/update-status - Update submission status and create promo code if approved
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    console.log('Received body:', body) // Debug log
    const { submissionId, status, adminNotes } = body

    if (!submissionId || !status) {
      console.error('Missing required fields:', { submissionId, status })
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
    }

    // Validate status enum
    const validStatuses = ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'SPAM']
    if (!validStatuses.includes(status)) {
      console.error('Invalid status:', status)
      return NextResponse.json({ error: 'Invalid status value' }, { status: 400 })
    }

    // Get the submission with whop details (safer approach)
    console.log('Finding submission with ID:', submissionId)
    const submission = await prisma.promoCodeSubmission.findUnique({
      where: { id: submissionId },
      include: { 
        Whop: true // Note: use exact relation name from schema
      }
    })

    if (!submission) {
      console.error('Submission not found:', submissionId)
      return NextResponse.json({ error: 'Submission not found' }, { status: 404 })
    }
    
    console.log('Found submission:', { id: submission.id, status: submission.status, whopId: submission.whopId })

    // Start transaction for atomic operations
    const result = await prisma.$transaction(async (tx) => {
      // Update submission status
      const updatedSubmission = await tx.promoCodeSubmission.update({
        where: { id: submissionId },
        data: {
          status,
          // Clear review fields when reverting to PENDING
          reviewedAt: status === 'PENDING' ? null : new Date(),
          reviewedBy: status === 'PENDING' ? null : 'Admin', // TODO: Get actual admin user when auth is implemented
          adminNotes
        }
      })

      // If approved and not general, create a new PromoCode record
      if (status === 'APPROVED' && !submission.isGeneral && submission.whopId) {
        console.log('Creating promo code for approved submission:', submissionId)
        try {
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
          console.log('Promo code created successfully')
        } catch (promoError: any) {
          console.error('Error creating promo code:', promoError)
          throw promoError // Re-throw to rollback transaction
        }
      }

      return updatedSubmission
    })

    return NextResponse.json({ 
      success: true, 
      message: status === 'APPROVED' ? 'Submission approved and promo code created' : `Submission ${status.toLowerCase()}`,
      submission: result 
    })

  } catch (error: any) {
    console.error('Error updating submission status:', {
      message: error?.message,
      code: error?.code,
      meta: error?.meta,
      stack: error?.stack
    })
    
    // Handle specific Prisma errors
    if (error.code === 'P2002') {
      return NextResponse.json({ 
        error: 'A promo code with this ID already exists',
        code: 'P2002'
      }, { status: 409 })
    }
    
    if (error.code === 'P2025') {
      return NextResponse.json({ 
        error: 'Record not found',
        code: 'P2025'
      }, { status: 404 })
    }

    return NextResponse.json({ 
      error: 'Internal server error',
      details: error?.message,
      code: error?.code || 'UNKNOWN'
    }, { status: 500 })
  }
}