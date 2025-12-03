import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkCurrencies() {
  try {
    console.log('🔍 Checking for different currencies in course prices...\n');
    
    // Get all whops with non-null prices
    const allPrices = await prisma.deal.findMany({
      where: {
        price: {
          not: null
        }
      },
      select: {
        name: true,
        price: true
      }
    });
    
    // Filter out Free and N/A in JavaScript
    const validPrices = allPrices.filter(whop => 
      whop.price && 
      whop.price !== 'Free' && 
      whop.price !== 'N/A'
    );
    
    console.log(`Total courses with valid prices: ${validPrices.length}\n`);
    
    // Group by currency symbols/patterns
    const currencies: Record<string, Array<{name: string, price: string}>> = {
      USD: [],
      EUR: [],
      GBP: [],
      OTHER: []
    };
    
    validPrices.forEach(whop => {
      const price = whop.price || '';
      
      if (price.startsWith('$')) {
        currencies.USD.push({name: whop.name, price});
      } else if (price.includes('€') || price.toLowerCase().includes('eur')) {
        currencies.EUR.push({name: whop.name, price});
      } else if (price.includes('£') || price.toLowerCase().includes('gbp')) {
        currencies.GBP.push({name: whop.name, price});
      } else if (price.toLowerCase().includes('cad') || 
                 price.toLowerCase().includes('aud') ||
                 price.toLowerCase().includes('inr') ||
                 price.toLowerCase().includes('jpy') ||
                 price.toLowerCase().includes('cny') ||
                 price.toLowerCase().includes('krw') ||
                 price.toLowerCase().includes('brl') ||
                 !price.startsWith('$')) {
        currencies.OTHER.push({name: whop.name, price});
      }
    });
    
    console.log('📋 CURRENCY BREAKDOWN:');
    
    Object.entries(currencies).forEach(([currency, items]) => {
      console.log(`\n${currency} (${items.length} courses):`);
      if (items.length > 0) {
        items.slice(0, 10).forEach(item => {
          console.log(`  • ${item.name}: "${item.price}"`);
        });
        if (items.length > 10) {
          console.log(`  ... and ${items.length - 10} more`);
        }
      } else {
        console.log('  No courses found');
      }
    });
    
    // Special check for non-standard formats
    const nonStandardPrices = validPrices.filter(whop => {
      const price = whop.price || '';
      return !price.startsWith('$') && 
             !price.includes('€') && 
             !price.includes('£') &&
             !/^\d/.test(price); // Doesn't start with a number
    });
    
    if (nonStandardPrices.length > 0) {
      console.log(`\n⚠️  NON-STANDARD PRICE FORMATS (${nonStandardPrices.length}):`);
      nonStandardPrices.slice(0, 15).forEach(whop => {
        console.log(`  • ${whop.name}: "${whop.price}"`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error checking currencies:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkCurrencies(); 