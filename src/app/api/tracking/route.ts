import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic'; // Explicitly mark this route as dynamic
export const revalidate = 0; // Never cache the result

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    console.log("🎯 TRACKING API: Received tracking request:", {
      casinoId: data.casinoId,
      bonusId: data.bonusId,
      actionType: data.actionType,
      timestamp: new Date().toISOString()
    });
    
    // Validate required fields
    if (!data.casinoId || !data.actionType) {
      console.error("❌ TRACKING API: Missing required fields:", data);
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Validate action type
    if (!['code_copy', 'offer_click', 'button_click'].includes(data.actionType)) {
      console.error("❌ TRACKING API: Invalid action type:", data.actionType);
      return NextResponse.json(
        { error: "Invalid action type" },
        { status: 400 }
      );
    }

    // Extract path from request headers for tracking source
    const path = request.headers.get('referer') || '';
    
    // Generate unique tracking ID
    const trackingId = `tr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;

    // Verify whop exists
    const whopExists = await prisma.deal.findUnique({
      where: { id: data.casinoId },
      select: { id: true }
    });

    if (!whopExists) {
      console.error("❌ TRACKING API: Whop not found:", data.casinoId);
      return NextResponse.json(
        { error: "Whop not found" },
        { status: 404 }
      );
    }

    // If promoCodeId is provided, verify it exists
    let validPromoCodeId = null;
    if (data.bonusId) {
      const promoCodeExists = await prisma.promoCode.findUnique({
        where: { id: data.bonusId },
        select: { id: true }
      });
      
      if (promoCodeExists) {
        validPromoCodeId = data.bonusId;
      } else {
        console.warn("⚠️ TRACKING API: Promo code not found, tracking without promo code:", data.bonusId);
      }
    }
    
    console.log("📝 TRACKING API: Inserting tracking record:", {
      trackingId,
      whopId: data.casinoId,
      promoCodeId: validPromoCodeId,
      actionType: data.actionType,
      path
    });

    // Create tracking entry using Prisma create
    const trackingRecord = await prisma.offerTracking.create({
      data: {
        id: trackingId,
        whopId: data.casinoId,
        promoCodeId: validPromoCodeId,
        actionType: data.actionType,
        path: path,
        createdAt: new Date()
      }
    });

    console.log("✅ TRACKING API: Successfully created tracking record:", trackingRecord.id);

    return NextResponse.json({ 
      success: true,
      tracking: {
        id: trackingRecord.id,
        casinoId: data.casinoId,
        bonusId: validPromoCodeId,
        actionType: data.actionType,
        path
      },
      usageCount: 1
    });
  } catch (error) {
    console.error("❌ TRACKING API ERROR:", error);
    return NextResponse.json(
      { error: "Failed to track action" },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const bonusId = searchParams.get('bonusId');

    if (!bonusId) {
      return NextResponse.json(
        { error: "Missing bonusId parameter" },
        { status: 400 }
      );
    }

    // Get the date 24 hours ago
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);

    // Count tracking entries for this promo code in the last 24 hours
    const todayCount = await prisma.offerTracking.count({
      where: {
        promoCodeId: bonusId,
        actionType: 'code_copy',
        createdAt: {
          gte: oneDayAgo
        }
      }
    });
    
    // Get the most recent usage timestamp
    const lastUsage = await prisma.offerTracking.findFirst({
      where: {
        promoCodeId: bonusId,
        actionType: 'code_copy'
      },
      orderBy: {
        createdAt: 'desc'
      },
      select: {
        createdAt: true
      }
    });

    return NextResponse.json({ 
      usageCount: todayCount,
      lastUsed: lastUsage?.createdAt?.toISOString() || null
    });
  } catch (error) {
    console.error("Error fetching tracking data:", error);
    return NextResponse.json(
      { error: "Failed to fetch tracking data" },
      { status: 500 }
    );
  }
} 