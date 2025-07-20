import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkWhopStatus() {
  try {
    console.log('🔍 Checking whop publication status...');
    
    // Get current counts
    const [publishedCount, unpublishedCount] = await Promise.all([
      prisma.whop.count({ where: { publishedAt: { not: null } } }),
      prisma.whop.count({ where: { publishedAt: null } })
    ]);
    
    const total = publishedCount + unpublishedCount;
    const publishedPercentage = ((publishedCount / total) * 100).toFixed(1);
    
    console.log(`\n📊 Publication Status:`);
    console.log(`  Published: ${publishedCount} (${publishedPercentage}%)`);
    console.log(`  Unpublished: ${unpublishedCount}`);
    console.log(`  Total: ${total}`);
    
    if (unpublishedCount > 0) {
      const daysRemaining = Math.ceil(unpublishedCount / 250);
      console.log(`\n⏰ At 250 per day, approximately ${daysRemaining} days remaining for full publication`);
      
      // Show next batch preview
      const nextBatch = await prisma.whop.findMany({
        where: { publishedAt: null },
        orderBy: { createdAt: 'asc' },
        take: 5,
        select: { 
          name: true,
          createdAt: true
        }
      });
      
      console.log(`\n📋 Next 5 whops to be published:`);
      nextBatch.forEach((whop, index) => {
        console.log(`  ${index + 1}. ${whop.name} (created: ${whop.createdAt.toISOString().split('T')[0]})`);
      });
    } else {
      console.log(`\n🎉 All whops are published!`);
    }
    
    // Show recent publications
    const recentPublished = await prisma.whop.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: { 
        name: true,
        publishedAt: true
      }
    });
    
    console.log(`\n📅 Recently published (last 5):`);
    recentPublished.forEach((whop, index) => {
      console.log(`  ${index + 1}. ${whop.name} (published: ${whop.publishedAt?.toISOString().split('T')[0]})`);
    });
    
  } catch (error) {
    console.error('❌ Error checking status:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkWhopStatus(); 