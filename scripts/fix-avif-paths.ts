import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function fixAvifPaths() {
  try {
    console.log('Starting AVIF path cleanup...');
    
    // Find all whops with @avif in their logo path
    const whopsWithAvif = await prisma.whop.findMany({
      where: {
        logo: {
          contains: '@avif'
        }
      }
    });
    
    console.log(`Found ${whopsWithAvif.length} whops with @avif suffixes in logo paths`);
    
    if (whopsWithAvif.length === 0) {
      console.log('No whops found with @avif suffixes. Nothing to fix.');
      return;
    }
    
    // Show preview of changes
    console.log('\nPreviewing changes:');
    whopsWithAvif.forEach((whop, index) => {
      const originalPath = whop.logo;
      const cleanedPath = originalPath?.replace('@avif', '') || null;
      console.log(`${index + 1}. ${whop.name}:`);
      console.log(`   FROM: ${originalPath}`);
      console.log(`   TO:   ${cleanedPath}`);
    });
    
    // Ask for confirmation (in a real script, you might want to add readline)
    console.log(`\nThis will update ${whopsWithAvif.length} records.`);
    console.log('To proceed, uncomment the update section in the script and run again.');
    
    // Uncomment the following lines to actually perform the update
    /*
    let updatedCount = 0;
    
    for (const whop of whopsWithAvif) {
      const cleanedPath = whop.logo?.replace('@avif', '') || null;
      
      await prisma.whop.update({
        where: { id: whop.id },
        data: { logo: cleanedPath }
      });
      
      updatedCount++;
      console.log(`Updated ${updatedCount}/${whopsWithAvif.length}: ${whop.name}`);
    }
    
    console.log(`\nSuccessfully updated ${updatedCount} whop logo paths.`);
    */
    
  } catch (error) {
    console.error('Error fixing AVIF paths:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
fixAvifPaths();