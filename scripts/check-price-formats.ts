import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkPriceFormats() {
  try {
    console.log('🔍 Checking price formats with all time periods...\n');
    
    // Find prices with slashes
    const pricesWithSlashes = await prisma.deal.findMany({
      where: {
        price: {
          contains: '/'
        }
      },
      select: {
        name: true,
        price: true
      },
      take: 100
    });
    
    console.log(`Found ${pricesWithSlashes.length} prices with slashes (showing first 100):\n`);
    
    // Check for any that don't have proper spacing
    const improperSpacing = pricesWithSlashes.filter(whop => {
      const price = whop.price || '';
      // Look for slashes without spaces on both sides
      return /[^\s]\/[^\s]/.test(price);
    });
    
    if (improperSpacing.length > 0) {
      console.log('❌ Prices with improper slash spacing:');
      improperSpacing.forEach(whop => {
        console.log(`  • ${whop.name}: "${whop.price}"`);
      });
    } else {
      console.log('✅ All slashes have proper spacing!');
    }
    
    // Group by time periods
    const periods: Record<string, string[]> = {
      month: [],
      week: [],
      year: [],
      day: [],
      days: [],
      other: []
    };
    
    pricesWithSlashes.forEach(whop => {
      const price = whop.price || '';
      if (price.includes('/ month')) periods.month.push(price);
      else if (price.includes('/ week')) periods.week.push(price);
      else if (price.includes('/ year')) periods.year.push(price);
      else if (price.includes('/ day') && !price.includes('days')) periods.day.push(price);
      else if (price.includes('days')) periods.days.push(price);
      else periods.other.push(price);
    });
    
    console.log('\n📋 Breakdown by time periods:');
    Object.entries(periods).forEach(([period, prices]) => {
      if (prices.length > 0) {
        console.log(`\n${period.toUpperCase()} (${prices.length} items):`);
        prices.slice(0, 5).forEach(price => {
          console.log(`  • ${price}`);
        });
        if (prices.length > 5) {
          console.log(`  ... and ${prices.length - 5} more`);
        }
      }
    });
    
  } catch (error) {
    console.error('❌ Error checking price formats:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkPriceFormats(); 