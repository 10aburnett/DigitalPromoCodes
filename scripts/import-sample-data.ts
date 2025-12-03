import { PrismaClient } from '@prisma/client';
import { parse } from 'csv-parse/sync';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

async function importSampleData() {
  try {
    const csvPath = path.join(process.cwd(), 'sample-whops-with-price.csv');
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
      relax_quotes: true
    });

    for (const record of records) {
      await prisma.deal.create({
        data: {
          name: record.Name,
          description: record.Description,
          logo: record.Logo,
          affiliateLink: record.AffiliateLink,
          price: record.Price,
          slug: record.Name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
          rating: 0,
          displayOrder: 0
        }
      });
    }

    console.log('Sample data imported successfully!');
  } catch (error) {
    console.error('Error importing sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importSampleData(); 