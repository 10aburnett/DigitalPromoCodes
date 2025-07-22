const { PrismaClient } = require('@prisma/client');
require('dotenv').config({ path: '.env.local' });

// Copy the exact transform function from the API
function transformWhopData(whop) {
  try {
    const firstPromoCode = whop.promoCodes && whop.promoCodes.length > 0 ? whop.promoCodes[0] : null;
    
    // Determine promoText - prioritize whop description over generic promo code titles
    let promoText;
    
    // Check if promo code title is generic/placeholder text
    const isGenericTitle = !firstPromoCode?.title || 
      firstPromoCode.title.toLowerCase().includes('exclusive access') ||
      firstPromoCode.title.toLowerCase().includes('exclusive') ||
      firstPromoCode.title.toLowerCase().includes('access') ||
      firstPromoCode.title === 'N/A' ||
      firstPromoCode.title.trim() === '';
    
    if (!isGenericTitle && firstPromoCode?.title) {
      // Use specific promo code title if it's not generic, with truncation
      const maxLength = 25;
      const title = firstPromoCode.title || '';
      promoText = title.length > maxLength 
        ? title.substring(0, maxLength) + '...'
        : title;
    } else if (whop.description) {
      // Use whop description, truncate to ensure exactly one line only (25 characters max)
      const maxLength = 25;
      const description = whop.description || '';
      promoText = description.length > maxLength 
        ? description.substring(0, maxLength) + '...'
        : description;
    } else {
      promoText = 'N/A';
    }

    return {
      whopId: whop.id,
      whopName: whop.name,
      slug: whop.slug,
      logo: whop.logo,
      description: whop.description,
      rating: whop.rating,
      promoText,
      promoCodes: whop.promoCodes || [],
      reviews: whop.reviews || [],
      affiliateLink: whop.affiliateLink,
      price: whop.price,
      website: whop.website,
      category: whop.category
    };
  } catch (error) {
    console.error('Error transforming whop data:', error);
    console.error('Failed whop data:', {
      id: whop?.id,
      name: whop?.name,
      promoCodesCount: whop?.promoCodes?.length,
      firstPromoTitle: whop?.promoCodes?.[0]?.title
    });
    return null;
  }
}

async function testTransform() {
  const prisma = new PrismaClient();
  
  try {
    console.log('Testing transform function...');
    
    const whops = await prisma.whop.findMany({
      where: { publishedAt: { not: null } },
      include: { 
        promoCodes: true,
        reviews: {
          where: { verified: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      take: 5
    });
    
    console.log('Found', whops.length, 'whops to transform');
    
    for (const whop of whops) {
      console.log('\n--- Testing whop:', whop.name, '---');
      const result = transformWhopData(whop);
      if (result) {
        console.log('✅ Transform successful:', result.whopName);
      } else {
        console.log('❌ Transform failed for:', whop.name);
      }
    }
    
  } catch (error) {
    console.error('TEST ERROR:', error);
  } finally {
    await prisma.$disconnect();
  }
}

testTransform();