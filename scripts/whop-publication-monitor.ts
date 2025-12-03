import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function monitorWhopPublication() {
  try {
    console.log('🔍 Monitoring whop publication status...');
    console.log(`📅 Check time: ${new Date().toISOString()}`);
    
    // Get current counts
    const [publishedCount, unpublishedCount, totalCount] = await Promise.all([
      prisma.deal.count({ where: { publishedAt: { not: null } } }),
      prisma.deal.count({ where: { publishedAt: null } }),
      prisma.deal.count()
    ]);
    
    console.log(`📊 Current Status:`);
    console.log(`  Published: ${publishedCount}`);
    console.log(`  Unpublished: ${unpublishedCount}`);
    console.log(`  Total: ${totalCount}`);
    
    // Calculate percentage published
    const percentagePublished = (publishedCount / totalCount * 100).toFixed(1);
    console.log(`  Published: ${percentagePublished}%`);
    
    // Check for concerning patterns
    const alerts = [];
    
    // Alert 1: Significant unpublished whops
    if (unpublishedCount > 1000) {
      alerts.push(`🚨 HIGH: ${unpublishedCount} whops are unpublished (${((unpublishedCount/totalCount)*100).toFixed(1)}%)`);
    } else if (unpublishedCount > 100) {
      alerts.push(`⚠️  MEDIUM: ${unpublishedCount} whops are unpublished`);
    }
    
    // Alert 2: Recently unpublished whops
    const recentlyUnpublished = await prisma.deal.count({
      where: {
        publishedAt: null,
        updatedAt: {
          gte: new Date(Date.now() - 60 * 60 * 1000) // Last hour
        }
      }
    });
    
    if (recentlyUnpublished > 100) {
      alerts.push(`🚨 URGENT: ${recentlyUnpublished} whops were unpublished in the last hour!`);
    } else if (recentlyUnpublished > 10) {
      alerts.push(`⚠️  WARNING: ${recentlyUnpublished} whops were unpublished in the last hour`);
    }
    
    // Alert 3: Mass update detection (same updatedAt for many whops)
    const massUpdates = await prisma.deal.groupBy({
      by: ['updatedAt'],
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      _count: { id: true },
      having: {
        id: { _count: { gt: 500 } } // More than 500 whops updated at the same time
      },
      orderBy: { updatedAt: 'desc' },
      take: 1
    });
    
    if (massUpdates.length > 0) {
      const massUpdate = massUpdates[0];
      alerts.push(`🚨 MASS UPDATE: ${massUpdate._count.id} whops were updated simultaneously at ${massUpdate.updatedAt.toISOString()}`);
    }
    
    // Display alerts
    if (alerts.length > 0) {
      console.log(`\n🚨 ALERTS (${alerts.length}):`);
      alerts.forEach(alert => console.log(`   ${alert}`));
      
      // Additional investigation for alerts
      if (unpublishedCount > 0) {
        console.log(`\n🔍 Sample unpublished whops:`);
        const sampleUnpublished = await prisma.deal.findMany({
          where: { publishedAt: null },
          select: { name: true, updatedAt: true },
          orderBy: { updatedAt: 'desc' },
          take: 5
        });
        
        sampleUnpublished.forEach((whop, i) => {
          const hoursAgo = Math.round((Date.now() - whop.updatedAt.getTime()) / (1000 * 60 * 60));
          console.log(`     ${i + 1}. ${whop.name} (updated ${hoursAgo}h ago)`);
        });
      }
    } else {
      console.log(`\n✅ All systems normal - No alerts detected`);
    }
    
    // Save monitoring log
    const logEntry = {
      timestamp: new Date().toISOString(),
      publishedCount,
      unpublishedCount,
      totalCount,
      percentagePublished: parseFloat(percentagePublished),
      alerts: alerts.length,
      alertMessages: alerts
    };
    
    console.log(`\n📝 Monitor log saved:`, JSON.stringify(logEntry, null, 2));
    
    return {
      status: alerts.length > 0 ? 'ALERTS' : 'OK',
      ...logEntry
    };
    
  } catch (error) {
    console.error('❌ Monitoring error:', error);
    return {
      status: 'ERROR',
      error: error.message,
      timestamp: new Date().toISOString()
    };
  } finally {
    await prisma.$disconnect();
  }
}

// Run the monitor
if (require.main === module) {
  monitorWhopPublication().then(result => {
    console.log(`\n🏁 Monitor completed with status: ${result.status}`);
    process.exit(result.status === 'ERROR' ? 1 : 0);
  });
}

export default monitorWhopPublication;