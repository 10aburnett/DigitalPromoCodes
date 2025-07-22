import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const promoCodes = await prisma.promoCode.findMany({
      include: {
        whop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    return NextResponse.json({
      success: true,
      promoCodes
    });
  } catch (error) {
    console.error('Error fetching promo codes:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch promo codes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      whopId,
      code,
      title,
      description,
      type,
      value,
      validFrom,
      validUntil,
      maxUses,
      isActive = true
    } = body;

    // Validate required fields
    if (!whopId || !title || !type || !value) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: whopId, title, type, value' },
        { status: 400 }
      );
    }

    // Verify whop exists
    const whop = await prisma.whop.findUnique({
      where: { id: whopId }
    });

    if (!whop) {
      return NextResponse.json(
        { success: false, error: 'Whop not found' },
        { status: 404 }
      );
    }

    // Create promo code
    const promoCode = await prisma.promoCode.create({
      data: {
        whopId,
        code: code || null, // Allow null for "NO CODE REQUIRED" cases
        title,
        description: description || '',
        type,
        value
      },
      include: {
        whop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    });

    return NextResponse.json({
      success: true,
      promoCode
    });
  } catch (error) {
    console.error('Error creating promo code:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to create promo code' },
      { status: 500 }
    );
  }
}