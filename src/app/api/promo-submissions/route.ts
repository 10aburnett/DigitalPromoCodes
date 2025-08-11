import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/promo-submissions - Submit new promo code
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      title,
      description,
      code,
      value,
      submitterName,
      submitterEmail,
      submitterMessage,
      isGeneral,
      whopId,
      customCourseName
    } = body

    // Validate required fields
    if (!title || !description || !submitterName || !submitterEmail) {
      return NextResponse.json({
        error: 'Missing required fields',
        debug: 'title, description, submitterName, and submitterEmail are required'
      }, { status: 400 })
    }

    // If not general, validate course selection
    if (!isGeneral) {
      if (!whopId && !customCourseName) {
        return NextResponse.json({
          error: 'Course selection required for course-specific promo codes'
        }, { status: 400 })
      }

      // If whopId is provided, verify the course exists
      if (whopId) {
        const whopExists = await prisma.whop.findUnique({
          where: { id: whopId },
          select: { id: true }
        })

        if (!whopExists) {
          return NextResponse.json({
            error: 'Selected course not found'
          }, { status: 400 })
        }
      }
    }

    // Get client IP and User-Agent for spam prevention
    const forwarded = request.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : request.ip
    const userAgent = request.headers.get('user-agent')

    // Create the submission
    const submission = await prisma.promoCodeSubmission.create({
      data: {
        title,
        description,
        code: code || null,
        value: value || null,
        submitterName,
        submitterEmail,
        submitterMessage: submitterMessage || null,
        isGeneral: Boolean(isGeneral),
        whopId: isGeneral ? null : whopId,
        customCourseName: customCourseName || null,
        ipAddress: ip || null,
        userAgent: userAgent || null,
      },
      include: {
        whop: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    })

    // Log the submission for monitoring
    console.log('New promo code submission:', {
      id: submission.id,
      title: submission.title,
      isGeneral: submission.isGeneral,
      course: submission.whop?.name || submission.customCourseName || 'General',
      submitter: submission.submitterEmail
    })

    return NextResponse.json({
      success: true,
      submissionId: submission.id,
      message: 'Promo code submitted successfully! We\'ll review it and add it to the site if approved.'
    })

  } catch (error) {
    console.error('Error creating promo code submission:', error)
    
    return NextResponse.json({
      error: 'Internal server error',
      debug: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET /api/promo-submissions - List submissions (for admin)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'SPAM'].includes(status)) {
      where.status = status
    }

    const submissions = await prisma.promoCodeSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        whop: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    })

    const total = await prisma.promoCodeSubmission.count({ where })

    return NextResponse.json({
      submissions,
      total,
      limit,
      offset
    })

  } catch (error) {
    console.error('Error fetching promo submissions:', error)
    return NextResponse.json({
      error: 'Internal server error'
    }, { status: 500 })
  }
}