import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const legalPages = await prisma.legalPage.findMany({
      orderBy: { slug: 'asc' }
    });
    
    return NextResponse.json(legalPages);
  } catch (error) {
    console.error('Error fetching legal pages:', error);
    return NextResponse.json(
      { error: 'Failed to fetch legal pages' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { slug, title, content } = await request.json();
    
    if (!slug || !title || !content) {
      return NextResponse.json(
        { error: 'Missing required fields: slug, title, content' },
        { status: 400 }
      );
    }
    
    // Upsert the legal page (create or update)
    const legalPage = await prisma.legalPage.upsert({
      where: { slug },
      update: { title, content, updatedAt: new Date() },
      create: {
        id: require('crypto').randomUUID(),
        slug,
        title,
        content,
        updatedAt: new Date()
      }
    });
    
    return NextResponse.json(legalPage);
  } catch (error) {
    console.error('Error saving legal page:', error);
    return NextResponse.json(
      { error: 'Failed to save legal page' },
      { status: 500 }
    );
  }
} 