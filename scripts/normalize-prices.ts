import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

function normalizePrice(price: string | null): string | null {
  if (!price) return null;
  
  const priceStr = price.trim();
  
  // Handle special cases
  if (priceStr.toLowerCase() === 'free') return 'Free';
  if (priceStr.toLowerCase() === 'n/a') return 'N/A';
  
  let normalized = priceStr;
  
  // Preserve non-USD currencies - don't modify if they contain other currency symbols
  if (normalized.includes('€') || normalized.includes('£') || 
      normalized.toLowerCase().includes('eur') || normalized.toLowerCase().includes('gbp') ||
      normalized.toLowerCase().includes('cad') || normalized.toLowerCase().includes('aud') ||
      normalized.toLowerCase().includes('inr') || normalized.toLowerCase().includes('jpy')) {
    return normalized; // Return as-is to preserve original currency formatting
  }
  
  // Handle US$ format - convert to just $
  normalized = normalized.replace(/US\$/g, '$');
  
  // Remove "USD" and add $ if needed (only for USD prices)
  normalized = normalized.replace(/\bUSD\b/gi, '').trim();
  
  // Add $ if it doesn't start with $ and contains numbers
  if (!/^\$/.test(normalized) && /\d/.test(normalized)) {
    normalized = '$' + normalized;
  }
  
  // Remove "one time payment" and similar phrases first
  normalized = normalized.replace(/\s*(one time payment|onetime payment|one-time payment)\s*/gi, '');
  
  // Handle specific access period patterns before general period normalization
  normalized = normalized.replace(/(\d+)\s+days?\s+access/gi, '$1 days');
  normalized = normalized.replace(/(\d+)\s+day\s+access/gi, '$1 days');
  
  // Remove existing spaces around forward slashes first
  normalized = normalized.replace(/\s*\/\s*/g, '/');
  
  // Handle "per" and period normalizations
  normalized = normalized.replace(/\bper\s+/gi, '/');
  normalized = normalized.replace(/\s+(week|month|year)s?\b/gi, '/$1');
  
  // Fix specific patterns that got mangled
  normalized = normalized.replace(/\/(\d+)\/day/g, '/$1 days');
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Clean up trailing commas or periods
  normalized = normalized.replace(/[,.]$/, '');
  
  // Fix month without slash
  normalized = normalized.replace(/(\$\d+(?:\.\d+)?)\s+month$/i, '$1/month');
  
  // Add .00 to prices that don't have decimals (but avoid numbers with commas)
  normalized = normalized.replace(/\$(\d+)(?![,\.\d])/g, '$$$1.00');
  
  // Now add spaces around forward slashes for better formatting
  normalized = normalized.replace(/\//g, ' / ');
  
  return normalized;
}

async function normalizePrices(dryRun: boolean = true) {
  try {
    console.log(`🔍 ${dryRun ? 'ANALYZING' : 'NORMALIZING'} price formats...\n`);
    
    // Get all whops with prices
    const whops = await prisma.deal.findMany({
      where: {
        price: {
          not: null
        }
      },
      select: {
        id: true,
        name: true,
        price: true
      }
    });
    
    let normalizedCount = 0;
    const normalizations: Array<{id: string, name: string, oldPrice: string, newPrice: string}> = [];
    
    for (const whop of whops) {
      const normalizedPrice = normalizePrice(whop.price);
      
      if (normalizedPrice && normalizedPrice !== whop.price) {
        normalizations.push({
          id: whop.id,
          name: whop.name,
          oldPrice: whop.price!,
          newPrice: normalizedPrice
        });
        normalizedCount++;
        
        if (!dryRun) {
          await prisma.deal.update({
            where: { id: whop.id },
            data: { price: normalizedPrice }
          });
          console.log(`✅ ${whop.name}: "${whop.price}" → "${normalizedPrice}"`);
        }
      }
    }
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`Total whops with prices: ${whops.length}`);
    console.log(`Price formats to normalize: ${normalizedCount}`);
    
    if (normalizations.length > 0) {
      console.log(`\n🔧 NORMALIZATIONS ${dryRun ? '(PREVIEW)' : '(APPLIED)'}:`);
      normalizations.forEach(norm => {
        console.log(`  • ${norm.name}`);
        console.log(`    OLD: "${norm.oldPrice}"`);
        console.log(`    NEW: "${norm.newPrice}"`);
        console.log('');
      });
    }
    
    if (dryRun && normalizations.length > 0) {
      console.log(`\n💡 This was a dry run. To apply changes, run with --apply flag`);
    } else if (!dryRun && normalizations.length > 0) {
      console.log(`\n✅ Successfully normalized ${normalizedCount} price formats!`);
    } else if (normalizations.length === 0) {
      console.log(`\n✅ All prices already have consistent formatting!`);
    }
    
  } catch (error) {
    console.error('❌ Error normalizing prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const isDryRun = !process.argv.includes('--apply');

normalizePrices(isDryRun); 