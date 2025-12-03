import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function checkDatabaseConstraints() {
  try {
    console.log('🔍 Checking for database constraints...');
    
    // Try to update a whop to see if there are any constraints
    const testWhop = await prisma.deal.findFirst({
      where: { publishedAt: null },
      select: { id: true, name: true }
    });
    
    if (!testWhop) {
      console.log('❌ No unpublished whops found to test with');
      return;
    }
    
    console.log(`🧪 Testing with whop: ${testWhop.name}`);
    
    // Try to publish the test whop
    const beforeCount = await prisma.deal.count({
      where: { publishedAt: { not: null } }
    });
    
    console.log(`📊 Published count before test: ${beforeCount}`);
    
    await prisma.deal.update({
      where: { id: testWhop.id },
      data: { publishedAt: new Date() }
    });
    
    const afterCount = await prisma.deal.count({
      where: { publishedAt: { not: null } }
    });
    
    console.log(`📊 Published count after test: ${afterCount}`);
    
    // Wait a moment and check again
    console.log('⏳ Waiting 5 seconds...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    const finalCount = await prisma.deal.count({
      where: { publishedAt: { not: null } }
    });
    
    console.log(`📊 Published count after 5 seconds: ${finalCount}`);
    
    if (finalCount < afterCount) {
      console.log('🚨 ALERT: Something is unpublishing whops automatically!');
    } else {
      console.log('✅ No automatic unpublishing detected');
    }
    
  } catch (error) {
    console.error('❌ Error checking constraints:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
checkDatabaseConstraints(); 