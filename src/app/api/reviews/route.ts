import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";

export const maxDuration = 60; // Allow the function to run for 60 seconds

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const whopId = searchParams.get('whopId');

    let whereClause = {};
    
    if (whopId) {
      // Try to find whop by ID first, then by slug if not found
      const whop = await prisma.whop.findFirst({
        where: {
          OR: [
            { id: whopId },
            { slug: whopId }
          ]
        },
        select: { id: true }
      });
      
      if (whop) {
        whereClause = { whopId: whop.id };
      } else {
        // If no whop found, return empty array
        return NextResponse.json([]);
      }
    }

    const reviews = await prisma.review.findMany({
      where: whereClause,
      include: {
        whop: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true
          }
        }
      },
      orderBy: [
        { verified: 'desc' }, // Show verified reviews first
        { createdAt: 'desc' }
      ]
    });

    return NextResponse.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    
    // Validate required fields
    if (!data.author || !data.content || !data.rating || !data.whopId) {
      return NextResponse.json(
        { error: 'Missing required fields: author, content, rating, whopId' },
        { status: 400 }
      );
    }

    // Validate rating is between 1 and 5
    if (data.rating < 1 || data.rating > 5) {
      return NextResponse.json(
        { error: 'Rating must be between 1 and 5' },
        { status: 400 }
      );
    }

    // Find the whop by ID or slug to ensure it exists and get the correct ID
    const whop = await prisma.whop.findFirst({
      where: {
        OR: [
          { id: data.whopId },
          { slug: data.whopId }
        ]
      },
      select: { id: true, name: true }
    });

    if (!whop) {
      console.error('Whop not found for whopId:', data.whopId);
      return NextResponse.json(
        { error: 'Whop not found' },
        { status: 404 }
      );
    }

    console.log('Creating review for whop:', whop.id, whop.name);

    // Generate a unique ID for the review
    const reviewId = `rev_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const review = await prisma.review.create({
      data: {
        id: reviewId,
        author: data.author,
        content: data.content,
        rating: parseFloat(data.rating),
        whopId: whop.id, // Use the actual whop ID
        verified: false, // Reviews start as unverified
        updatedAt: new Date()
      },
      include: {
        whop: {
          select: {
            id: true,
            name: true,
            slug: true,
            logo: true
          }
        }
      }
    });

    return NextResponse.json(review, { status: 201 });
  } catch (error) {
    console.error('Error creating review:', error);
    return NextResponse.json(
      { error: 'Failed to create review' },
      { status: 500 }
    );
  }
} 