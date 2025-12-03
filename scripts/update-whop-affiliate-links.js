const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateWhopAffiliateLinks() {
  console.log('Starting to update Whop affiliate links with a=alexburnett21...');
  
  try {
    // Get all whops with their current affiliate links
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        slug: true,
        affiliateLink: true
      }
    });

    console.log(`Found ${whops.length} whops in the database`);

    let updatedCount = 0;
    let skippedCount = 0;

    for (const whop of whops) {
      const currentLink = whop.affiliateLink;
      
      if (!currentLink || !currentLink.includes('whop.com')) {
        console.log(`⚠️  Skipping ${whop.name}: Not a whop.com link or empty`);
        skippedCount++;
        continue;
      }

      // Parse the URL to modify the affiliate parameter
      try {
        const url = new URL(currentLink);
        
        // Remove existing affiliate parameters
        url.searchParams.delete('affiliate');
        url.searchParams.delete('a');
        
        // Add the new affiliate parameter
        url.searchParams.set('a', 'alexburnett21');
        
        const newLink = url.toString();
        
        // Update the database
        await prisma.deal.update({
          where: { id: whop.id },
          data: { affiliateLink: newLink }
        });
        
        console.log(`✅ Updated ${whop.name}`);
        console.log(`   Old: ${currentLink}`);
        console.log(`   New: ${newLink}`);
        console.log('');
        
        updatedCount++;
      } catch (urlError) {
        console.error(`❌ Failed to parse URL for ${whop.name}: ${currentLink}`);
        console.error(`   Error: ${urlError.message}`);
        skippedCount++;
      }
    }

    console.log('\n=== Update Summary ===');
    console.log(`✅ Successfully updated: ${updatedCount} whops`);
    console.log(`⚠️  Skipped: ${skippedCount} whops`);
    console.log(`📊 Total processed: ${whops.length} whops`);
    
  } catch (error) {
    console.error('❌ Error updating affiliate links:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updateWhopAffiliateLinks();