import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Courses that have legitimate prices matching their names (whitelist)
const LEGITIMATE_NAME_PRICES = [
  'ATN $25,000',  // User confirmed this is actually $25,000
  'Scale Your Salary (3M+VA)',  // User confirmed this is $1,750/month
  'Scale Your Salary - (3M DIY)',  // User confirmed this is $1,750/month
  // All 44 user-corrected courses with their verified pricing
  'TMS+ (Heavy Hitters) 💎',
  'Frugal Season',
  'TMS (#1 ON WHOP)',
  'Strike Access Full Access',
  'The High Ticket eCom Program',
  'Aumenta Tu Valor',
  'CashFlowCoaching',
  'Millionaire Classroom Basic',
  'Rios to Riches',
  'Renewal - RB',
  'Print Money W TikTok Course',
  '1Kto10K 🪜 CHALLENGE',
  'EXCLUSIVE ACCESS',
  'Tiktok Prodigies Accelerator.w',
  'Primetime Diamond Club',
  'Escape Room Gold',
  'Flipseek',
  'AI Creator 1.0',
  'Profit Pursuit',
  'Wealth Academy Pro',
  'Betting Hub',
  'Trading Secrets Scalper',
  'Instagram Business Blueprint',
  'Renewal - F',
  'Primetime VIP Equities',
  'Yearly Subscription - SKIP WL',
  'J&K Plus Memebership',
  'Pushin Picks',
  'Fornightly Membership',
  'Print Money W TikTok',
  'Maximus Media',
  'TapMob Premium',
  'Thomps Locks',
  'Cronus Heaven Premium',
  '🥇 Inversionista Visionario',
  'Daily Bread',
  'Faceless Academy',
  'Make Money on Tiktok',
  'Prophets of Profit',
  'Creator Blueprint',
  'Digi Tools',
  'Education Club Lifetime Pass',
  'Peak Profits Lifetime'
];

async function fixNameBasedPrices(dryRun: boolean = true) {
  try {
    console.log(`🔍 ${dryRun ? 'ANALYZING' : 'FIXING'} prices extracted from course names...\n`);
    
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        description: true
      }
    });
    
    let correctedCount = 0;
    const corrections: Array<{id: string, name: string, oldPrice: string | null, newPrice: string, reason: string}> = [];
    
    for (const whop of whops) {
      const name = whop.name;
      const price = whop.price || '';
      
      let shouldCorrect = false;
      let newPrice = 'N/A';
      let reason = '';
      
      // Check if course name contains a dollar amount that matches the price
      const nameAmountMatch = name.match(/\$[\d,]+/);
      if (nameAmountMatch && price) {
        const nameAmount = nameAmountMatch[0];
        const nameNumeric = parseFloat(nameAmount.replace(/[\$,]/g, ''));
        const priceNumeric = parseFloat(price.replace(/[\$,]/g, ''));
        
        // If the price matches or is close to the amount in the name
        if (Math.abs(nameNumeric - priceNumeric) < 100) {
          // Check if this is a whitelisted legitimate case
          if (LEGITIMATE_NAME_PRICES.includes(name)) {
            console.log(`✅ Keeping legitimate price for: ${name} (${price})`);
            continue;
          }
          
          shouldCorrect = true;
          reason = `Price appears to be extracted from course name (${nameAmount})`;
        }
      }
      
      // Special patterns for courses that clearly have name-based pricing
      const nameBasedPatterns = [
        /^\$\d+\s+/,  // Starts with "$123 "
        /\$\d+\s+(monthly|weekly|daily)/i,  // "$X monthly" pattern
        /\$\d+\/[md]/i,  // "$X/m" or "$X/d" pattern
        /\$\d+\s+(month|week|day)/i,  // "$X month" pattern
      ];
      
      if (price && nameBasedPatterns.some(pattern => name.match(pattern))) {
        const priceMatch = price.match(/\$?[\d,]+/);
        if (priceMatch) {
          // Extract the number from the name and price to compare
          const nameNumberMatch = name.match(/\$?([\d,]+)/);
          if (nameNumberMatch) {
            const nameNumber = parseFloat(nameNumberMatch[1].replace(/,/g, ''));
            const priceNumber = parseFloat(priceMatch[0].replace(/[\$,]/g, ''));
            
            if (Math.abs(nameNumber - priceNumber) < 10) {
              shouldCorrect = true;
              reason = `Price extracted from name pattern: ${name}`;
            }
          }
        }
      }
      
      // Special handling for ATN courses (known problematic pattern)
      if (name.startsWith('ATN $') && price) {
        const atnAmount = name.match(/ATN \$?([\d,\.]+[KkMm]?)/);
        if (atnAmount) {
          // Don't correct ATN $25,000 as user confirmed it's legitimate
          if (name === 'ATN $25,000') {
            console.log(`✅ Keeping legitimate ATN price: ${name} (${price})`);
            continue;
          }
          
          shouldCorrect = true;
          reason = `ATN course with price in name (likely not actual pricing)`;
        }
      }
      
      // Handle courses with very specific naming patterns
      const specificPatterns = [
        /Challenge.*\$\d+/i,
        /\$\d+.*Challenge/i,
        /Trial.*For.*\$\d+/i,
        /\$\d+.*Off/i,
        /Discount.*\$\d+/i,
        /\$\d+.*Discount/i,
      ];
      
      if (price && specificPatterns.some(pattern => name.match(pattern))) {
        shouldCorrect = true;
        reason = `Challenge/trial/discount pattern in name suggests price is not for membership`;
      }
      
      if (shouldCorrect) {
        corrections.push({
          id: whop.id,
          name: whop.name,
          oldPrice: whop.price,
          newPrice: newPrice,
          reason: reason
        });
        correctedCount++;
        
        if (!dryRun) {
          await prisma.deal.update({
            where: { id: whop.id },
            data: { price: newPrice }
          });
        }
      }
    }
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`Total whops analyzed: ${whops.length}`);
    console.log(`Name-based price corrections needed: ${correctedCount}`);
    
    if (corrections.length > 0) {
      console.log(`\n🔧 CORRECTIONS ${dryRun ? '(PREVIEW)' : '(APPLIED)'}:`);
      corrections.forEach(correction => {
        console.log(`  • ${correction.name}`);
        console.log(`    OLD: ${correction.oldPrice || 'null'}`);
        console.log(`    NEW: ${correction.newPrice}`);
        console.log(`    REASON: ${correction.reason}`);
        console.log('');
      });
    }
    
    if (dryRun) {
      console.log(`\n💡 This was a dry run. To apply changes, run with --apply flag`);
    } else {
      console.log(`\n✅ Successfully updated ${correctedCount} name-based prices!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing name-based prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const isDryRun = !process.argv.includes('--apply');

fixNameBasedPrices(isDryRun); 