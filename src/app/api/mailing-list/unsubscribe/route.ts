import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/mailing-list/unsubscribe - Unsubscribe user from mailing list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Check if user exists in mailing list
    const subscription = await prisma.mailingList.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (!subscription) {
      return NextResponse.json({ 
        success: true, 
        message: 'Email not found in mailing list',
        notFound: true
      })
    }

    if (subscription.status === 'UNSUBSCRIBED') {
      return NextResponse.json({ 
        success: true, 
        message: 'Already unsubscribed from mailing list',
        alreadyUnsubscribed: true
      })
    }

    // Unsubscribe user
    await prisma.mailingList.update({
      where: { email: email.toLowerCase().trim() },
      data: {
        status: 'UNSUBSCRIBED',
        unsubscribedAt: new Date(),
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully unsubscribed from mailing list'
    })
  } catch (error) {
    console.error('Error unsubscribing from mailing list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}