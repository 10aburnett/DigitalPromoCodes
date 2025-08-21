const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function deleteAllReviews() {
  console.log('Starting to delete all reviews...');

  try {
    // Count reviews before deletion
    const reviewCount = await prisma.review.count();
    console.log(`Found ${reviewCount} reviews in the database.`);
    
    if (reviewCount === 0) {
      console.log('No reviews to delete.');
      return;
    }
    
    // Delete all reviews
    const deleteResult = await prisma.review.deleteMany({});
    
    console.log(`Successfully deleted ${deleteResult.count} reviews.`);
    
    // Reset casino ratings to 0
    const casinoUpdateResult = await prisma.casino.updateMany({
      data: {
        rating: 0
      }
    });
    
    console.log(`Reset ratings for ${casinoUpdateResult.count} casinos to 0.`);
    
    console.log('Review deletion completed successfully!');
  } catch (error) {
    console.error('Error deleting reviews:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the function
deleteAllReviews(); 