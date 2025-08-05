import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// POST /api/mailing-list/subscribe - Subscribe user to mailing list
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { email, name, source } = body

    // Validate required fields
    if (!email) {
      return NextResponse.json({ error: 'Email is required' }, { status: 400 })
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json({ error: 'Invalid email address' }, { status: 400 })
    }

    // Check if user is already subscribed
    const existingSubscription = await prisma.mailingList.findUnique({
      where: { email: email.toLowerCase().trim() }
    })

    if (existingSubscription) {
      if (existingSubscription.status === 'ACTIVE') {
        return NextResponse.json({ 
          success: true, 
          message: 'Already subscribed to mailing list',
          alreadySubscribed: true
        })
      } else {
        // Reactivate if previously unsubscribed
        await prisma.mailingList.update({
          where: { email: email.toLowerCase().trim() },
          data: {
            status: 'ACTIVE',
            name: name || existingSubscription.name,
            source: source || existingSubscription.source,
            subscribedAt: new Date(),
            unsubscribedAt: null,
          }
        })
        
        return NextResponse.json({ 
          success: true, 
          message: 'Resubscribed to mailing list successfully',
          resubscribed: true
        })
      }
    }

    // Create new subscription
    await prisma.mailingList.create({
      data: {
        email: email.toLowerCase().trim(),
        name: name?.trim() || null,
        source: source || 'direct_signup',
        status: 'ACTIVE',
      }
    })

    return NextResponse.json({ 
      success: true, 
      message: 'Successfully subscribed to mailing list!'
    })
  } catch (error) {
    console.error('Error subscribing to mailing list:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}