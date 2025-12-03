import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to determine category based on content
function determineCategory(name: string, description: string | null): string {
  const fullContent = `${name} ${description || ''}`;
  const lowerContent = fullContent.toLowerCase();
  
  // Special case: if no description, default to OTHER (as user requested)
  if (!description || description.trim().length === 0) {
    return 'OTHER';
  }
  
  // Helper function to test multiple regex patterns against content (case insensitive)
  const matchesAny = (patterns: RegExp[]): boolean => {
    return patterns.some(pattern => pattern.test(fullContent));
  };
  
  // Helper function for contextual matching - ensures patterns align with overall theme
  const matchesInContext = (
    primaryPatterns: RegExp[], 
    supportingContext: string[], 
    excludeIfPresent: RegExp[] = [],
    minimumMatches: number = 1
  ): boolean => {
    // First check if we have the primary patterns
    const primaryMatches = primaryPatterns.filter(pattern => pattern.test(fullContent));
    if (primaryMatches.length < minimumMatches) return false;
    
    // Check exclusions - if present, this is NOT the right category
    if (excludeIfPresent.length > 0) {
      const hasExclusion = excludeIfPresent.some(exclusion => exclusion.test(fullContent));
      if (hasExclusion) return false;
    }
    
    // Check if supporting context words appear to reinforce the theme
    const contextMatches = supportingContext.filter(word => 
      lowerContent.includes(word.toLowerCase())
    );
    
    // For strong primary matches, require less context. For weaker matches, require more context
    const requiredContextScore = primaryMatches.length >= 2 ? 1 : 2;
    return contextMatches.length >= requiredContextScore;
  };
  
  // PRIORITY 1: STRONGEST CATEGORY INDICATORS (HIGH-PRECISION JARGON)
  
  // Sports Betting - Comprehensive contextual analysis
  const sportsBettingPrimary = [
    /\b(sports?\s*bett?ing|sport\s*book|sportsbook)\b/gi,
    /\b(betting\s*(tips?|picks?|advice|strategy|community|discord|group|service|alert))\b/gi,
    /\b(tipster|capper|tout|betting\s*expert|sports?\s*analyst|prediction\s*service|handicapp?er)\b/gi,
    /\b(picks?\s*(and\s*predictions?|service|community|group|discord|alert)|betting\s*picks?)\b/gi,
    /\b(parlay|moneyline|spread|prop\s*bet|over\s*under)\b/gi,
    /\b(units|bankroll\s*management|roi|sharps|squares|line\s*movement)\b/gi,
    /\b(juice|vig|vigorish|hedge\s*betting|arbitrage\s*betting)\b/gi,
    /\b(live\s*betting|in\s*play|futures\s*betting|prop\s*bets)\b/gi,
    /\b(american\s*odds|decimal\s*odds|fractional\s*odds|implied\s*probability)\b/gi,
    /\b(leaderboard.*track.*capper|capper.*performance|betting.*leaderboard)\b/gi,
    /\b(draftkings|fanduel|betmgm|caesars|bovada|betway|bet365)\b/gi,
    /\b\w*caps?\w*sports?\w*\b/gi, // Catches variations like "kingcapsports"
    /\b(nfl|nba|mlb|nhl|soccer|football|basketball|tennis|golf|boxing|mma|ufc)\s*(bett?ing|picks?|tips?|predictions?)\b/gi
  ];
  
  const sportsBettingContext = [
    'betting', 'picks', 'tips', 'odds', 'wager', 'parlay', 'sport', 'games', 'match', 'team',
    'capper', 'tipster', 'handicap', 'units', 'bankroll', 'performance', 'leaderboard', 'track'
  ];
  
  const sportsBettingExclusions = [
    /\b(game\s*development|video\s*game|gaming\s*setup|pc\s*gaming|console\s*gaming)\b/gi
  ];
  
  if (matchesInContext(sportsBettingPrimary, sportsBettingContext, sportsBettingExclusions)) {
    return 'SPORTS_BETTING';
  }
  
  // Trading - Comprehensive contextual analysis including algorithmic trading
  const tradingPrimary = [
    /\b(trading|trader|trade|forex|fx|algorithmic\s*trading|algo\s*trading)\b/gi,
    /\b(crypto|bitcoin|cryptocurrency|stock|equity|options?|futures?)\b/gi,
    /\b(smc|smart\s*money\s*concepts?|ict|inner\s*circle\s*trader)\b/gi,
    /\b(technical\s*analysis|fundamental\s*analysis|chart\s*analysis|price\s*action)\b/gi,
    /\b(day\s*trading|swing\s*trading|scalp|scalping|position\s*trading)\b/gi,
    /\b(pre[\s-]*market|after[\s-]*hours|market\s*open|market\s*close)\b/gi,
    /\b(bos|break\s*of\s*structure|choch|change\s*of\s*character)\b/gi,
    /\b(ob|order\s*block|fvg|fair\s*value\s*gap|liquidity\s*sweep)\b/gi,
    /\b(risk\s*management|position\s*sizing|stop\s*loss|take\s*profit)\b/gi,
    /\b(leverage|margin|bull\s*market|bear\s*market|volatil|market)\b/gi,
    /\b(rsi|macd|moving\s*average|fibonacci|support|resistance|breakout)\b/gi,
    /\b(candlestick|chart\s*pattern|trend|momentum|entry|exit)\b/gi,
    /\b(pips|spreads|currency\s*pairs|lot\s*size|pip\s*value)\b/gi,
    /\b(portfolio|investment|investing|market\s*analysis)\b/gi,
    /\b(cutting[\s-]*edge.*technology.*trading|advanced.*trading.*solutions)\b/gi,
    /\b(empowering\s*traders|trading\s*solutions|navigate.*markets?)\b/gi
  ];
  
  const tradingContext = [
    'trading', 'trader', 'market', 'analysis', 'chart', 'price', 'profit', 'loss', 'strategy',
    'signals', 'indicators', 'forex', 'crypto', 'stock', 'investment', 'portfolio', 'risk',
    'algorithmic', 'technology', 'solutions', 'navigate', 'volatile', 'empowering', 'advanced'
  ];
  
  const tradingExclusions = [
    /\b(fitness|workout|gym|nutrition|health|meal|exercise|training\s*program)\b/gi,
    /\b(gaming|game|video\s*game|esports|streaming|twitch)\b/gi
  ];
  
  if (matchesInContext(tradingPrimary, tradingContext, tradingExclusions)) {
    return 'TRADING';
  }
  
  // E-commerce - Contextual analysis for online business
  const ecommercePrimary = [
    /\b(e[\s-]*commerce|ecommerce|online\s*store|digital\s*store|shopify)\b/gi,
    /\b(dropship|drop[\s-]*ship|amazon\s*fba|etsy|alibaba)\b/gi,
    /\b(high\s*ticket.*sales?|high\s*ticket.*ecommerce|high\s*ticket.*program)\b/gi,
    /\b(product\s*selling|online\s*selling|inventory|fulfillment|supplier)\b/gi,
    /\b(fba|fulfillment\s*by\s*amazon|fbm|amazon\s*seller)\b/gi,
    /\b(ppc|pay\s*per\s*click|roas|return\s*on\s*ad\s*spend)\b/gi,
    /\b(aov|average\s*order\s*value|conversion\s*rate|cart)\b/gi,
    /\b(oberlo|spocket|printful|print\s*on\s*demand|pod)\b/gi,
    /\b(online\s*business.*selling|digital\s*product.*selling)\b/gi
  ];
  
  const ecommerceContext = [
    'ecommerce', 'store', 'selling', 'product', 'online', 'digital', 'shopify', 'amazon',
    'dropship', 'fulfillment', 'inventory', 'supplier', 'profit', 'sales', 'business'
  ];
  
  if (matchesInContext(ecommercePrimary, ecommerceContext)) {
    return 'ECOMMERCE';
  }
  
  // Social Media - Contextual analysis for content creation and growth
  const socialMediaPrimary = [
    /\b(instagram|tiktok|youtube|twitter|facebook|social\s*media)\b/gi,
    /\b(content\s*creator|influencer|viral|follower|engagement|audience)\b/gi,
    /\b(grow.*channel|channel.*grow|channel.*accelerator|subscriber)\b/gi,
    /\b(ig|insta|tik[\s-]*tok|you[\s-]*tube|yt)\b/gi,
    /\b(stories|reels|shorts|igtv|youtube\s*shorts|tiktok\s*videos)\b/gi,
    /\b(ugc|user\s*generated\s*content|brand\s*partnerships)\b/gi,
    /\b(monetization|creator\s*fund|brand\s*deals|sponsored\s*content)\b/gi,
    /\b(hashtag|algorithm|trending|viral\s*content)\b/gi,
    /\b(social\s*media\s*growth|audience\s*building|content\s*strategy)\b/gi
  ];
  
  const socialMediaContext = [
    'social', 'media', 'content', 'creator', 'audience', 'follower', 'growth', 'viral',
    'instagram', 'tiktok', 'youtube', 'channel', 'video', 'post', 'engagement', 'brand'
  ];
  
  if (matchesInContext(socialMediaPrimary, socialMediaContext)) {
    return 'SOCIAL_MEDIA';
  }
  
  // Business & Agencies - Contextual analysis for business operations
  const businessPrimary = [
    /\b(business|entrepreneur|startup|enterprise|agency)\b/gi,
    /\b(smma|social\s*media\s*marketing\s*agency|digital\s*agency)\b/gi,
    /\b(client\s*acquisition|lead\s*generation|sales\s*funnel|b2b)\b/gi,
    /\b(consulting|consultant|freelancing|service\s*business)\b/gi,
    /\b(saas|software\s*as\s*a\s*service|recurring\s*revenue)\b/gi,
    /\b(scaling|automation|systemization|delegation)\b/gi,
    /\b(kpi|metrics|analytics|performance\s*tracking)\b/gi
  ];
  
  const businessContext = [
    'business', 'agency', 'client', 'service', 'consulting', 'entrepreneur', 'startup',
    'marketing', 'lead', 'sales', 'automation', 'scaling', 'revenue', 'growth'
  ];
  
  if (matchesInContext(businessPrimary, businessContext)) {
    return 'BUSINESS';
  }
  
  // PRIORITY 2: CONTEXTUAL ANALYSIS FOR REMAINING CATEGORIES
  
  // Gaming - Ensure it's actually about gaming, not other activities
  const gamingPrimary = [
    /\b(gaming|gamer|video\s*game|pc\s*gaming|console\s*gaming)\b/gi,
    /\b(esports|e[\s-]*sports|competitive\s*gaming|tournament)\b/gi,
    /\b(twitch|streaming.*game|youtube.*gaming|game\s*streaming)\b/gi,
    /\b(gameplay|game\s*mechanics|meta|tier\s*list|patch\s*notes)\b/gi,
    /\b(minecraft|fortnite|call\s*of\s*duty|valorant|league\s*of\s*legends)\b/gi,
    /\b(fps|moba|battle\s*royale|mmorpg|rpg)\b/gi,
    /\b(gaming\s*setup|gaming\s*chair|gaming\s*monitor|gpu|graphics\s*card)\b/gi
  ];
  
  const gamingContext = [
    'gaming', 'game', 'player', 'esports', 'tournament', 'streaming', 'twitch', 'gameplay',
    'competitive', 'video', 'console', 'pc', 'setup', 'monitor', 'keyboard', 'mouse'
  ];
  
  const gamingExclusions = [
    /\b(betting|sports\s*betting|gambling|odds|wager|picks)\b/gi,
    /\b(trading|forex|stock|crypto|market|investment)\b/gi
  ];
  
  if (matchesInContext(gamingPrimary, gamingContext, gamingExclusions)) {
    return 'GAMING';
  }
  
  // Reselling - Contextual analysis for product flipping
  const resellingPrimary = [
    /\b(resell|re[\s-]*sell|retail\s*arbitrage)\b/gi,
    /\b(flip|flipping|flipped).*\b(product|item|profit|money)\b/gi,
    /\b(ticket\s*resell|resell.*group|resell.*community)\b/gi,
    /\b(\d+\s*figure\s*flip|figure\s*flip)\b/gi,
    /\b(buy.*low.*sell.*high|profit.*flip)\b/gi,
    /\b(mercari|poshmark|depop|vinted|ebay.*flip)\b/gi,
    /\b(thrift|garage\s*sale|secondhand|wholesale.*resell)\b/gi
  ];
  
  const resellingContext = [
    'resell', 'flip', 'profit', 'buy', 'sell', 'arbitrage', 'wholesale', 'retail',
    'product', 'item', 'thrift', 'secondhand', 'marketplace', 'ebay', 'mercari'
  ];
  
  const resellingExclusions = [
    /\b(real\s*estate|property|house|apartment|land)\b/gi,
    /\b(ecommerce|online\s*store|dropship|shopify)\b/gi
  ];
  
  if (matchesInContext(resellingPrimary, resellingContext, resellingExclusions)) {
    return 'RESELLING';
  }
  
  // Fitness - Contextual analysis for health and fitness
  const fitnessPrimary = [
    /\b(fitness|workout|gym|bodybuilding|weight\s*lifting)\b/gi,
    /\b(nutrition|diet|meal\s*prep|supplement|protein)\b/gi,
    /\b(muscle|weight\s*loss|fat\s*loss|strength|cardio)\b/gi,
    /\b(personal\s*trainer|fitness\s*coach|health\s*coach)\b/gi,
    /\b(crossfit|yoga|pilates|marathon|exercise)\b/gi,
    /\b(macros|calories|bmr|cutting|bulking)\b/gi
  ];
  
  const fitnessContext = [
    'fitness', 'workout', 'gym', 'health', 'nutrition', 'exercise', 'training',
    'muscle', 'weight', 'diet', 'strength', 'cardio', 'coach', 'body'
  ];
  
  if (matchesInContext(fitnessPrimary, fitnessContext)) {
    return 'FITNESS';
  }
  
  // Personal Development - Contextual analysis for self-improvement
  const personalDevPrimary = [
    /\b(personal\s*development|self\s*improvement|life\s*coach|mindset)\b/gi,
    /\b(motivation|productivity|goal|success|leadership|confidence)\b/gi,
    /\b(coaching|mentoring|empowerment|transformation)\b/gi,
    /\b(habits|inspire|potential|growth.*mindset)\b/gi
  ];
  
  const personalDevContext = [
    'personal', 'development', 'self', 'improvement', 'mindset', 'coaching', 'goals',
    'success', 'motivation', 'productivity', 'leadership', 'confidence', 'growth'
  ];
  
  if (matchesInContext(personalDevPrimary, personalDevContext)) {
    return 'PERSONAL_DEVELOPMENT';
  }
  
  // Personal Finance - Contextual analysis for money management
  const personalFinancePrimary = [
    /\b(personal\s*financ|budgeting|budget|debt|credit\s*repair)\b/gi,
    /\b(financial\s*planning|financial\s*freedom|wealth\s*building)\b/gi,
    /\b(money\s*management|financial\s*literacy|savings)\b/gi,
    /\b(retirement|emergency\s*fund|financial\s*goals)\b/gi
  ];
  
  const personalFinanceContext = [
    'financial', 'money', 'budget', 'savings', 'debt', 'wealth', 'planning',
    'retirement', 'emergency', 'credit', 'personal', 'finance'
  ];
  
  if (matchesInContext(personalFinancePrimary, personalFinanceContext)) {
    return 'PERSONAL_FINANCE';
  }
  
  // AI - Contextual analysis for artificial intelligence
  const aiPrimary = [
    /\b(artificial\s*intelligence|machine\s*learning|deep\s*learning)\b/gi,
    /\b(chatgpt|gpt|openai|claude|midjourney|dall[\s-]*e)\b/gi,
    /\b(ai\s*tool|ai\s*automation|prompt\s*engineering)\b/gi,
    /\b(neural\s*network|algorithm.*ai|ai.*algorithm)\b/gi
  ];
  
  const aiContext = [
    'ai', 'artificial', 'intelligence', 'machine', 'learning', 'automation',
    'algorithm', 'neural', 'network', 'prompt', 'chatgpt', 'openai'
  ];
  
  const aiExclusions = [
    /\b(agency|marketing\s*agency|business\s*agency)\b/gi
  ];
  
  if (matchesInContext(aiPrimary, aiContext, aiExclusions)) {
    return 'AI';
  }
  
  // PRIORITY 3: REMAINING CATEGORIES WITH SIMPLER MATCHING
  
  // Computer Science - Programming and development
  const csPrimary = [
    /\b(programming|coding|software\s*development|web\s*development)\b/gi,
    /\b(javascript|python|react|html|css|java|c\+\+)\b/gi,
    /\b(developer|programmer|software\s*engineer)\b/gi
  ];
  
  if (matchesAny(csPrimary)) {
    return 'COMPUTER_SCIENCE';
  }
  
  // Real Estate
  const realEstatePrimary = [
    /\b(real\s*estate|property|rental|landlord|realtor)\b/gi,
    /\b(house|apartment|mortgage|airbnb)\b/gi
  ];
  
  if (matchesAny(realEstatePrimary)) {
    return 'REAL_ESTATE';
  }
  
  // Careers
  const careerPrimary = [
    /\b(career|job|resume|interview|employment)\b/gi,
    /\b(linkedin|workplace|hiring|salary)\b/gi
  ];
  
  if (matchesAny(careerPrimary)) {
    return 'CAREERS';
  }
  
  // Recreation
  const recreationPrimary = [
    /\b(hobby|art|music|photography|cooking|creative)\b/gi,
    /\b(paint|draw|instrument|guitar|piano)\b/gi
  ];
  
  if (matchesAny(recreationPrimary)) {
    return 'RECREATION';
  }
  
  // Travel
  const travelPrimary = [
    /\b(travel|vacation|trip|tourism|nomad)\b/gi,
    /\b(flight|hotel|destination|abroad)\b/gi
  ];
  
  if (matchesAny(travelPrimary)) {
    return 'TRAVEL';
  }
  
  // Dating
  const datingPrimary = [
    /\b(dating|relationship|romance|love|attraction)\b/gi,
    /\b(tinder|bumble|hinge|pickup)\b/gi
  ];
  
  if (matchesAny(datingPrimary)) {
    return 'DATING';
  }
  
  // Agencies
  if (matchesAny([/\b(agency|freelanc|upwork|fiverr)\b/gi])) {
    return 'AGENCIES';
  }
  
  // Languages (with exclusions for other contexts)
  const languagePrimary = [
    /\b(language|learn.*language|spanish|french|english|german)\b/gi,
    /\b(duolingo|babbel|fluency|translation)\b/gi
  ];
  
  const languageExclusions = [
    /\b(resell|betting|trading|business|ecommerce|crypto)\b/gi
  ];
  
  if (matchesAny(languagePrimary) && !matchesAny(languageExclusions)) {
    return 'LANGUAGES';
  }
  
  // Podcasts
  if (matchesAny([/\b(podcast|podcasting|audio|interview)\b/gi])) {
    return 'PODCASTS';
  }
  
  // Newsletters
  if (matchesAny([/\b(newsletter|email\s*marketing|substack)\b/gi])) {
    return 'NEWSLETTERS';
  }
  
  // Spirituality
  if (matchesAny([/\b(spiritual|meditation|chakra|manifestation)\b/gi])) {
    return 'SPIRITUALITY';
  }
  
  // Game Show
  if (matchesAny([/\b(game\s*show|quiz|trivia|competition)\b/gi])) {
    return 'GAME_SHOW';
  }
  
  // Default to OTHER if no clear primary focus is detected
  return 'OTHER';
}

async function categorizeAllWhops(dryRun: boolean = true) {
  try {
    console.log(`🔍 ${dryRun ? 'ANALYZING' : 'UPDATING'} all whops for categorization...\n`);
    
    // Get all whops
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        whopCategory: true
      }
    });
    
    console.log(`Found ${whops.length} whops to categorize...\n`);
    
    let updatedCount = 0;
    const categoryStats: Record<string, number> = {};
    const updates: Array<{id: string, name: string, oldCategory: string, newCategory: string}> = [];
    
    for (const whop of whops) {
      const newCategory = determineCategory(whop.name, whop.description);
      
      // Track stats
      categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1;
      
      // Check if category needs updating
      if (whop.whopCategory !== newCategory) {
        updates.push({
          id: whop.id,
          name: whop.name,
          oldCategory: whop.whopCategory,
          newCategory: newCategory
        });
        updatedCount++;
        
        if (!dryRun) {
          await prisma.deal.update({
            where: { id: whop.id },
            data: { whopCategory: newCategory as any }
          });
        }
      }
    }
    
    // Display results
    console.log('📊 CATEGORY DISTRIBUTION:');
    const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
    sortedCategories.forEach(([category, count]) => {
      const percentage = ((count / whops.length) * 100).toFixed(1);
      console.log(`  ${category.replace(/_/g, ' ')}: ${count} (${percentage}%)`);
    });
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`Total whops: ${whops.length}`);
    console.log(`Categories needing updates: ${updatedCount}`);
    console.log(`Categories populated: ${Object.keys(categoryStats).length}`);
    
    if (updates.length > 0) {
      console.log(`\n🔧 ${dryRun ? 'PREVIEW OF UPDATES' : 'UPDATES APPLIED'}:`);
      updates.slice(0, 20).forEach(update => {
        console.log(`  • ${update.name}: ${update.oldCategory} → ${update.newCategory}`);
      });
      if (updates.length > 20) {
        console.log(`  ... and ${updates.length - 20} more`);
      }
    }
    
    if (dryRun && updates.length > 0) {
      console.log(`\n💡 This was a dry run. To apply changes, run with --apply flag`);
    } else if (!dryRun && updates.length > 0) {
      console.log(`\n✅ Successfully categorized ${updatedCount} whops!`);
    }
    
  } catch (error) {
    console.error('❌ Error categorizing whops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Parse command line arguments
const isDryRun = !process.argv.includes('--apply');

categorizeAllWhops(isDryRun); 