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
      // SECURITY: Unpublish functionality has been permanently disabled
      // to prevent accidental mass unpublishing incidents
      console.log(`🚨 BLOCKED: Admin ${adminUser.email} attempted to use disabled unpublish function`);
      
      return NextResponse.json({ 
        error: 'DISABLED: Unpublish functionality has been permanently disabled for security reasons.',
        reason: 'This prevents accidental mass unpublishing of whops.',
        alternatives: 'Use individual whop management in the admin panel if needed.',
        contact: 'Contact developer if unpublishing is absolutely necessary.',
        attemptedBy: adminUser.email,
        timestamp: new Date().toISOString()
      }, { status: 403 });

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