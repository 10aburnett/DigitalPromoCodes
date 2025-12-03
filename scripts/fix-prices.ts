import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Same validation function as in the API
function validateAndCorrectPrice(rawPrice: string | null, whopName: string, description: string): string {
  if (!rawPrice || rawPrice.trim() === '') {
    return 'N/A';
  }
  
  const price = rawPrice.trim();
  const lowerName = whopName.toLowerCase();
  
  // Check for explicit "free" indicators
  if (price.toLowerCase() === 'free' || price.toLowerCase() === '0' || price === '$0') {
    return 'Free';
  }
  
  // Check for N/A or empty values
  if (price === 'N/A' || price === '' || price.toLowerCase() === 'null') {
    return 'N/A';
  }
  
  // Specific known corrections for problematic entries
  if (lowerName.includes("ike's whop") || lowerName.includes("ikes whop")) {
    console.log(`Info: Correcting known free community ${whopName} to Free`);
    return 'Free';
  }
  
  // Extract numeric value to validate reasonableness
  const numericMatch = price.replace(/[\$,€£]/g, '').match(/[\d.]+/);
  if (numericMatch) {
    const numericValue = parseFloat(numericMatch[0]);
    
    // If price is 0, it's free
    if (numericValue === 0) {
      return 'Free';
    }
    
    // Check if description contains earnings claims that match the current price
    if (description) {
      const lowerDesc = description.toLowerCase();
      
      // Specific earnings claim patterns that often get mistaken for prices
      const earningsClaimPatterns = [
        /\$[\d,]+,000 in a single month/gi,
        /\$[\d,]+,000 in a month/gi,
        /\$[\d,]+,000 per month/gi,
        /\$[\d,]+,000 monthly/gi,
        /make \$[\d,]+,000/gi,
        /made \$[\d,]+,000/gi,
        /earn \$[\d,]+,000/gi,
        /earned \$[\d,]+,000/gi,
        /i made \$[\d,]+/gi,
        /everything i did to make \$[\d,]+/gi,
        /show you.*make \$[\d,]+/gi,
        /step-by-step.*\$[\d,]+/gi
      ];
      
      // Check if any earnings claims match our current price
      for (const pattern of earningsClaimPatterns) {
        const matches = lowerDesc.match(pattern);
        if (matches) {
          for (const match of matches) {
            const claimAmount = match.replace(/[\$,]/g, '').match(/[\d.]+/);
            if (claimAmount) {
              const claimValue = parseFloat(claimAmount[0]);
              // If the price matches an earnings claim amount, it's likely wrong
              if (Math.abs(claimValue - numericValue) < 100) { // Allow small variance
                console.log(`Info: Price ${price} for ${whopName} matches earnings claim "${match}", setting to N/A for manual review`);
                return 'N/A';
              }
            }
          }
        }
      }
      
      // Additional check for extremely specific patterns like the TikTok example
      if (lowerDesc.includes('tiktok affiliate') && lowerDesc.includes('single month') && numericValue > 30000) {
        console.log(`Info: TikTok affiliate course with suspicious earnings-based price ${price} for ${whopName}, setting to N/A for manual review`);
        return 'N/A';
      }
      
      // Check for other earnings indicators combined with high prices
      const earningsIndicators = [
        'everything i did to make',
        'show you step-by-step',
        'i made',
        'in a single month',
        'per month as a',
        'monthly income',
        'revenue in'
      ];
      
      if (earningsIndicators.some(indicator => lowerDesc.includes(indicator)) && numericValue > 10000) {
        console.log(`Info: High price ${price} combined with earnings indicators for ${whopName}, flagging for manual review`);
        return 'N/A';
      }
    }
    
    // Only flag unreasonably high prices (over $100,000) as definitely wrong
    if (numericValue > 100000) {
      console.log(`Warning: Detected unreasonably high price ${price} for ${whopName}, setting to N/A for manual review`);
      return 'N/A';
    }
    
    // For "Buy Box" type memberships with unreasonably high prices, likely a scraping error
    if (lowerName.includes("buy box") && numericValue > 10000) {
      console.log(`Warning: Correcting unreasonable Buy Box price ${price} for ${whopName}, setting to N/A for manual review`);
      return 'N/A';
    }
  }
  
  // Check description for indicators that it should be free
  if (description) {
    const lowerDesc = description.toLowerCase();
    const freeIndicators = [
      'free to join',
      'join for free',
      'free access',
      'no cost',
      'free membership',
      'free community',
      'completely free',
      'free discord',
      'free group'
    ];
    
    if (freeIndicators.some(indicator => lowerDesc.includes(indicator))) {
      console.log(`Info: Found free indicator in description for ${whopName}, setting to Free`);
      return 'Free';
    }
    
    // Check if description mentions managing large amounts of money (common scraping error source)
    const largeMoneyPatterns = [
      /\$[\d,]+,000,000/g, // Matches $XXX,XXX,XXX pattern (millions)
      /manage creators making/g
    ];
    
    if (largeMoneyPatterns.some(pattern => lowerDesc.match(pattern))) {
      console.log(`Warning: Description for ${whopName} contains large money figures, likely source of pricing error`);
      // If current price matches these large numbers, it's probably wrong
      if (numericMatch && parseFloat(numericMatch[0]) > 1000000) {
        console.log(`Info: Correcting price extracted from description for ${whopName}, setting to Free`);
        return 'Free';
      }
    }
  }
  
  // Check whop name for free indicators
  if (whopName) {
    if (lowerName.includes('free') && !lowerName.includes('premium') && !lowerName.includes('paid')) {
      console.log(`Info: Found free indicator in name for ${whopName}, setting to Free`);
      return 'Free';
    }
    
    // Many "whop" communities are free Discord servers
    if (lowerName.includes(' whop') && !lowerName.includes('premium') && !lowerName.includes('paid')) {
      // Additional check for community indicators
      if (description && (description.toLowerCase().includes('discord') || description.toLowerCase().includes('community'))) {
        console.log(`Info: Detected free community ${whopName}, setting to Free`);
        return 'Free';
      }
    }
  }
  
  // If price looks reasonable, clean it up and return it
  if (numericMatch) {
    let cleanPrice = price;
    
    // Remove trailing slash and whitespace if no billing period is specified
    if (cleanPrice.endsWith('/') || cleanPrice.endsWith('/ ')) {
      cleanPrice = cleanPrice.replace(/\s*\/\s*$/, '');
    }
    
    // If price still ends with just a slash after cleaning, remove it
    if (cleanPrice.endsWith('/')) {
      cleanPrice = cleanPrice.slice(0, -1).trim();
    }
    
    // Check for common billing period patterns and normalize them
    if (cleanPrice.includes('/')) {
      // Common billing period replacements
      cleanPrice = cleanPrice
        .replace(/\s*\/\s*month\b/i, '/month')
        .replace(/\s*\/\s*monthly\b/i, '/month')
        .replace(/\s*\/\s*mo\b/i, '/month')
        .replace(/\s*\/\s*year\b/i, '/year')
        .replace(/\s*\/\s*yearly\b/i, '/year')
        .replace(/\s*\/\s*annual\b/i, '/year')
        .replace(/\s*\/\s*week\b/i, '/week')
        .replace(/\s*\/\s*weekly\b/i, '/week')
        .replace(/\s*\/\s*day\b/i, '/day')
        .replace(/\s*\/\s*daily\b/i, '/day')
        .replace(/\s*\/\s*(\d+)\s*month[s]?\b/i, '/$1 months')
        .replace(/\s*\/\s*(\d+)\s*week[s]?\b/i, '/$1 weeks')
        .replace(/\s*\/\s*(\d+)\s*day[s]?\b/i, '/$1 days')
        .replace(/\s*\/\s*(\d+)\s*year[s]?\b/i, '/$1 years');
    }
    
    return cleanPrice;
  }
  
  // If we can't parse it properly, default to N/A
  console.log(`Warning: Could not parse price "${price}" for ${whopName}, setting to N/A`);
  return 'N/A';
}

async function fixPrices(dryRun: boolean = true) {
  try {
    console.log(`🔍 ${dryRun ? 'ANALYZING' : 'FIXING'} price issues...`);
    
    // Get all whops with their current prices
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        price: true,
        description: true
      }
    });
    
    console.log(`📊 Found ${whops.length} whops to analyze`);
    
    let correctedCount = 0;
    const corrections: Array<{id: string, name: string, oldPrice: string | null, newPrice: string}> = [];
    
    for (const whop of whops) {
      const correctedPrice = validateAndCorrectPrice(whop.price, whop.name, whop.description || '');
      
      if (correctedPrice !== (whop.price || 'N/A')) {
        corrections.push({
          id: whop.id,
          name: whop.name,
          oldPrice: whop.price,
          newPrice: correctedPrice
        });
        correctedCount++;
        
        if (!dryRun) {
          await prisma.deal.update({
            where: { id: whop.id },
            data: { price: correctedPrice }
          });
        }
      }
    }
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`Total whops analyzed: ${whops.length}`);
    console.log(`Price corrections needed: ${correctedCount}`);
    
    if (corrections.length > 0) {
      console.log(`\n🔧 CORRECTIONS ${dryRun ? '(PREVIEW)' : '(APPLIED)'}:`);
      corrections.forEach(correction => {
        console.log(`  • ${correction.name}`);
        console.log(`    OLD: ${correction.oldPrice || 'null'}`);
        console.log(`    NEW: ${correction.newPrice}`);
        console.log('');
      });
    }
    
    if (dryRun) {
      console.log(`\n💡 This was a dry run. To apply changes, run with --apply flag`);
    } else {
      console.log(`\n✅ Successfully updated ${correctedCount} prices!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const isDryRun = !process.argv.includes('--apply');

fixPrices(isDryRun); 