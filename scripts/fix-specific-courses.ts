import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Specific course corrections with their actual prices
const SPECIFIC_COURSE_CORRECTIONS = [
  {
    name: 'Scale Your Salary (3M+VA)',
    correctPrice: '$1,750/month',
    reason: 'User confirmed actual price is $1,750/month, not $25,000 from description'
  },
  {
    name: 'Scale Your Salary - (3M DIY)',
    correctPrice: '$1,750/month', 
    reason: 'User confirmed actual price is $1,750/month, not $25,000 from description'
  },
  // User provided corrections for the 44 flagged courses - UPDATED WITH NUMBERED LIST 1-44
  {
    name: 'TMS+ (Heavy Hitters) 💎',
    correctPrice: '$29.99 per week',
    reason: 'User confirmed actual price is $29.99 per week - course #1'
  },
  {
    name: 'TMS (#1 ON WHOP)',
    correctPrice: '$99.99/2 days',
    reason: 'User confirmed actual price is $99.99/2 days - course #2'
  },
  {
    name: 'Strike Access Full Access',
    correctPrice: '9.99 USD / 3 days',
    reason: 'User confirmed actual price is 9.99 USD / 3 days - course #3'
  },
  {
    name: 'Betting Hub',
    correctPrice: '15 USD / week',
    reason: 'User confirmed actual price is 15 USD / week - course #4'
  },
  {
    name: 'Trading Secrets Scalper',
    correctPrice: 'N/A',
    reason: 'User confirmed price should be N/A - course #5'
  },
  {
    name: 'Pushin Picks',
    correctPrice: '100 USD/month',
    reason: 'User confirmed actual price is 100 USD/month - course #6'
  },
  {
    name: 'Thomps Locks',
    correctPrice: '15 USD/week',
    reason: 'User confirmed actual price is 15 USD/week - course #7'
  },
  {
    name: '🥇 Inversionista Visionario',
    correctPrice: 'N/A',
    reason: 'User confirmed price should be N/A - course #8'
  },
  {
    name: 'The High Ticket eCom Program',
    correctPrice: '$5,315',
    reason: 'User confirmed actual price is $5,315 - course #9'
  },
  {
    name: 'CashFlowCoaching',
    correctPrice: '299 USD/month',
    reason: 'User confirmed actual price is 299 USD/month - course #10'
  },
  {
    name: 'Millionaire Classroom Basic',
    correctPrice: '49.99 USD / month',
    reason: 'User confirmed actual price is 49.99 USD / month - course #11'
  },
  {
    name: 'Print Money W TikTok Course',
    correctPrice: '60 USD/month',
    reason: 'User confirmed actual price is 60 USD/month - course #12'
  },
  {
    name: 'Print Money W TikTok',
    correctPrice: '20 USD /month',
    reason: 'User confirmed actual price is 20 USD /month - course #13'
  },
  {
    name: 'Instagram Business Blueprint',
    correctPrice: '997 USD one time payment',
    reason: 'User confirmed actual price is 997 USD one time payment - course #14'
  },
  {
    name: 'Maximus Media',
    correctPrice: '49 USD / month',
    reason: 'User confirmed actual price is 49 USD / month - course #15'
  },
  {
    name: 'Creator Blueprint',
    correctPrice: '27 USD/month',
    reason: 'User confirmed actual price is 27 USD/month - course #16'
  },
  {
    name: 'Make Money on Tiktok',
    correctPrice: '10 USD/week',
    reason: 'User confirmed actual price is 10 USD/week - course #17'
  },
  {
    name: 'Frugal Season',
    correctPrice: '75 USD/month',
    reason: 'User confirmed actual price is 75 USD/month - course #18'
  },
  {
    name: 'Aumenta Tu Valor',
    correctPrice: 'N/A',
    reason: 'User confirmed price should be N/A - course #19'
  },
  {
    name: 'AI Creator 1.0',
    correctPrice: '30 USD/month',
    reason: 'User confirmed actual price is 30 USD/month - course #20'
  },
  {
    name: 'Wealth Academy Pro',
    correctPrice: '49 USD/month',
    reason: 'User confirmed actual price is 49 USD/month - course #21'
  },
  {
    name: 'Faceless Academy',
    correctPrice: '49 USD/month',
    reason: 'User confirmed actual price is 49 USD/month - course #22'
  },
  {
    name: 'Education Club Lifetime Pass',
    correctPrice: '99 USD one time payment',
    reason: 'User confirmed actual price is 99 USD one time payment - course #23'
  },
  {
    name: 'Tiktok Prodigies Accelerator.w',
    correctPrice: '995 USD 60 day access',
    reason: 'User confirmed actual price is 995 USD 60 day access - course #24'
  },
  {
    name: 'Primetime Diamond Club',
    correctPrice: '$100',
    reason: 'User confirmed actual price is $100 - course #25'
  },
  {
    name: 'Primetime VIP Equities',
    correctPrice: '$200 USD/month',
    reason: 'User confirmed actual price is $200 USD/month - course #26'
  },
  {
    name: 'EXCLUSIVE ACCESS',
    correctPrice: '300 USD/Month',
    reason: 'User confirmed actual price is 300 USD/Month - course #27'
  },
  {
    name: 'Yearly Subscription - SKIP WL',
    correctPrice: '799 USD/year',
    reason: 'User confirmed actual price is 799 USD/year - course #28'
  },
  {
    name: 'J&K Plus Memebership',
    correctPrice: '$19.99/week',
    reason: 'User confirmed actual price is $19.99/week - course #29'
  },
  {
    name: 'TapMob Premium',
    correctPrice: '40 USD/month',
    reason: 'User confirmed actual price is 40 USD/month - course #30'
  },
  {
    name: 'Cronus Heaven Premium',
    correctPrice: '10 USD/month',
    reason: 'User confirmed actual price is 10 USD/month - course #31'
  },
  {
    name: '1Kto10K 🪜 CHALLENGE',
    correctPrice: '499 USD / 40 day access',
    reason: 'User confirmed actual price is 499 USD / 40 day access - course #32'
  },
  {
    name: 'Escape Room Gold',
    correctPrice: '24.99 USD/20 days',
    reason: 'User confirmed actual price is 24.99 USD/20 days - course #33'
  },
  {
    name: 'Rios to Riches',
    correctPrice: 'Free',
    reason: 'User confirmed this course is free - course #34'
  },
  {
    name: 'Flipseek',
    correctPrice: '35 USD/month',
    reason: 'User confirmed actual price is 35 USD/month - course #35'
  },
  {
    name: 'Profit Pursuit',
    correctPrice: '50 USD/month',
    reason: 'User confirmed actual price is 50 USD/month - course #36'
  },
  {
    name: 'Renewal - RB',
    correctPrice: '75 USD/month',
    reason: 'User confirmed actual price is 75 USD/month - course #37'
  },
  {
    name: 'Renewal - F',
    correctPrice: 'N/A',
    reason: 'User confirmed price should be N/A - course #38'
  },
  {
    name: 'Fornightly Membership',
    correctPrice: 'N/A',
    reason: 'User confirmed price should be N/A - course #39'
  },
  {
    name: 'Digi Tools',
    correctPrice: '50 USD/month',
    reason: 'User confirmed actual price is 50 USD/month - course #40'
  },
  {
    name: 'Prophets of Profit',
    correctPrice: '7.50 USD/week',
    reason: 'User confirmed actual price is 7.50 USD/week - course #41'
  },
  {
    name: 'Peak Profits Lifetime',
    correctPrice: '125 USD one time payment',
    reason: 'User confirmed actual price is 125 USD one time payment - course #42'
  },
  {
    name: 'Daily Bread',
    correctPrice: '9.99 USD/week',
    reason: 'User confirmed actual price is 9.99 USD/week - course #43'
  },
  {
    name: 'ATN $25,000',
    correctPrice: '25,000 USD one time payment',
    reason: 'User confirmed actual price is 25,000 USD one time payment - course #44'
  }
];

async function fixSpecificCourses(dryRun: boolean = true) {
  try {
    console.log(`🔍 ${dryRun ? 'ANALYZING' : 'FIXING'} specific course pricing corrections...\n`);
    
    let correctedCount = 0;
    const corrections: Array<{id: string, name: string, oldPrice: string | null, newPrice: string, reason: string}> = [];
    
    for (const correction of SPECIFIC_COURSE_CORRECTIONS) {
      // Find the course by name
      const whop = await prisma.deal.findFirst({
        where: {
          name: {
            equals: correction.name,
            mode: 'insensitive'
          }
        },
        select: {
          id: true,
          name: true,
          price: true
        }
      });
      
      if (whop) {
        // Check if the price needs to be corrected
        if (whop.price !== correction.correctPrice) {
          corrections.push({
            id: whop.id,
            name: whop.name,
            oldPrice: whop.price,
            newPrice: correction.correctPrice,
            reason: correction.reason
          });
          correctedCount++;
          
          if (!dryRun) {
            await prisma.deal.update({
              where: { id: whop.id },
              data: { price: correction.correctPrice }
            });
            console.log(`✅ Updated ${whop.name}: ${whop.price} → ${correction.correctPrice}`);
          }
        } else {
          console.log(`✅ ${whop.name} already has correct price: ${whop.price}`);
        }
      } else {
        console.log(`⚠️  Course not found: ${correction.name}`);
      }
    }
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`Specific courses checked: ${SPECIFIC_COURSE_CORRECTIONS.length}`);
    console.log(`Price corrections needed: ${correctedCount}`);
    
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
    
    if (dryRun && corrections.length > 0) {
      console.log(`\n💡 This was a dry run. To apply changes, run with --apply flag`);
    } else if (!dryRun && corrections.length > 0) {
      console.log(`\n✅ Successfully updated ${correctedCount} specific course prices!`);
    } else if (corrections.length === 0) {
      console.log(`\n✅ All specific courses already have correct pricing!`);
    }
    
  } catch (error) {
    console.error('❌ Error fixing specific course prices:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const isDryRun = !process.argv.includes('--apply');

fixSpecificCourses(isDryRun); 