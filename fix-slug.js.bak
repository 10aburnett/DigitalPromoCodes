require('dotenv').config();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function fixSlug() {
  console.log('Updating Ayecon slug from 1-1 to 1:1...');
  
  const result = await prisma.whop.updateMany({
    where: { slug: 'ayecon-academy-1-1-mentorship' },
    data: { slug: 'ayecon-academy-1:1-mentorship' }
  });
  
  console.log('Updated', result.count, 'records');
  
  // Verify the change
  const updated = await prisma.whop.findFirst({
    where: { slug: 'ayecon-academy-1:1-mentorship' }
  });
  
  console.log('Verification - found whop with correct slug:', updated ? true : false);
  if (updated) {
    console.log('New slug:', updated.slug);
  }
  
  await prisma.$disconnect();
}

fixSlug().catch(console.error);