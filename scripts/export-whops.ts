import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function exportWhops() {
  console.log('Exporting whops from local database...');
  
  const whops = await prisma.deal.findMany();
  
  console.log(`Found ${whops.length} whops to export`);
  
  // Save to JSON file
  fs.writeFileSync('whops-export.json', JSON.stringify(whops, null, 2));
  
  console.log('Whops exported to whops-export.json');
  
  await prisma.$disconnect();
}

exportWhops().catch(console.error);