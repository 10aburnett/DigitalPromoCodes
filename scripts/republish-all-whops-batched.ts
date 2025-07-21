import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const BATCH_SIZE = 1000;

async function republishAllWhopsBatched() {
  try {
    console.log('🔍 Checking current publication status...');
    
    // Get current counts
    const [publishedCount, unpublishedCount, totalCount] = await Promise.all([
      prisma.whop.count({ where: { publishedAt: { not: null } } }),
      prisma.whop.count({ where: { publishedAt: null } }),
      prisma.whop.count()
    ]);
    
    console.log(`📊 Current Status:`);
    console.log(`  Published: ${publishedCount}`);
    console.log(`  Unpublished: ${unpublishedCount}`);
    console.log(`  Total: ${totalCount}`);
    
    if (unpublishedCount === 0) {
      console.log('✅ All whops are already published!');
      return;
    }
    
    const totalBatches = Math.ceil(unpublishedCount / BATCH_SIZE);
    console.log(`\n🚀 Publishing ${unpublishedCount} whops in ${totalBatches} batches of ${BATCH_SIZE}...`);
    
    let processedCount = 0;
    const today = new Date();
    
    for (let batchNum = 1; batchNum <= totalBatches; batchNum++) {
      console.log(`\n📦 Processing batch ${batchNum}/${totalBatches}...`);
      
      // Get unpublished whops for this batch
      const whopsToPublish = await prisma.whop.findMany({
        where: { publishedAt: null },
        take: BATCH_SIZE,
        select: { id: true, name: true },
        orderBy: { createdAt: 'asc' }
      });
      
      if (whopsToPublish.length === 0) {
        console.log('✅ No more whops to publish!');
        break;
      }
      
      console.log(`   Found ${whopsToPublish.length} whops to publish`);
      console.log(`   Examples: ${whopsToPublish.slice(0, 3).map(w => w.name).join(', ')}...`);
      
      // Publish this batch
      const result = await prisma.whop.updateMany({
        where: {
          id: { in: whopsToPublish.map(w => w.id) }
        },
        data: { publishedAt: today }
      });
      
      processedCount += result.count;
      console.log(`   ✅ Published ${result.count} whops (Total: ${processedCount}/${unpublishedCount})`);
      
      // Small delay to avoid overwhelming the database
      if (batchNum < totalBatches) {
        console.log('   ⏳ Waiting 1 second...');
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    // Get final counts
    const [finalPublishedCount, finalUnpublishedCount] = await Promise.all([
      prisma.whop.count({ where: { publishedAt: { not: null } } }),
      prisma.whop.count({ where: { publishedAt: null } })
    ]);
    
    console.log(`\n🎉 Batch publishing complete!`);
    console.log(`📊 Final Status:`);
    console.log(`  Published: ${finalPublishedCount} (+${processedCount})`);
    console.log(`  Unpublished: ${finalUnpublishedCount}`);
    console.log(`📅 All published at: ${today.toISOString()}`);
    
    if (finalUnpublishedCount === 0) {
      console.log(`\n🚀 All ${totalCount} whops are now LIVE!`);
    }
    
  } catch (error) {
    console.error('❌ Error republishing whops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
republishAllWhopsBatched();