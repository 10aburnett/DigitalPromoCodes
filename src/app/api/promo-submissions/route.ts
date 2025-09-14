import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs';           // IMPORTANT for Prisma on Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const TypeSchema = z
  .enum(['GENERAL', 'COURSE'])
  .or(z.literal('General Promo'))
  .or(z.literal('Course-Specific'))
  .transform((v) => (v === 'Course-Specific' ? 'COURSE' : v === 'General Promo' ? 'GENERAL' : v));

const BodySchema = z.object({
  type: TypeSchema.optional().default('GENERAL'),     // radio
  title: z.string().min(2).max(200),     // Promo Title
  description: z.string().min(2).max(4000),
  code: z.string().min(1).max(100).optional().nullable(),      // user can type "No code required" too
  value: z.string().min(1).max(200).optional().nullable(),     // Discount Value
  // Support both new and legacy field names
  name: z.string().min(2).max(200).optional(),      // Your Name (new format)
  email: z.string().email().max(320).optional(),    // Your Email (new format)
  message: z.string().max(4000).optional(),         // Additional Message (new format)
  submitterName: z.string().min(2).max(200).optional(),    // Legacy format
  submitterEmail: z.string().email().max(320).optional(),  // Legacy format  
  submitterMessage: z.string().max(4000).optional(),       // Legacy format
  isGeneral: z.boolean().optional(),
  whopId: z.string().optional().nullable(),
  customCourseName: z.string().max(200).optional().nullable(),
}).refine((data) => {
  // Require either new format (name + email) or legacy format (submitterName + submitterEmail)
  const hasNewFormat = data.name && data.email;
  const hasLegacyFormat = data.submitterName && data.submitterEmail;
  return hasNewFormat || hasLegacyFormat;
}, {
  message: "Either 'name' and 'email' OR 'submitterName' and 'submitterEmail' are required",
  path: ['name'] // Show error on name field
});

async function parseBody(req: Request) {
  const ctype = req.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const json = await req.json();
    return json;
  }
  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    const fd = await req.formData();
    return Object.fromEntries(fd.entries());
  }
  // fall back
  try {
    return await req.json();
  } catch {
    return {};
  }
}

// POST /api/promo-submissions - Submit new promo code
export async function POST(req: Request) {
  try {
    const raw = await parseBody(req);
    console.log('Received promo submission:', raw); // Debug log
    
    const parsed = BodySchema.parse(raw);
    
    // Handle both new and legacy field names
    const title = parsed.title;
    const description = parsed.description;
    const code = parsed.code;
    const value = parsed.value;
    const name = parsed.name || parsed.submitterName;
    const email = parsed.email || parsed.submitterEmail;
    const message = parsed.message || parsed.submitterMessage;
    const type = parsed.type;
    
    // Validate required fields after parsing
    if (!title || !description || !name || !email) {
      return NextResponse.json({
        ok: false,
        error: 'Missing required fields',
        details: 'title, description, name, and email are required'
      }, { status: 400 })
    }

    // Determine if this is a general promo (legacy isGeneral field or type field)
    const isGeneralPromo = parsed.isGeneral ?? (type === 'GENERAL');
    
    // If not general, validate course selection
    if (!isGeneralPromo) {
      if (!parsed.whopId && !parsed.customCourseName) {
        return NextResponse.json({
          ok: false,
          error: 'Course selection required for course-specific promo codes'
        }, { status: 400 })
      }

      // If whopId is provided, verify the course exists
      if (parsed.whopId) {
        const whopExists = await prisma.whop.findUnique({
          where: { id: parsed.whopId },
          select: { id: true }
        })

        if (!whopExists) {
          return NextResponse.json({
            ok: false,
            error: 'Selected course not found'
          }, { status: 400 })
        }
      }
    }

    // Get client IP and User-Agent for spam prevention
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : null
    const userAgent = req.headers.get('user-agent')

    // Generate UUID for the submission (belt-and-braces fix for stale Prisma client)
    const id = randomUUID();
    
    // Create the submission
    const submission = await prisma.promoCodeSubmission.create({
      data: {
        id, // Explicit ID to work with stale client
        title,
        description,
        code: code || null,
        value: value || null,
        submitterName: name,
        submitterEmail: email,
        submitterMessage: message || null,
        isGeneral: isGeneralPromo,
        whopId: isGeneralPromo ? null : parsed.whopId,
        customCourseName: parsed.customCourseName || null,
        ipAddress: ip || null,
        userAgent: userAgent || null,
      },
      select: {
        id: true,
        status: true,
        title: true,
        description: true,
        code: true,
        value: true,
        submitterName: true,
        submitterEmail: true,
        submitterMessage: true,
        isGeneral: true,
        createdAt: true,
      }
    })

    // Log the submission for monitoring
    console.log('New promo code submission:', {
      id: submission.id,
      title: submission.title,
      isGeneral: submission.isGeneral,
      submitter: submission.submitterEmail
    })

    return NextResponse.json({ ok: true, submission }, { status: 201 });
  } catch (err: any) {
    console.error('Promo submissions route error:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack,
      name: err?.name
    });

    // Zod validation error
    if (err?.issues) {
      return NextResponse.json({ ok: false, error: 'Invalid input', issues: err.issues }, { status: 400 });
    }

    // Prisma known errors
    if (err?.code === 'P2002') {
      return NextResponse.json({ ok: false, error: 'Duplicate record', code: err.code, meta: err.meta }, { status: 409 });
    }

    return NextResponse.json(
      { ok: false, error: 'Server error', code: err?.code ?? 'UNKNOWN', details: err?.message ?? String(err) },
      { status: 500 },
    );
  }
}

// GET /api/promo-submissions - List submissions (for admin)
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const status = searchParams.get('status')
    const limit = parseInt(searchParams.get('limit') || '50')
    const offset = parseInt(searchParams.get('offset') || '0')

    // Build where clause
    const where: any = {}
    if (status && ['PENDING', 'APPROVED', 'REJECTED', 'DUPLICATE', 'SPAM'].includes(status)) {
      where.status = status
    }

    const submissions = await prisma.promoCodeSubmission.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: limit,
      skip: offset,
      include: {
        Whop: {
          select: {
            name: true,
            slug: true
          }
        }
      }
    })

    const total = await prisma.promoCodeSubmission.count({ where })

    return NextResponse.json({
      submissions,
      total,
      limit,
      offset
    })

  } catch (err: any) {
    console.error('GET promo submissions route error:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack,
      name: err?.name
    });
    return NextResponse.json({
      ok: false,
      error: 'Server error',
      details: err?.message ?? String(err),
      code: err?.code
    }, { status: 500 });
  }
}