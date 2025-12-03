import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function debugDatabase() {
  try {
    console.log('🔍 Debugging database state...');
    
    // Check current counts
    const [publishedCount, unpublishedCount] = await Promise.all([
      prisma.deal.count({ where: { publishedAt: { not: null } } }),
      prisma.deal.count({ where: { publishedAt: null } })
    ]);
    
    console.log(`📊 Current Database State:`);
    console.log(`  Published: ${publishedCount}`);
    console.log(`  Unpublished: ${unpublishedCount}`);
    console.log(`  Total: ${publishedCount + unpublishedCount}`);
    
    // Check the most recently published whops
    const recentPublished = await prisma.deal.findMany({
      where: { publishedAt: { not: null } },
      orderBy: { publishedAt: 'desc' },
      take: 5,
      select: {
        id: true,
        name: true,
        publishedAt: true
      }
    });
    
    console.log(`\n📅 Most Recently Published:`);
    recentPublished.forEach((whop, index) => {
      console.log(`  ${index + 1}. ${whop.name} (published: ${whop.publishedAt})`);
    });
    
    // Check the oldest unpublished whops
    const oldestUnpublished = await prisma.deal.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: 5,
      select: {
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    console.log(`\n📅 Oldest Unpublished:`);
    oldestUnpublished.forEach((whop, index) => {
      console.log(`  ${index + 1}. ${whop.name} (created: ${whop.createdAt})`);
    });
    
    // Check if there are any whops with very recent publishedAt dates
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const recentlyPublished = await prisma.deal.count({
      where: {
        publishedAt: {
          gte: oneHourAgo
        }
      }
    });
    
    console.log(`\n⏰ Whops published in the last hour: ${recentlyPublished}`);
    
    // Check if there are any whops that were unpublished recently
    const recentlyUnpublished = await prisma.deal.count({
      where: {
        updatedAt: {
          gte: oneHourAgo
        },
        publishedAt: null
      }
    });
    
    console.log(`⏰ Whops updated to unpublished in the last hour: ${recentlyUnpublished}`);
    
  } catch (error) {
    console.error('❌ Error debugging database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
debugDatabase(); 