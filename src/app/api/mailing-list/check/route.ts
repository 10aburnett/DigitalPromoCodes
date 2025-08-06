import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/mailing-list/check - Check if email exists in mailing list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate email
    if (!email || typeof email !== 'string') {
      return NextResponse.json({ error: 'Valid email is required' }, { status: 400 })
    }

    // Check if email exists in mailing list with ACTIVE status
    const existingSubscriber = await prisma.mailingList.findUnique({
      where: { 
        email: email.toLowerCase().trim() 
      },
      select: {
        id: true,
        status: true
      }
    })

    // Return whether email exists and is active
    const isSubscribed = existingSubscriber && existingSubscriber.status === 'ACTIVE'

    return NextResponse.json({ 
      exists: !!existingSubscriber,
      isSubscribed: isSubscribed,
      status: existingSubscriber?.status || null
    })
  } catch (error) {
    console.error('Error checking email in mailing list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}