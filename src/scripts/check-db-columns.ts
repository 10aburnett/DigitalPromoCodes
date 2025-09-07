import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkColumns() {
  try {
    const columns = await prisma.$queryRaw<
      Array<{ column_name: string; data_type: string }>
    >`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_name = 'BlogPost'
      ORDER BY column_name
    `;
    
    console.log('BlogPost columns:');
    columns.forEach(col => {
      console.log(`  ${col.column_name}: ${col.data_type}`);
    });
    
    const hasContentText = columns.some(col => col.column_name === 'content_text');
    console.log(`\ncontent_text exists: ${hasContentText ? '✅' : '❌'}`);
    
  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkColumns();