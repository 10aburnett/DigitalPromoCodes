require('dotenv').config();
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function debugDatabase() {
  console.log('DATABASE_URL:', process.env.DATABASE_URL?.includes('rough-rain') ? 'rough-rain (dev)' : 'unknown');
  
  // Check if PromoCodeSubmission table exists and has data
  try {
    const submissions = await prisma.promoCodeSubmission.findMany({
      where: { status: 'APPROVED' }
    });
    console.log('Approved PromoCodeSubmissions:', submissions.length);
    
    // Check community promo codes
    const communityPromos = await prisma.promoCode.findMany({
      where: { id: { startsWith: 'community_' } }
    });
    console.log('Community PromoCode records:', communityPromos.length);
    
    // Check Ayecon specifically
    const ayeconWhop = await prisma.whop.findFirst({
      where: { slug: 'ayecon-academy-1-1-mentorship' }
    });
    
    if (ayeconWhop) {
      const ayeconPromos = await prisma.promoCode.findMany({
        where: { whopId: ayeconWhop.id }
      });
      console.log('Ayecon total promo codes:', ayeconPromos.length);
      console.log('Ayecon community codes:', ayeconPromos.filter(p => p.id.startsWith('community_')).length);
      console.log('Ayecon original codes:', ayeconPromos.filter(p => !p.id.startsWith('community_')).length);
    }
    
  } catch (error) {
    console.log('Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

debugDatabase();