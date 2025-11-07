import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

// Validation schema for review submissions
const reviewSchema = z.object({
  author: z.string().min(1, "Name is required"),
  content: z.string().min(3, "Review content must be at least 3 characters"),
  rating: z.number().min(1).max(5),
  whopId: z.string().min(1, "Whop ID is required"),
});

export async function POST(request: Request) {
  try {
    // Parse request body
    const data = await request.json();
    
    // Validate the data
    const validationResult = reviewSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json({
        error: "Invalid review data",
        details: validationResult.error.format(),
      }, { status: 400 });
    }
    
    // Check if the whop exists
    const whop = await prisma.whop.findUnique({
      where: { id: data.whopId },
    });

    if (!whop) {
      return NextResponse.json({
        error: "Whop not found",
      }, { status: 404 });
    }

    // Create the review directly - these will show up in admin for moderation
    // In a real system, you might use a separate pending_reviews table
    const review = await prisma.review.create({
      data: {
        id: require('crypto').randomUUID(),
        author: data.author,
        content: data.content,
        rating: data.rating,
        whopId: data.whopId,
        verified: false,
        updatedAt: new Date()
      },
    });
    
    return NextResponse.json({
      success: true,
      message: "Review submitted successfully",
      reviewId: review.id,
    });
  } catch (error: any) {
    console.error("Error submitting review:", error);
    return NextResponse.json({
      error: "Failed to submit review",
      details: error.message,
    }, { status: 500 });
  }
} 