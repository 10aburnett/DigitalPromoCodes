import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Review } from "@prisma/client";
import { verify as verifyJWT } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth-utils";
import { cookies } from "next/headers";

export async function GET(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    // Check that ID is provided
    if (!params.id) {
      return NextResponse.json({ error: "Review ID is required" }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    }
    
    // Fetch the review
    const review = await prisma.review.findUnique({
      where: { id: params.id },
      include: {
        Deal: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true
          }
        }
      }
    });

    if (!review) {
      return NextResponse.json({ error: "Review not found" }, { 
        status: 404,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    }

    return NextResponse.json(review, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error: any) {
    console.error("Error fetching review:", error);
    return NextResponse.json(
      { error: "Failed to fetch review", details: error.message },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      }
    );
  }
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
        const decoded = verifyJWT(token, JWT_SECRET) as any;
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

    // Check that ID is provided
    if (!params.id) {
      return NextResponse.json({ error: "Review ID is required" }, { status: 400 });
    }

    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.author || !data.content || !data.rating || !data.whopId) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    // Update the review
    const review = await prisma.review.update({
      where: { id: params.id },
      data: {
        author: data.author,
        content: data.content,
        rating: typeof data.rating === 'string' ? parseFloat(data.rating) : data.rating,
        whopId: data.whopId,
      },
      include: {
        Deal: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true
          }
        }
      }
    });
    
    return NextResponse.json(review);
  } catch (error: any) {
    console.error("Error updating review:", error);
    return NextResponse.json(
      { error: "Failed to update review", details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } }
) {
  try {
    console.log(`DELETE request for review ID: ${params.id}`);
    
    // First, try to authenticate with JWT token from cookies
    const cookieStore = cookies();
    const token = cookieStore.get('admin-token')?.value;
    
    // Also try NextAuth session as a fallback
    const session = await getServerSession(authOptions);
    
    let isAuthorized = false;
    
    // Check JWT token authentication
    if (token) {
      try {
        const decoded = verifyJWT(token, JWT_SECRET) as any;
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
      return NextResponse.json({ error: "Unauthorized" }, { 
        status: 401,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    }

    // Check that ID is provided
    if (!params.id) {
      return NextResponse.json({ error: "Review ID is required" }, { 
        status: 400,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      });
    }
    
    // Delete the review
    const review = await prisma.review.delete({
      where: { id: params.id }
    });
    
    console.log(`Successfully deleted review: ${params.id}`);

    return NextResponse.json({ message: "Review deleted successfully" }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error: any) {
    console.error("Error deleting review:", error);
    return NextResponse.json(
      { 
        error: "Failed to delete review", 
        details: error.message,
        code: error.code
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate'
        }
      }
    );
  }
} 