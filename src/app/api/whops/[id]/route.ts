import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const whop = await prisma.whop.findUnique({
      where: { id: params.id },
      include: {
        PromoCode: true,
        reviews: {
          where: { verified: true }
        }
      }
    });

    if (!whop) {
      return NextResponse.json(
        { error: "Whop not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(whop);
  } catch (error) {
    console.error("Error fetching whop:", error);
    return NextResponse.json(
      { error: "Failed to fetch whop" },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    const data = await request.json();
    
    // Extract promo code data from the request
    const {
      promoCodeId,
      promoTitle,
      promoDescription,
      promoCode,
      promoType,
      promoValue,
      ...whopData
    } = data;

    // Update the whop
    const updatedWhop = await prisma.whop.update({
      where: { id: params.id },
      data: whopData,
      include: {
        PromoCode: true,
        reviews: {
          where: { verified: true }
        }
      }
    });

    // Update or create promo code if provided
    if (promoTitle && promoDescription && promoValue) {
      if (promoCodeId) {
        // Update existing promo code
        await prisma.promoCode.update({
          where: { id: promoCodeId },
          data: {
            title: promoTitle,
            description: promoDescription,
            code: promoCode || null,
            type: promoType,
            value: promoValue
          }
        });
      } else {
        // Create new promo code
        await prisma.promoCode.create({
          data: {
            title: promoTitle,
            description: promoDescription,
            code: promoCode || null,
            type: promoType,
            value: promoValue,
            whopId: params.id
          }
        });
      }
    }

    return NextResponse.json(updatedWhop);
  } catch (error) {
    console.error("Error updating whop:", error);
    return NextResponse.json(
      { error: "Failed to update whop" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Delete associated promo codes first
    await prisma.promoCode.deleteMany({
      where: { whopId: params.id }
    });

    // Delete associated reviews
    await prisma.review.deleteMany({
      where: { whopId: params.id }
    });

    // Delete associated tracking data
    await prisma.offerTracking.deleteMany({
      where: { whopId: params.id }
    });

    // Delete the whop
    await prisma.whop.delete({
      where: { id: params.id }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting whop:", error);
    return NextResponse.json(
      { error: "Failed to delete whop" },
      { status: 500 }
    );
  }
} 