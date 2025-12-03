import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth-utils";

// Define a type for decoded JWT token
interface DecodedToken {
  id: string;
  email: string;
  role: string;
}

export async function DELETE(request: Request) {
  try {
    // First, try to authenticate with JWT token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('admin-token')?.value;
    
    // Also try NextAuth session as a fallback
    const session = await getServerSession(authOptions);
    
    let isAuthorized = false;
    
    // Check JWT token authentication
    if (token) {
      try {
        const decoded = verify(token, JWT_SECRET) as DecodedToken;
        if (decoded.role === "ADMIN") {
          isAuthorized = true;
        }
      } catch (error) {
        console.error("JWT verification error:", error);
      }
    }
    
    // If not authorized via JWT, check NextAuth session
    if (!isAuthorized && session?.user?.role === "ADMIN") {
      isAuthorized = true;
    }
    
    // If not authorized by either method, return 401
    if (!isAuthorized) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get count of whops before deletion for reporting
    const whopCount = await prisma.deal.count();
    
    if (whopCount === 0) {
      return NextResponse.json({ 
        message: "No whops to delete",
        deletedCount: 0
      });
    }

    // Delete all associated data first (cascading deletes)
    // Delete all promo codes
    const promoCodeResult = await prisma.promoCode.deleteMany();

    // Delete all reviews
    const reviewResult = await prisma.review.deleteMany();

    // Delete all tracking data
    const trackingResult = await prisma.offerTracking.deleteMany();

    // Finally, delete all whops
    const whopResult = await prisma.deal.deleteMany();
    
    return NextResponse.json({ 
      message: `Successfully deleted all ${whopResult.count} whops and their associated data`,
      deletedCount: whopResult.count,
      details: {
        whops: whopResult.count,
        promoCodes: promoCodeResult.count,
        reviews: reviewResult.count,
        trackingRecords: trackingResult.count
      }
    });
  } catch (error) {
    console.error("Error deleting all whops:", error);
    return NextResponse.json(
      { error: "Failed to delete all whops" },
      { status: 500 }
    );
  }
} 