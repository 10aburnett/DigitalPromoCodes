import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function swapStellarPositions() {
  try {
    console.log('🔄 SWAPPING STELLAR AIO POSITIONS');
    console.log('=================================\n');
    
    // Find both Stellar whops
    const stellarAIO = await prisma.whop.findFirst({
      where: { name: 'Stellar AIO' }
    });
    
    const stellar3rdInstance = await prisma.whop.findFirst({
      where: { name: 'Stellar AIO 3rd Instance' }
    });
    
    if (!stellarAIO || !stellar3rdInstance) {
      console.log('❌ Could not find both Stellar whops');
      return;
    }
    
    console.log('📍 CURRENT POSITIONS:');
    console.log(`- "Stellar AIO": position ${stellarAIO.displayOrder}`);
    console.log(`- "Stellar AIO 3rd Instance": position ${stellar3rdInstance.displayOrder}`);
    
    // Swap their display orders
    const tempOrder = stellarAIO.displayOrder;
    
    // Update Stellar AIO to take 3rd Instance's position (18)
    await prisma.whop.update({
      where: { id: stellarAIO.id },
      data: { displayOrder: stellar3rdInstance.displayOrder }
    });
    
    // Update Stellar AIO 3rd Instance to take Stellar AIO's position (34)
    await prisma.whop.update({
      where: { id: stellar3rdInstance.id },
      data: { displayOrder: tempOrder }
    });
    
    console.log('\n✅ SWAP COMPLETED:');
    console.log(`- "Stellar AIO": position ${stellar3rdInstance.displayOrder} (moved from ${tempOrder})`);
    console.log(`- "Stellar AIO 3rd Instance": position ${tempOrder} (moved from ${stellar3rdInstance.displayOrder})`);
    
    console.log('\n🎯 RESULT: Users will now see "Stellar AIO" before "Stellar AIO 3rd Instance"');
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

swapStellarPositions();