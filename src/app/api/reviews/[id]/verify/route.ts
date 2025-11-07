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

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
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
      console.error("Authorization failed - No valid JWT token or NextAuth session found");
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Check that ID is provided
    if (!params.id) {
      return NextResponse.json({ error: "Review ID is required" }, { status: 400 });
    }

    // Find the review to verify it exists
    const existingReview = await prisma.review.findUnique({
      where: { id: params.id },
    });

    if (!existingReview) {
      return NextResponse.json({ error: "Review not found" }, { status: 404 });
    }

    // Update the review to mark it as verified
    const updatedReview = await prisma.review.update({
      where: { id: params.id },
      data: { verified: true },
      include: {
        Whop: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true
          }
        }
      }
    });
    
    // Update the whop's average rating based on verified reviews
    const whopId = existingReview.whopId;
    const verifiedReviews = await prisma.review.findMany({
      where: { 
        whopId: whopId,
        verified: true,
      },
    });
    
    // Calculate and update the whop's rating if there are verified reviews
    if (verifiedReviews.length > 0) {
      const totalRating = verifiedReviews.reduce(
        (sum, review) => sum + review.rating,
        0
      );
      const averageRating = totalRating / verifiedReviews.length;
      
      await prisma.whop.update({
        where: { id: whopId },
        data: { rating: averageRating },
      });
    }
    
    return NextResponse.json({
      success: true,
      message: "Review verified successfully",
      review: updatedReview,
    });
  } catch (error: any) {
    console.error("Error verifying review:", error);
    return NextResponse.json(
      { error: "Failed to verify review", details: error.message },
      { status: 500 }
    );
  }
} 