import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function manualPublishWhops() {
  try {
    console.log('🔍 Checking current publication status...');
    
    // Get current counts
    const [publishedCount, unpublishedCount] = await Promise.all([
      prisma.deal.count({ where: { publishedAt: { not: null } } }),
      prisma.deal.count({ where: { publishedAt: null } })
    ]);
    
    console.log(`📊 Current Status:`);
    console.log(`  Published: ${publishedCount}`);
    console.log(`  Unpublished: ${unpublishedCount}`);
    console.log(`  Total: ${publishedCount + unpublishedCount}`);
    
    if (unpublishedCount === 0) {
      console.log('✅ No more whops to publish!');
      return;
    }
    
    const batchSize = Math.min(250, unpublishedCount);
    console.log(`\n🚀 Publishing next ${batchSize} whops...`);
    
    // Get the oldest unpublished whops
    const whopsToPublish = await prisma.deal.findMany({
      where: { publishedAt: null },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      select: { 
        id: true,
        name: true,
        createdAt: true
      }
    });
    
    console.log(`📋 Found ${whopsToPublish.length} whops to publish:`);
    whopsToPublish.slice(0, 5).forEach((whop, index) => {
      console.log(`  ${index + 1}. ${whop.name} (created: ${whop.createdAt.toISOString().split('T')[0]})`);
    });
    if (whopsToPublish.length > 5) {
      console.log(`  ... and ${whopsToPublish.length - 5} more`);
    }
    
    // Publish them
    const today = new Date();
    await prisma.deal.updateMany({
      where: {
        id: { in: whopsToPublish.map(w => w.id) }
      },
      data: { publishedAt: today }
    });
    
    console.log(`\n✅ Successfully published ${whopsToPublish.length} whops!`);
    console.log(`📅 Published at: ${today.toISOString()}`);
    
    // Get updated counts
    const [newPublishedCount, newUnpublishedCount] = await Promise.all([
      prisma.deal.count({ where: { publishedAt: { not: null } } }),
      prisma.deal.count({ where: { publishedAt: null } })
    ]);
    
    console.log(`\n📊 Updated Status:`);
    console.log(`  Published: ${newPublishedCount} (+${newPublishedCount - publishedCount})`);
    console.log(`  Unpublished: ${newUnpublishedCount} (-${unpublishedCount - newUnpublishedCount})`);
    
    if (newUnpublishedCount > 0) {
      const daysRemaining = Math.ceil(newUnpublishedCount / 250);
      console.log(`\n⏰ At 250 per day, approximately ${daysRemaining} days remaining for full publication`);
    } else {
      console.log(`\n🎉 All whops are now published!`);
    }
    
  } catch (error) {
    console.error('❌ Error publishing whops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
manualPublishWhops(); 