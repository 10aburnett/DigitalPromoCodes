import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = 'force-dynamic'; // Explicitly mark this route as dynamic
export const revalidate = 0; // Never cache the result

export async function GET() {
  try {
    // Find the first whop and promo code
    const whops = await prisma.deal.findMany({
      include: { PromoCode: true },
      take: 1
    });

    if (whops.length === 0 || whops[0].PromoCode.length === 0) {
      return NextResponse.json(
        { error: "No whops or promo codes found" },
        { status: 404 }
      );
    }

    const whop = whops[0];
    const promoCode = whop.PromoCode[0];
    const now = new Date();

    // Create a test tracking entry using raw SQL
    const trackingId = `tr_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    await prisma.$executeRaw`
      INSERT INTO "OfferTracking" ("id", "whopId", "promoCodeId", "actionType", "createdAt")
      VALUES (${trackingId}, ${whop.id}, ${promoCode.id}, ${'test'}, ${now})
    `;

    // Count entries for this promo code using raw SQL
    const countResult = await prisma.$queryRaw<[{ count: BigInt }]>`
      SELECT COUNT(*) as count 
      FROM "OfferTracking" 
      WHERE "promoCodeId" = ${promoCode.id}
    `;
    
    const count = Number(countResult[0]?.count || 0);

    return NextResponse.json({
      success: true,
      tracking: {
        id: trackingId,
        whopId: whop.id,
        promoCodeId: promoCode.id,
        actionType: "test",
        createdAt: now
      },
      count,
      message: "Test tracking entry created successfully"
    });
  } catch (error) {
    console.error("Error creating test tracking:", error);
    return NextResponse.json(
      { error: "Failed to create test tracking entry" },
      { status: 500 }
    );
  }
} 