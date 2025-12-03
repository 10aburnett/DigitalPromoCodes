import { PrismaClient } from '@prisma/client';
import fs from 'fs';

const prisma = new PrismaClient();

async function importWhops() {
  console.log('Importing whops to production database...');
  
  // Read the exported data
  const whopsData = JSON.parse(fs.readFileSync('whops-export.json', 'utf8'));
  
  console.log(`Importing ${whopsData.length} whops...`);
  
  // Clear existing whops first
  await prisma.deal.deleteMany();
  console.log('Cleared existing whops');
  
  // Import in batches to avoid timeout
  const batchSize = 100;
  for (let i = 0; i < whopsData.length; i += batchSize) {
    const batch = whopsData.slice(i, i + batchSize);
    
    await prisma.deal.createMany({
      data: batch.map((whop: any) => ({
        ...whop,
        createdAt: new Date(whop.createdAt),
        updatedAt: new Date(whop.updatedAt),
        publishedAt: whop.publishedAt ? new Date(whop.publishedAt) : null
      }))
    });
    
    console.log(`Imported batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(whopsData.length/batchSize)}`);
  }
  
  console.log('Import completed!');
  
  const count = await prisma.deal.count();
  const unpublished = await prisma.deal.count({ where: { publishedAt: null } });
  
  console.log(`Total whops: ${count}`);
  console.log(`Unpublished whops: ${unpublished}`);
  
  await prisma.$disconnect();
}

importWhops().catch(console.error);