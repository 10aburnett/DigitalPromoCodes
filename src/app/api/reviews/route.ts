import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { z } from 'zod'

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const whopId = searchParams.get('whopId');

    let whereClause = {};
    
    if (whopId) {
      // Try to find whop by ID first, then by slug if not found
      const whop = await prisma.deal.findFirst({
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
        Deal: {
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

const Rating = z.preprocess(v => Number(v), z.number().int().min(1).max(5))

const ReviewSchema = z.object({
  whopSlug: z.string().trim().optional(),
  whopId: z.string().trim().optional(),
  author: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  content: z.string().trim().min(1, 'Review must be at least 1 character').max(2000),
  rating: Rating,
  website: z.string().max(0).optional().or(z.literal(''))
}).refine((data) => {
  return data.whopId || data.whopSlug;
}, { message: "Either whopId or whopSlug is required" });

async function parseRequest(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return ReviewSchema.parse(await req.json());
  }
  // Handle form submissions
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const form = await req.formData();
    return ReviewSchema.parse({
      whopSlug: String(form.get('whopSlug') ?? ''),
      whopId: String(form.get('whopId') ?? ''),
      author: String(form.get('author') ?? form.get('name') ?? ''),
      content: String(form.get('content') ?? form.get('review') ?? ''),
      rating: form.get('rating'),
      website: String(form.get('website') ?? '')
    });
  }
  // Fallback
  try {
    return ReviewSchema.parse(await req.json());
  } catch {
    return ReviewSchema.parse({});
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log('Review submission received');
    
    // Parse and validate the data
    const data = await parseRequest(request);
    console.log('Processing review submission:', { 
      author: data.author, 
      whopId: data.whopId,
      whopSlug: data.whopSlug,
      rating: data.rating 
    });
    
    // Check honeypot (spam protection)
    if (data.website && data.website.length > 0) {
      console.log('Honeypot triggered, rejecting spam review');
      return NextResponse.json({
        error: 'Invalid review data',
        details: { website: ['This field should be empty'] }
      }, { status: 400 });
    }
    
    const { whopSlug, whopId, author, content, rating } = data;

    // Resolve whop - prefer whopSlug, fallback to whopId
    let whop;
    if (whopSlug) {
      whop = await prisma.deal.findUnique({
        where: { slug: whopSlug },
        select: { id: true, name: true }
      });
    } else if (whopId) {
      whop = await prisma.deal.findUnique({
        where: { id: whopId },
        select: { id: true, name: true }
      });
    }

    if (!whop) {
      return NextResponse.json({ error: 'Whop not found' }, { status: 404 })
    }

    console.log('Creating review for whop:', whop.id, whop.name);

    // Create review
    const review = await prisma.review.create({
      data: {
        id: require('crypto').randomUUID(),
        author: author.trim(),
        content: content.trim(),
        rating: rating,
        whopId: whop.id,
        verified: false,
        updatedAt: new Date()
      },
      select: {
        id: true,
        author: true,
        content: true,
        rating: true,
        createdAt: true,
        verified: true
      }
    });

    console.log('Review created successfully:', review.id);

    return NextResponse.json({ 
      success: true, 
      message: 'Review posted successfully',
      review: {
        id: review.id,
        author: review.author,
        content: review.content,
        rating: review.rating,
        createdAt: review.createdAt,
        verified: review.verified
      }
    });
  } catch (err: any) {
    console.error('Reviews API error:', err);
    
    // Zod validation errors
    if (err?.name === 'ZodError') {
      return NextResponse.json({
        error: 'Invalid review data',
        details: err.flatten()
      }, { status: 400 });
    }
    
    // Prisma duplicate key (unlikely but handle it)
    if (err?.code === 'P2002') {
      return NextResponse.json({
        success: true,
        duplicate: true,
        message: 'Review already submitted'
      }, { status: 200 });
    }
    
    // Generic server error
    return NextResponse.json({
      error: 'Server error',
      details: err?.message ?? String(err),
      code: err?.code
    }, { status: 500 });
  }
} 