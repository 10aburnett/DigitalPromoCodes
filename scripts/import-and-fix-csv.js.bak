const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { parse } = require('csv-parse/sync');

const prisma = new PrismaClient();

function fixAffiliateLink(originalLink) {
  if (!originalLink || !originalLink.includes('whop.com')) {
    return originalLink;
  }
  
  try {
    const url = new URL(originalLink);
    
    // Remove existing affiliate parameters
    url.searchParams.delete('affiliate');
    url.searchParams.delete('a');
    
    // Add the correct affiliate parameter
    url.searchParams.set('a', 'alexburnett21');
    
    return url.toString();
  } catch (error) {
    console.error(`Error parsing URL: ${originalLink}`, error);
    return originalLink;
  }
}

async function importAndFixCSV(csvFileName) {
  console.log(`Starting import from ${csvFileName} with correct affiliate links...`);
  
  try {
    const csvPath = path.join(process.cwd(), csvFileName);
    
    if (!fs.existsSync(csvPath)) {
      console.error(`❌ CSV file not found: ${csvPath}`);
      console.log('Available CSV files:');
      fs.readdirSync(process.cwd()).filter(f => f.endsWith('.csv')).forEach(f => {
        console.log(`  - ${f}`);
      });
      process.exit(1);
    }
    
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true
    });

    console.log(`📂 Found ${records.length} records in CSV`);

    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;

    for (const record of records) {
      const name = record.Name || record.name;
      const description = record.description || record.Description || null;
      const logo = record.logo || record.Logo || null;
      const affiliateLink = record.affiliatelink || record.affiliateLink || record.AffiliateLink;
      const price = record.price || record.Price || null;

      if (!name || !affiliateLink) {
        console.log(`⚠️  Skipping row: Missing name or affiliate link`);
        skippedCount++;
        continue;
      }

      // Generate slug
      const slug = name.toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim('-');

      // Fix the affiliate link
      const correctedAffiliateLink = fixAffiliateLink(affiliateLink);

      try {
        // Check if whop already exists (by name or slug)
        const existingWhop = await prisma.whop.findFirst({
          where: {
            OR: [
              { slug: slug },
              { name: name }
            ]
          }
        });

        if (existingWhop) {
          // Update existing whop
          await prisma.whop.update({
            where: { id: existingWhop.id },
            data: {
              name: name,
              description: description,
              logo: logo,
              affiliateLink: correctedAffiliateLink,
              price: price
            }
          });
          
          console.log(`🔄 Updated: ${name}`);
          updatedCount++;
        } else {
          // Get highest display order for new whops
          const highestOrderWhop = await prisma.whop.findFirst({
            orderBy: { displayOrder: 'desc' }
          });
          const displayOrder = highestOrderWhop ? highestOrderWhop.displayOrder + 1 : 0;

          // Create new whop
          await prisma.whop.create({
            data: {
              name: name,
              slug: slug,
              description: description,
              logo: logo,
              rating: 0,
              displayOrder: displayOrder,
              affiliateLink: correctedAffiliateLink,
              website: null,
              price: price,
              category: null
            }
          });
          
          console.log(`➕ Created: ${name}`);
          createdCount++;
        }
      } catch (error) {
        console.error(`❌ Error processing ${name}:`, error.message);
        skippedCount++;
      }
    }

    console.log('\n=== Import/Update Summary ===');
    console.log(`➕ Created: ${createdCount} new whops`);
    console.log(`🔄 Updated: ${updatedCount} existing whops`);
    console.log(`⚠️  Skipped: ${skippedCount} records`);
    console.log(`📊 Total processed: ${records.length} records`);
    console.log('\n✅ All affiliate links use: ?a=alexburnett21');
    
  } catch (error) {
    console.error('❌ Error during import:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Get CSV filename from command line argument or use default
const csvFileName = process.argv[2] || 'whop fianl 2 jun.csv';
importAndFixCSV(csvFileName);