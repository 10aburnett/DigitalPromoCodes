import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { verifyAdminToken } from '@/lib/auth-utils';

export async function POST(request: NextRequest) {
  try {
    // Verify admin authentication
    const adminUser = await verifyAdminToken();
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { action, count } = await request.json();

    if (action === 'publish') {
      const batchSize = count || 250;
      const today = new Date();
      
      // Get unpublished whops count
      const unpublishedCount = await prisma.whop.count({
        where: { publishedAt: null }
      });

      if (unpublishedCount === 0) {
        return NextResponse.json({ 
          message: 'No more whops to publish',
          published: 0,
          remaining: 0
        });
      }

      // Get the oldest unpublished whops
      const whopsToPublish = await prisma.whop.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: Math.min(batchSize, unpublishedCount),
        select: { id: true }
      });

      // Publish them
      await prisma.whop.updateMany({
        where: {
          id: { in: whopsToPublish.map(w => w.id) }
        },
        data: { publishedAt: today }
      });

      const published = whopsToPublish.length;
      const remaining = unpublishedCount - published;

      return NextResponse.json({
        message: `Successfully published ${published} whops`,
        published,
        remaining,
        date: today.toISOString()
      });

    } else if (action === 'unpublish') {
      const batchSize = count || 250;
      
      // Get published whops count
      const publishedCount = await prisma.whop.count({
        where: { publishedAt: { not: null } }
      });

      if (publishedCount === 0) {
        return NextResponse.json({ 
          message: 'No published whops to unpublish',
          unpublished: 0,
          remaining: 0
        });
      }

      // Get the newest published whops
      const whopsToUnpublish = await prisma.whop.findMany({
        where: { publishedAt: { not: null } },
        orderBy: { publishedAt: 'desc' },
        take: Math.min(batchSize, publishedCount),
        select: { id: true }
      });

      // Unpublish them
      await prisma.whop.updateMany({
        where: {
          id: { in: whopsToUnpublish.map(w => w.id) }
        },
        data: { publishedAt: null }
      });

      const unpublished = whopsToUnpublish.length;
      const remaining = publishedCount - unpublished;

      return NextResponse.json({
        message: `Successfully unpublished ${unpublished} whops`,
        unpublished,
        remaining
      });

    } else if (action === 'status') {
      // Get publication status
      const [publishedCount, unpublishedCount] = await Promise.all([
        prisma.whop.count({ where: { publishedAt: { not: null } } }),
        prisma.whop.count({ where: { publishedAt: null } })
      ]);

      return NextResponse.json({
        published: publishedCount,
        unpublished: unpublishedCount,
        total: publishedCount + unpublishedCount
      });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });

  } catch (error) {
    console.error('Error in publish-whops admin endpoint:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}