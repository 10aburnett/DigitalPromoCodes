export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const [posts, comments, promoSubmissions, mailingList] = await Promise.all([
      prisma.blogPost.count(),
      prisma.comment.count(),
      prisma.promoCodeSubmission.count(),
      prisma.mailingList.count(),
    ]);
    return NextResponse.json({
      ok: true,
      counts: { posts, comments, promoSubmissions, mailingList },
      timestamp: new Date().toISOString(),
      database: 'Connected successfully'
    });
  } catch (e: any) {
    console.error('[admin/_debug]', e);
    return NextResponse.json(
      { 
        ok: false, 
        message: e?.message, 
        code: e?.code, 
        stack: process.env.NODE_ENV === 'development' ? e?.stack : undefined,
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    );
  }
}