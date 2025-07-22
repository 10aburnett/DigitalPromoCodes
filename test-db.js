const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

async function testDatabase() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing database connection...');
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    
    const whops = await prisma.whop.findMany({
      where: { publishedAt: { not: null } },
      take: 1,
      include: {
        promoCodes: true
      }
    });
    
    console.log('SUCCESS: Found', whops.length, 'whops');
    if (whops.length > 0) {
      console.log('First whop:', {
        id: whops[0].id,
        name: whops[0].name,
        promoCodes: whops[0].promoCodes.length
      });
    }
  } catch (error) {
    console.error('DATABASE ERROR:', error.message);
    console.error('Full error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testDatabase();