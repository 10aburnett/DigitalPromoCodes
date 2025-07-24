import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function swapHavenPositions() {
  try {
    console.log('🔄 SWAPPING THE HAVEN POSITIONS');
    console.log('===============================\n');
    
    // Find both Haven whops
    const theHaven = await prisma.whop.findFirst({
      where: { name: 'The Haven' }
    });
    
    const theHavenCrypto = await prisma.whop.findFirst({
      where: { name: 'The Haven (Pay with Crypto)' }
    });
    
    if (!theHaven || !theHavenCrypto) {
      console.log('❌ Could not find both Haven whops');
      return;
    }
    
    console.log('📍 CURRENT POSITIONS:');
    console.log(`- "The Haven": position ${theHaven.displayOrder}`);
    console.log(`- "The Haven (Pay with Crypto)": position ${theHavenCrypto.displayOrder}`);
    
    // Swap their display orders
    const tempOrder = theHaven.displayOrder;
    
    // Update The Haven to take Pay with Crypto's position (27)
    await prisma.whop.update({
      where: { id: theHaven.id },
      data: { displayOrder: theHavenCrypto.displayOrder }
    });
    
    // Update The Haven (Pay with Crypto) to take The Haven's position (33)
    await prisma.whop.update({
      where: { id: theHavenCrypto.id },
      data: { displayOrder: tempOrder }
    });
    
    console.log('\n✅ SWAP COMPLETED:');
    console.log(`- "The Haven": position ${theHavenCrypto.displayOrder} (moved from ${tempOrder})`);
    console.log(`- "The Haven (Pay with Crypto)": position ${tempOrder} (moved from ${theHavenCrypto.displayOrder})`);
    
    console.log('\n🎯 RESULT: Users will now see "The Haven" before "The Haven (Pay with Crypto)"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

swapHavenPositions();