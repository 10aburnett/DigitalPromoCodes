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

export async function PUT(request: Request) {
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

    // Process the bulk verify request
    const data = await request.json();
    const { ids } = data;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json(
        { error: "No valid review IDs provided" },
        { status: 400 }
      );
    }

    // Verify the reviews
    const result = await prisma.review.updateMany({
      where: { id: { in: ids } },
      data: { verified: true }
    });
    
    // Update ratings for all affected whops
    const updatedReviews = await prisma.review.findMany({
      where: { id: { in: ids } },
      select: { whopId: true }
    });
    
    const uniqueWhopIds = [...new Set(updatedReviews.map(r => r.whopId))];
    
    // Update each whop's rating based on verified reviews
    for (const whopId of uniqueWhopIds) {
      const verifiedReviews = await prisma.review.findMany({
        where: { 
          whopId: whopId,
          verified: true,
        },
      });
      
      if (verifiedReviews.length > 0) {
        const totalRating = verifiedReviews.reduce(
          (sum, review) => sum + review.rating,
          0
        );
        const averageRating = totalRating / verifiedReviews.length;
        
        await prisma.deal.update({
          where: { id: whopId },
          data: { rating: averageRating },
        });
      }
    }
    
    return NextResponse.json({ 
      message: `Successfully verified ${result.count} reviews`,
      count: result.count
    });
  } catch (error) {
    console.error("Error bulk verifying reviews:", error);
    return NextResponse.json(
      { error: "Failed to verify reviews" },
      { status: 500 }
    );
  }
} 