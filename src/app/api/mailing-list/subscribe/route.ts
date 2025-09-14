import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export const runtime = 'nodejs'; // IMPORTANT for Prisma on Vercel
export const dynamic = 'force-dynamic';
export const revalidate = 0;

const SubscribeSchema = z.object({
  name: z.string().trim().min(1).max(80).optional(),
  email: z.string().trim().toLowerCase().email().max(320),
  source: z.string().optional().default('vip'), // e.g., 'vip' | 'blog' | etc.
});

async function parseRequest(req: Request) {
  const ctype = req.headers.get('content-type') || '';
  if (ctype.includes('application/json')) {
    const json = await req.json();
    return SubscribeSchema.parse(json);
  }
  // Handle <form> submissions without JS/with default form encoding
  if (ctype.includes('application/x-www-form-urlencoded') || ctype.includes('multipart/form-data')) {
    const form = await req.formData();
    return SubscribeSchema.parse({
      name: String(form.get('name') ?? ''),
      email: String(form.get('email') ?? ''),
      source: String(form.get('source') ?? 'vip'),
    });
  }
  // fall back
  try {
    return SubscribeSchema.parse(await req.json());
  } catch {
    return SubscribeSchema.parse({});
  }
}

// POST /api/mailing-list/subscribe - Subscribe user to mailing list
export async function POST(req: Request) {
  try {
    const { name, email, source } = await parseRequest(req);

    console.log('Processing mailing list subscription:', { email, name, source });

    // Generate UUID for belt-and-braces compatibility
    const id = randomUUID();

    // Use upsert to handle both new subscriptions and reactivations
    const subscriber = await prisma.mailingList.upsert({
      where: { email },
      update: { 
        name: name || undefined,
        source: source,
        status: 'ACTIVE',
        subscribedAt: new Date(),
        unsubscribedAt: null,
      },
      create: { 
        id, // Explicit ID for compatibility
        email, 
        name: name || null, 
        source: source, 
        status: 'ACTIVE',
        subscribedAt: new Date() 
      },
      select: {
        id: true,
        email: true,
        name: true,
        status: true,
        subscribedAt: true
      }
    });

    console.log('Successfully processed subscription:', {
      id: subscriber.id,
      email: subscriber.email,
      status: subscriber.status
    });

    return NextResponse.json({ 
      ok: true, 
      subscriberId: subscriber.id,
      message: 'Successfully subscribed to VIP mailing list!',
      subscriber: subscriber
    }, { status: 200 });

  } catch (err: any) {
    console.error('Subscribe route error:', {
      message: err?.message,
      code: err?.code,
      meta: err?.meta,
      stack: err?.stack,
      name: err?.name
    });

    // Prisma duplicate key (should not happen with upsert, but just in case)
    if (err?.code === 'P2002') {
      return NextResponse.json({
        ok: true,
        duplicate: true,
        message: 'Already subscribed to mailing list'
      }, { status: 200 });
    }

    // Zod validation errors
    if (err?.name === 'ZodError') {
      return NextResponse.json({
        ok: false,
        error: 'Invalid input',
        issues: err.flatten?.() || err.issues || []
      }, { status: 400 });
    }

    // Generic server error
    return NextResponse.json({
      ok: false,
      error: 'Server error',
      details: err?.message ?? String(err),
      code: err?.code
    }, { status: 500 });
  }
}