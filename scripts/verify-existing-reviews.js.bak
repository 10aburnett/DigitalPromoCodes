const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'error', 'warn'],
});

async function verifyExistingReviews() {
  console.log('Starting to verify all existing reviews...');

  try {
    // Get count of unverified reviews
    const unverifiedCount = await prisma.review.count({
      where: { verified: false }
    });
    
    console.log(`Found ${unverifiedCount} unverified reviews.`);
    
    // Update all reviews to be verified
    const updateResult = await prisma.review.updateMany({
      where: { verified: false },
      data: { verified: true }
    });
    
    console.log(`Successfully verified ${updateResult.count} reviews.`);
    
    // Get all casinos with reviews
    const casinos = await prisma.casino.findMany({
      include: {
        reviews: true
      }
    });
    
    console.log(`Updating ratings for ${casinos.length} casinos based on verified reviews...`);
    
    // Update casino ratings based on verified reviews
    for (const casino of casinos) {
      if (casino.reviews && casino.reviews.length > 0) {
        const totalRating = casino.reviews.reduce((sum, review) => sum + review.rating, 0);
        const averageRating = totalRating / casino.reviews.length;
        
        await prisma.casino.update({
          where: { id: casino.id },
          data: { rating: averageRating }
        });
        
        console.log(`Updated ${casino.name} rating to ${averageRating.toFixed(1)} based on ${casino.reviews.length} reviews`);
      }
    }
    
    console.log('Review verification and rating updates completed successfully!');
  } catch (error) {
    console.error('Error verifying reviews:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the function
verifyExistingReviews(); 