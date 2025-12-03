import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function testPublishLimit() {
  try {
    console.log('🧪 Testing if there\'s a limit on published whops...');
    
    // Get current counts
    const [publishedCount, unpublishedCount] = await Promise.all([
      prisma.deal.count({ where: { publishedAt: { not: null } } }),
      prisma.deal.count({ where: { publishedAt: null } })
    ]);
    
    console.log(`📊 Current state: ${publishedCount} published, ${unpublishedCount} unpublished`);
    
    // Try to publish in smaller batches to see if there's a limit
    const batchSizes = [100, 250, 500, 1000];
    
    for (const batchSize of batchSizes) {
      console.log(`\n🔍 Testing batch size: ${batchSize}`);
      
      // Get unpublished whops
      const whopsToPublish = await prisma.deal.findMany({
        where: { publishedAt: null },
        take: batchSize,
        select: { id: true }
      });
      
      if (whopsToPublish.length === 0) {
        console.log('✅ No more whops to publish');
        break;
      }
      
      console.log(`📝 Publishing ${whopsToPublish.length} whops...`);
      
      // Publish them
      await prisma.deal.updateMany({
        where: {
          id: { in: whopsToPublish.map(w => w.id) }
        },
        data: { publishedAt: new Date() }
      });
      
      // Check count after publishing
      const newPublishedCount = await prisma.deal.count({
        where: { publishedAt: { not: null } }
      });
      
      console.log(`📊 Published count after batch: ${newPublishedCount}`);
      
      // Wait a moment and check again
      console.log('⏳ Waiting 3 seconds...');
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      const finalCount = await prisma.deal.count({
        where: { publishedAt: { not: null } }
      });
      
      console.log(`📊 Final count after 3 seconds: ${finalCount}`);
      
      if (finalCount < newPublishedCount) {
        console.log(`🚨 ALERT: Batch size ${batchSize} caused unpublishing!`);
        break;
      } else {
        console.log(`✅ Batch size ${batchSize} worked fine`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error testing publish limit:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
testPublishLimit(); 