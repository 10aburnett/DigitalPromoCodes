const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient({
  log: ['query', 'info', 'warn', 'error'],
});

async function fixReviews() {
  console.log('Starting review database fix...');

  try {
    // Check database connection
    const testConnection = await prisma.$queryRaw`SELECT 1 as test`;
    console.log('Database connection test:', testConnection);

    // Check if the Review table exists
    const tables = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_name = 'Review'
    `;
    
    console.log('Review table check:', tables);
    
    if (tables.length === 0) {
      console.error('Error: Review table does not exist!');
      return;
    }
    
    // Try to get existing reviews using raw query
    const existingReviews = await prisma.$queryRaw`
      SELECT * FROM "Review" LIMIT 10
    `;
    
    console.log('Existing reviews:', existingReviews);
    
    // Find the Stake casino using raw SQL
    const stakeCasino = await prisma.$queryRaw`
      SELECT * FROM "Casino" WHERE slug = 'stake' LIMIT 1
    `;
    
    if (!stakeCasino || stakeCasino.length === 0) {
      console.error('Error: Stake casino not found!');
      return;
    }
    
    console.log('Found Stake casino:', stakeCasino[0]);
    
    // Delete all existing reviews
    const deleteResult = await prisma.$executeRaw`
      DELETE FROM "Review" WHERE 1=1
    `;
    
    console.log(`Deleted ${deleteResult} reviews`);
    
    // Create a new review using Prisma's create method instead of raw SQL
    const review = await prisma.review.create({
      data: {
        author: 'Jane Smith',
        content: 'Stake is a fantastic casino with great games and quick withdrawals!',
        rating: 4.9,
        casinoId: stakeCasino[0].id,
      },
    });
    
    console.log('Created new review:', review);
    
    // Check if the review was inserted
    const newReviews = await prisma.$queryRaw`
      SELECT r.*, c.name as casino_name
      FROM "Review" r
      JOIN "Casino" c ON r."casinoId" = c.id
    `;
    
    console.log('New reviews:', newReviews);
    
    console.log('Review fix completed successfully!');
  } catch (error) {
    console.error('Error fixing reviews:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Execute the function
fixReviews(); 