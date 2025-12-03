import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkSuspiciousPrices() {
  try {
    console.log('🔍 Checking for courses with suspicious pricing patterns...\n');
    
    // Find courses where the price appears to be extracted from the course name
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        description: true
      }
    });
    
    const suspiciousCourses: Array<{
      name: string,
      price: string | null,
      issue: string,
      recommendation: string
    }> = [];
    
    for (const whop of whops) {
      const name = whop.name.toLowerCase();
      const price = whop.price || '';
      
      // Check if course name contains a dollar amount that matches the price
      const nameAmountMatch = whop.name.match(/\$[\d,]+/);
      if (nameAmountMatch) {
        const nameAmount = nameAmountMatch[0];
        const nameNumeric = parseFloat(nameAmount.replace(/[\$,]/g, ''));
        
        if (price) {
          const priceNumeric = parseFloat(price.replace(/[\$,]/g, ''));
          
          // If the price matches or is close to the amount in the name
          if (Math.abs(nameNumeric - priceNumeric) < 100) {
            suspiciousCourses.push({
              name: whop.name,
              price: whop.price,
              issue: `Price ${price} appears to be extracted from course name (contains ${nameAmount})`,
              recommendation: 'Set to N/A - likely extracted from name, not actual pricing'
            });
          }
        }
      }
      
      // Check for other suspicious patterns
      if (price) {
        const priceNumeric = parseFloat(price.replace(/[\$,]/g, ''));
        
        // Suspiciously round numbers that might be from descriptions
        if (priceNumeric >= 1000 && priceNumeric % 1000 === 0) {
          // Check if this round number appears in the description
          const description = whop.description || '';
          if (description.toLowerCase().includes(priceNumeric.toString()) || 
              description.includes(`$${priceNumeric.toLocaleString()}`) ||
              description.includes(`${priceNumeric.toLocaleString()}`)) {
            suspiciousCourses.push({
              name: whop.name,
              price: whop.price,
              issue: `Round number ${price} found in description - might be earnings claim`,
              recommendation: 'Review manually - could be earnings figure rather than price'
            });
          }
        }
        
        // Check for extremely specific amounts that are unlikely to be real prices
        if (priceNumeric > 20000 && !Number.isInteger(priceNumeric / 100)) {
          // Very specific amounts like $38,630 are likely earnings claims
          suspiciousCourses.push({
            name: whop.name,
            price: whop.price,
            issue: `Very specific amount ${price} unlikely to be a course price`,
            recommendation: 'Likely earnings claim - set to N/A'
          });
        }
      }
    }
    
    console.log(`📊 Found ${suspiciousCourses.length} courses with suspicious pricing:\n`);
    
    if (suspiciousCourses.length > 0) {
      suspiciousCourses.forEach((course, index) => {
        console.log(`${index + 1}. ${course.name}`);
        console.log(`   Price: ${course.price}`);
        console.log(`   Issue: ${course.issue}`);
        console.log(`   Recommendation: ${course.recommendation}`);
        console.log('');
      });
    } else {
      console.log('✅ No suspicious pricing patterns detected!');
    }
    
  } catch (error) {
    console.error('❌ Error checking prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkSuspiciousPrices(); 