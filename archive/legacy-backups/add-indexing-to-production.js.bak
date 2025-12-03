const { PrismaClient } = require('@prisma/client');

// Production database connection
const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function addIndexingToProduction() {
  try {
    console.log('🚀 ADDING INDEXING FIELD TO PRODUCTION DATABASE\n');

    // Step 1: Create IndexingStatus enum
    console.log('📝 Step 1: Creating IndexingStatus enum...');
    try {
      await productionDb.$executeRaw`
        CREATE TYPE "IndexingStatus" AS ENUM ('INDEX', 'NOINDEX', 'AUTO');
      `;
      console.log('✅ IndexingStatus enum created');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ IndexingStatus enum already exists');
      } else {
        throw error;
      }
    }

    // Step 2: Add indexing column to Whop table
    console.log('\n📝 Step 2: Adding indexing column to Whop table...');
    try {
      await productionDb.$executeRaw`
        ALTER TABLE "Whop" 
        ADD COLUMN "indexing" "IndexingStatus" NOT NULL DEFAULT 'AUTO';
      `;
      console.log('✅ indexing column added');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ indexing column already exists');
      } else {
        throw error;
      }
    }

    // Step 3: Create index for indexing column
    console.log('\n📝 Step 3: Creating index on indexing column...');
    try {
      await productionDb.$executeRaw`
        CREATE INDEX "Whop_indexing_idx" ON "Whop"("indexing");
      `;
      console.log('✅ Index created');
    } catch (error) {
      if (error.message.includes('already exists')) {
        console.log('✅ Index already exists');
      } else {
        throw error;
      }
    }

    // Step 4: Verify the changes
    console.log('\n📝 Step 4: Verifying changes...');
    const columns = await productionDb.$queryRaw`
      SELECT column_name, data_type, column_default
      FROM information_schema.columns 
      WHERE table_name = 'Whop' AND column_name = 'indexing';
    `;

    if (columns.length > 0) {
      console.log('✅ Verification successful!');
      console.log(`   Column: ${columns[0].column_name}`);
      console.log(`   Type: ${columns[0].data_type}`);
      console.log(`   Default: ${columns[0].column_default}`);
    } else {
      console.log('❌ Verification failed - column not found');
    }

    // Step 5: Set initial values based on promo codes and high traffic
    console.log('\n📝 Step 5: Setting initial indexing values...');
    
    const highTrafficCourses = [
      'Brez marketing ERT',
      'Remakeit.io creator', 
      'Interbank Trading Room',
      'Josh Exclusive VIP Access',
      'EquiFix',
      'LinkedIn Client Lab',
      'Lowkey Discord Membership',
      'Risen Consulting',
      'Learn to Trade Academy',
      'Royalty Hero Premium',
      'The Blue Vortex',
      'ThinkorSwim Blessing',
      'ThinkorSwim Master Scalper',
      'Korvato Gold Rush'
    ];

    // Get all whops with promo codes
    const whops = await productionDb.whop.findMany({
      select: {
        id: true,
        name: true,
        PromoCode: {
          select: { id: true }
        }
      }
    });

    console.log(`   Found ${whops.length} whops to process`);

    let indexedCount = 0;
    let noindexedCount = 0;

    const indexUpdates = [];
    const noindexUpdates = [];

    for (const whop of whops) {
      const hasPromoCode = whop.PromoCode.length > 0;
      const isHighTraffic = highTrafficCourses.some(course => 
        whop.name.toLowerCase().includes(course.toLowerCase()) ||
        course.toLowerCase().includes(whop.name.toLowerCase())
      );
      
      const shouldIndex = hasPromoCode || isHighTraffic;
      
      if (shouldIndex) {
        indexUpdates.push(whop.id);
        indexedCount++;
      } else {
        noindexUpdates.push(whop.id);
        noindexedCount++;
      }
    }

    // Batch update INDEX pages
    if (indexUpdates.length > 0) {
      await productionDb.whop.updateMany({
        where: { id: { in: indexUpdates } },
        data: { indexing: 'INDEX' }
      });
      console.log(`   ✅ Set ${indexedCount} pages to INDEX`);
    }

    // Batch update NOINDEX pages  
    if (noindexUpdates.length > 0) {
      await productionDb.whop.updateMany({
        where: { id: { in: noindexUpdates } },
        data: { indexing: 'NOINDEX' }
      });
      console.log(`   ✅ Set ${noindexedCount} pages to NOINDEX`);
    }

    // Final verification
    console.log('\n📊 FINAL STATUS:');
    const statusCount = await productionDb.whop.groupBy({
      by: ['indexing'],
      _count: { indexing: true }
    });

    statusCount.forEach(status => {
      const emoji = status.indexing === 'INDEX' ? '✅' : status.indexing === 'NOINDEX' ? '🚫' : '⚙️';
      console.log(`   ${emoji} ${status.indexing}: ${status._count.indexing} pages`);
    });

    console.log('\n🎉 PRODUCTION DATABASE UPDATED SUCCESSFULLY!');
    console.log('   Production now has the same indexing system as backup');
    console.log('   SEO indexing control is now fully operational!');

  } catch (error) {
    console.error('❌ Error updating production database:', error);
  } finally {
    await productionDb.$disconnect();
  }
}

addIndexingToProduction();