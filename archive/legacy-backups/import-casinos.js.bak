const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Function to extract casino data from the casinoBonuses.ts file
function extractCasinoData() {
  try {
    const filePath = path.join(__dirname, '..', 'src', 'data', 'casinoBonuses.ts');
    const fileContent = fs.readFileSync(filePath, 'utf8');
    
    // Extract casino objects from the file content
    const casinoDataRegex = /{\s*id:\s*['"]([^'"]+)['"],\s*casinoName:\s*['"]([^'"]+)['"],[\s\S]*?isActive:\s*(true|false)/g;
    
    const casinos = [];
    let match;
    
    while ((match = casinoDataRegex.exec(fileContent)) !== null) {
      const id = match[1];
      const name = match[2];
      const isActive = match[3] === 'true';
      
      // Extract other properties
      const casinoBlock = match[0];
      
      // Extract logo URL
      const logoMatch = casinoBlock.match(/logoUrl:\s*['"]([^'"]+)['"]/);
      const logo = logoMatch ? logoMatch[1] : null;
      
      // Extract bonus text for description
      const bonusTextMatch = casinoBlock.match(/bonusText:\s*['"]([^'"]+)['"]/);
      const description = bonusTextMatch ? bonusTextMatch[1] : '';

      // Extract affiliate link
      const affiliateLinkMatch = casinoBlock.match(/affiliateLink:\s*['"]([^'"]+)['"]/);
      const affiliateLink = affiliateLinkMatch && affiliateLinkMatch[1] !== '' ? affiliateLinkMatch[1] : null;
      
      casinos.push({
        id,
        name,
        slug: id,
        logo: logo ? path.basename(logo) : null,
        description,
        affiliateLink,
        isActive
      });
    }
    
    return casinos;
  } catch (error) {
    console.error('Error extracting casino data:', error);
    return [];
  }
}

async function importCasinos() {
  try {
    const casinos = extractCasinoData();
    console.log(`Found ${casinos.length} casinos to import.`);
    
    let createdCount = 0;
    let skippedCount = 0;
    
    for (const casino of casinos) {
      try {
        // Check if casino already exists
        const existingCasino = await prisma.casino.findUnique({
          where: { slug: casino.slug }
        });
        
        if (existingCasino) {
          console.log(`Casino ${casino.name} (${casino.slug}) already exists. Updating...`);
          
          await prisma.casino.update({
            where: { slug: casino.slug },
            data: {
              name: casino.name,
              logo: casino.logo,
              description: casino.description,
              affiliateLink: casino.affiliateLink
            }
          });
          
          skippedCount++;
        } else {
          console.log(`Creating casino: ${casino.name} (${casino.slug})`);
          
          await prisma.casino.create({
            data: {
              name: casino.name,
              slug: casino.slug,
              logo: casino.logo,
              description: casino.description,
              affiliateLink: casino.affiliateLink,
              rating: 0
            }
          });
          
          createdCount++;
        }
      } catch (error) {
        console.error(`Error processing casino ${casino.name}:`, error);
      }
    }
    
    console.log(`Import completed: ${createdCount} casinos created, ${skippedCount} casinos updated.`);
  } catch (error) {
    console.error('Error importing casinos:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importCasinos(); 