import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log('Debug: Starting whops query...');
    
    // First, check total whops
    const totalWhops = await prisma.deal.count();
    console.log(`Debug: Total whops in database: ${totalWhops}`);
    
    // Check published whops
    const publishedWhops = await prisma.deal.count({
      where: { publishedAt: { not: null } }
    });
    console.log(`Debug: Published whops: ${publishedWhops}`);
    
    // Check unpublished whops
    const unpublishedWhops = await prisma.deal.count({
      where: { publishedAt: null }
    });
    console.log(`Debug: Unpublished whops: ${unpublishedWhops}`);
    
    // Get first published whop
    const firstPublishedWhop = await prisma.deal.findFirst({
      where: { publishedAt: { not: null } },
      select: {
        id: true,
        name: true,
        publishedAt: true,
        price: true
      }
    });
    
    return NextResponse.json({
      totalWhops,
      publishedWhops,
      unpublishedWhops,
      firstPublishedWhop,
      status: 'success'
    });
    
  } catch (error: any) {
    console.error('Debug error:', error);
    return NextResponse.json({
      error: error.message,
      stack: error.stack,
      status: 'failed'
    }, { status: 500 });
  }
}