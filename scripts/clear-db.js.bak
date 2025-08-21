const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearDatabase() {
  console.log('Clearing database...');
  
  try {
    // First delete all reviews (they reference whops)
    await prisma.review.deleteMany();
    console.log('✓ All reviews deleted');
    
    // Then delete all promo codes (they reference whops)
    await prisma.promoCode.deleteMany();
    console.log('✓ All promo codes deleted');
    
    // Delete all offer trackings
    await prisma.offerTracking.deleteMany();
    console.log('✓ All offer trackings deleted');
    
    // Delete all bulk imports
    await prisma.bulkImport.deleteMany();
    console.log('✓ All bulk imports deleted');
    
    // Finally delete all whops
    await prisma.whop.deleteMany();
    console.log('✓ All whops deleted');
    
    console.log('Database cleared successfully!');
  } catch (error) {
    console.error('Error clearing database:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the function
clearDatabase(); 