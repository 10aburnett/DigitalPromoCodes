import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { z } from 'zod';

export const runtime = 'nodejs'; // Prisma cannot run on Edge
export const dynamic = 'force-dynamic';

const IdSchema = z.string().min(10); // Validate ID format

// DELETE /api/admin/promo-submissions/[id] - Delete a promo code submission
export async function DELETE(
  _req: Request,
  { params }: { params: { id: string } }
) {
  try {
    const id = IdSchema.parse(params.id);

    console.log('Deleting promo submission from database:', id);

    // Hard delete the submission from the database
    const deleted = await prisma.promoCodeSubmission.delete({
      where: { id },
      select: {
        id: true,
        title: true,
        status: true,
        submitterEmail: true
      }
    });

    console.log('Successfully deleted promo submission from database:', {
      id: deleted.id,
      title: deleted.title,
      status: deleted.status,
      submitterEmail: deleted.submitterEmail
    });

    return NextResponse.json({
      ok: true,
      message: 'Promo code submission permanently deleted',
      deleted: deleted
    }, { status: 200 });

  } catch (err: any) {
    console.error('DELETE promo-submission failed:', err);
    
    // Prisma: record missing
    if (err?.code === 'P2025') {
      return NextResponse.json(
        { ok: false, error: 'Submission not found or already deleted' },
        { status: 404 }
      );
    }
    
    // Zod: bad id format
    if (err?.name === 'ZodError') {
      return NextResponse.json(
        { ok: false, error: 'Invalid submission ID format' },
        { status: 400 }
      );
    }
    
    // Generic server error
    return NextResponse.json(
      { 
        ok: false, 
        error: 'Failed to delete submission',
        details: err?.message,
        code: err?.code
      },
      { status: 500 }
    );
  }
}