import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET() {
  try {
    console.log('Resetting whop publication status...');
    
    // First, unpublish ALL whops
    await prisma.whop.updateMany({
      data: {
        publishedAt: null
      }
    });
    
    console.log('All whops unpublished');
    
    // Then, publish only the oldest 250 whops
    const oldestWhops = await prisma.whop.findMany({
      orderBy: {
        createdAt: 'asc'
      },
      take: 250,
      select: {
        id: true
      }
    });
    
    console.log(`Found ${oldestWhops.length} oldest whops to publish`);
    
    // Publish the oldest 250
    await prisma.whop.updateMany({
      where: {
        id: {
          in: oldestWhops.map(whop => whop.id)
        }
      },
      data: {
        publishedAt: new Date()
      }
    });
    
    // Get final counts
    const publishedCount = await prisma.whop.count({
      where: { publishedAt: { not: null } }
    });
    
    const unpublishedCount = await prisma.whop.count({
      where: { publishedAt: null }
    });
    
    console.log(`Reset complete - Published: ${publishedCount}, Unpublished: ${unpublishedCount}`);
    
    return NextResponse.json({
      message: 'Successfully reset whop publication status',
      publishedCount,
      unpublishedCount,
      status: 'success'
    });
    
  } catch (error: any) {
    console.error('Reset error:', error);
    return NextResponse.json({
      error: error.message,
      status: 'failed'
    }, { status: 500 });
  }
}