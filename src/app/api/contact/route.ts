import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendContactEmail, sendAutoReply } from '@/lib/email';
import { z } from 'zod';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs'; // IMPORTANT for Prisma on Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

// FINAL schema with proper validation
const ContactSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().trim().email('Valid email required').toLowerCase().max(320),
  subject: z.string().trim().min(2, 'Subject must be at least 2 characters').max(200),
  message: z.string().trim().min(10, 'Message must be at least 10 characters').max(4000),
  // Honeypot (keep hidden on the client). Any content -> reject.
  website: z.string().max(0).optional().or(z.literal('')),
});

// Validation schema for bulk delete
const bulkDeleteSchema = z.object({
  ids: z.array(z.string()).min(1, "At least one ID is required"),
});

async function parseRequest(req: Request) {
  const ct = req.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    return ContactSchema.parse(await req.json());
  }
  // Handle form submissions
  if (ct.includes('application/x-www-form-urlencoded') || ct.includes('multipart/form-data')) {
    const form = await req.formData();
    return ContactSchema.parse({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      subject: String(form.get('subject') ?? ''),
      message: String(form.get('message') ?? ''),
      website: String(form.get('website') ?? ''),
    });
  }
  // Fallback
  try {
    return ContactSchema.parse(await req.json());
  } catch {
    return ContactSchema.parse({});
  }
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    
    // Build where clause based on status filter
    const whereClause = status && status !== 'all' 
      ? { status: status.toUpperCase() as 'UNREAD' | 'READ' | 'REPLIED' }
      : {};
    
    const submissions = await prisma.contactSubmission.findMany({
      where: whereClause,
      orderBy: { createdAt: 'desc' }
    });
    
    return NextResponse.json(submissions);
  } catch (error: any) {
    console.error('Error fetching contact submissions:', error);
    return NextResponse.json(
      { error: 'Failed to fetch contact submissions' },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  try {
    console.log('Contact form submission received');
    
    // Parse and validate the data
    const data = await parseRequest(req);
    console.log('Processing contact submission:', { name: data.name, email: data.email, subject: data.subject });
    
    // Check honeypot (spam protection)
    if (data.website && data.website.length > 0) {
      console.log('Honeypot triggered, rejecting spam submission');
      return NextResponse.json({
        error: 'Invalid contact data',
        details: { website: ['This field should be empty'] }
      }, { status: 400 });
    }
    
    const { name, email, subject, message } = data;
    
    // Generate UUID for belt-and-braces compatibility
    const id = randomUUID();
    const now = new Date();

    // Save to database with explicit ID
    const submission = await prisma.contactSubmission.create({
      data: {
        id, // Explicit ID for compatibility
        name,
        email,
        subject,
        message,
        status: 'UNREAD',
        createdAt: now,
        updatedAt: now,
      },
      select: {
        id: true,
        name: true,
        email: true,
        subject: true,
        status: true,
        createdAt: true
      }
    });
    
    console.log('Contact submission saved:', submission.id);
    
    // Send emails (wrapped in try/catch to not fail the request)
    try {
      // Send notification email to whpcodes@gmail.com
      await sendContactEmail({ name, email, subject, message });
      console.log('Contact notification email sent');
      
      // Send auto-reply to user
      await sendAutoReply({ name, email, subject, message });
      console.log('Auto-reply email sent');
      
    } catch (emailError) {
      console.error('Email sending failed (continuing anyway):', emailError);
      // Don't fail the request if email fails - the submission was successful
    }
    
    return NextResponse.json({
      ok: true,
      message: "Contact form submitted successfully",
      submission: submission
    }, { status: 200 });
    
  } catch (err: any) {
    console.error('Contact route error:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack,
      name: err?.name
    });
    
    // Zod validation errors
    if (err?.name === 'ZodError') {
      return NextResponse.json({
        error: 'Invalid contact data',
        details: err.flatten()
      }, { status: 400 });
    }
    
    // Prisma duplicate key (unlikely but handle it)
    if (err?.code === 'P2002') {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: 'Contact form already submitted'
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

export async function DELETE(request: Request) {
  try {
    const data = await request.json();
    
    // Validate the data
    const validationResult = bulkDeleteSchema.safeParse(data);
    if (!validationResult.success) {
      return NextResponse.json({
        error: "Invalid delete data",
        details: validationResult.error.format(),
      }, { status: 400 });
    }
    
    const { ids } = validationResult.data;
    
    // Delete multiple submissions
    const result = await prisma.contactSubmission.deleteMany({
      where: {
        id: {
          in: ids
        }
      }
    });
    
    return NextResponse.json({
      success: true,
      message: `Successfully deleted ${result.count} submissions`,
      deletedCount: result.count
    });
    
  } catch (error: any) {
    console.error('Error bulk deleting contact submissions:', error);
    return NextResponse.json(
      { error: 'Failed to delete contact submissions' },
      { status: 500 }
    );
  }
} 