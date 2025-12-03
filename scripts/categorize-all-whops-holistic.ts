import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Function to determine category based on holistic content analysis
function determineCategory(name: string, description: string | null): string {
  // Special case: if no description, default to OTHER
  if (!description || description.trim().length === 0) {
    return 'OTHER';
  }
  
  const fullContent = `${name} ${description}`;
  const lowerContent = fullContent.toLowerCase();
  
  // Helper function for holistic contextual matching
  const holisticMatch = (
    categoryName: string,
    primaryKeywords: string[],
    supportingKeywords: string[],
    excludeKeywords: string[] = [],
    strongIndicators: RegExp[] = []
  ): boolean => {
    // Check for exclusion keywords first
    if (excludeKeywords.some(keyword => lowerContent.includes(keyword.toLowerCase()))) {
      return false;
    }
    
    // Check for strong indicators (specific phrases that are unmistakable)
    if (strongIndicators.some(pattern => pattern.test(fullContent))) {
      return true;
    }
    
    // Count primary keyword matches
    const primaryMatches = primaryKeywords.filter(keyword => 
      lowerContent.includes(keyword.toLowerCase())
    ).length;
    
    // Count supporting keyword matches
    const supportingMatches = supportingKeywords.filter(keyword => 
      lowerContent.includes(keyword.toLowerCase())
    ).length;
    
    // Holistic scoring: need strong primary evidence + supporting context
    const primaryScore = primaryMatches * 2; // Primary keywords worth more
    const supportingScore = supportingMatches;
    const totalScore = primaryScore + supportingScore;
    
    // Different thresholds based on category specificity
    const requiredScore = 3; // Minimum score needed
    
    return totalScore >= requiredScore && primaryMatches >= 1;
  };
  
  // SPORTS BETTING - Check first as it's very specific
  if (holisticMatch(
    'sports betting',
    ['betting', 'picks', 'capper', 'tipster', 'sports book', 'sportsbook', 'wager', 'odds'],
    ['sports', 'games', 'team', 'match', 'performance', 'leaderboard', 'track', 'community', 
     'discord', 'tips', 'predictions', 'handicap', 'units', 'bankroll', 'parlay', 'moneyline'],
    ['gaming', 'video game', 'pc gaming', 'console'],
    [
      /\bJoin \d+[,\d]*\+ members.*betting.*group/gi,
      /\bleaderboard.*track.*capper.*performance/gi,
      /\bbetting.*group.*uses.*leaderboard/gi,
      /\bcapper.*performance.*livestream/gi,
      /\bsports?.*betting.*community/gi
    ]
  )) {
    return 'SPORTS_BETTING';
  }
  
  // TRADING - Including algorithmic trading and specific jargon
  if (holisticMatch(
    'trading',
    ['trading', 'trader', 'trade', 'forex', 'algorithmic trading', 'algo trading', 'market'],
    ['chart', 'analysis', 'price', 'profit', 'strategy', 'signals', 'crypto', 'bitcoin', 
     'stock', 'investment', 'portfolio', 'risk', 'smc', 'technology', 'solutions', 
     'navigate', 'volatile', 'empowering', 'advanced', 'cutting-edge'],
    ['fitness', 'workout', 'gym', 'nutrition', 'gaming', 'video game'],
    [
      /\balgorithmic.*trading.*solutions/gi,
      /\bempowering.*traders.*technology/gi,
      /\badvanced.*trading.*solutions/gi,
      /\bnavigate.*volatile.*markets/gi,
      /\bcutting[\s-]*edge.*technology.*trading/gi,
      /\bsmc\s*(space|concepts?)/gi,
      /\bpre[\s-]*market.*analysis/gi,
      /\btrading.*technology.*empowering/gi
    ]
  )) {
    return 'TRADING';
  }
  
  // E-COMMERCE - Online selling and digital stores
  if (holisticMatch(
    'ecommerce',
    ['ecommerce', 'e-commerce', 'online store', 'shopify', 'dropship', 'amazon fba'],
    ['selling', 'product', 'store', 'online', 'digital', 'business', 'sales', 'profit',
     'inventory', 'fulfillment', 'supplier', 'high ticket'],
    [],
    [
      /\bhigh.*ticket.*e[\s-]*commerce/gi,
      /\bhigh.*ticket.*sales/gi,
      /\bonline.*store.*selling/gi,
      /\bshopify.*store.*business/gi,
      /\bdropship.*product.*profit/gi
    ]
  )) {
    return 'ECOMMERCE';
  }
  
  // SOCIAL MEDIA - Content creation and audience growth
  if (holisticMatch(
    'social media',
    ['instagram', 'tiktok', 'youtube', 'social media', 'content creator', 'influencer'],
    ['content', 'creator', 'audience', 'follower', 'growth', 'viral', 'channel', 'video',
     'engagement', 'brand', 'monetization', 'subscribers', 'views', 'algorithm'],
    [],
    [
      /\bgrow.*channel.*accelerator/gi,
      /\bchannel.*growth.*youtube/gi,
      /\bcontent.*creator.*monetization/gi,
      /\bsocial.*media.*growth/gi,
      /\binfluencer.*brand.*deals/gi
    ]
  )) {
    return 'SOCIAL_MEDIA';
  }
  
  // BUSINESS - Business operations and agencies
  if (holisticMatch(
    'business',
    ['business', 'agency', 'entrepreneur', 'startup', 'smma'],
    ['client', 'service', 'consulting', 'marketing', 'lead', 'sales', 'revenue', 'growth',
     'automation', 'scaling', 'b2b', 'saas'],
    [],
    [
      /\bbusiness.*agency.*client/gi,
      /\bagency.*client.*acquisition/gi,
      /\bsmma.*social.*media.*marketing/gi,
      /\bconsulting.*business.*growth/gi
    ]
  )) {
    return 'BUSINESS';
  }
  
  // GAMING - Video games and esports (with strong exclusions for betting)
  if (holisticMatch(
    'gaming',
    ['gaming', 'gamer', 'video game', 'esports', 'twitch'],
    ['game', 'player', 'tournament', 'streaming', 'gameplay', 'competitive', 'console',
     'pc', 'setup', 'monitor'],
    ['betting', 'sports betting', 'odds', 'wager', 'picks', 'capper', 'tipster'],
    [
      /\bvideo.*game.*streaming/gi,
      /\besports.*tournament.*competitive/gi,
      /\bgaming.*setup.*monitor/gi,
      /\bpc.*gaming.*build/gi
    ]
  )) {
    return 'GAMING';
  }
  
  // RESELLING - Product flipping and arbitrage
  if (holisticMatch(
    'reselling',
    ['resell', 'reselling', 'flip', 'flipping', 'arbitrage'],
    ['profit', 'buy', 'sell', 'product', 'item', 'marketplace', 'ebay', 'mercari',
     'thrift', 'wholesale', 'retail'],
    ['real estate', 'property', 'house', 'ecommerce', 'dropship'],
    [
      /\b\d+.*figure.*flip/gi,
      /\bresell.*product.*profit/gi,
      /\bflip.*item.*money/gi,
      /\bretail.*arbitrage.*profit/gi
    ]
  )) {
    return 'RESELLING';
  }
  
  // FITNESS - Health and physical training
  if (holisticMatch(
    'fitness',
    ['fitness', 'workout', 'gym', 'bodybuilding', 'nutrition'],
    ['health', 'exercise', 'training', 'muscle', 'weight', 'diet', 'strength',
     'cardio', 'coach', 'body', 'supplement'],
    [],
    [
      /\bfitness.*workout.*gym/gi,
      /\bnutrition.*diet.*health/gi,
      /\bbodybuilding.*muscle.*strength/gi
    ]
  )) {
    return 'FITNESS';
  }
  
  // PERSONAL DEVELOPMENT - Self-improvement and coaching
  if (holisticMatch(
    'personal development',
    ['personal development', 'self improvement', 'life coach', 'mindset', 'motivation'],
    ['coaching', 'goals', 'success', 'productivity', 'leadership', 'confidence',
     'growth', 'transformation', 'habits'],
    [],
    [
      /\bpersonal.*development.*coaching/gi,
      /\blife.*coach.*transformation/gi,
      /\bmindset.*success.*goals/gi
    ]
  )) {
    return 'PERSONAL_DEVELOPMENT';
  }
  
  // PERSONAL FINANCE - Money management (not trading)
  if (holisticMatch(
    'personal finance',
    ['personal finance', 'budgeting', 'budget', 'debt', 'savings'],
    ['financial', 'money', 'wealth', 'planning', 'retirement', 'credit', 'emergency'],
    ['trading', 'forex', 'crypto', 'stock'],
    [
      /\bpersonal.*financial.*planning/gi,
      /\bbudget.*debt.*savings/gi,
      /\bfinancial.*literacy.*money/gi
    ]
  )) {
    return 'PERSONAL_FINANCE';
  }
  
  // AI - Artificial Intelligence (not agencies)
  if (holisticMatch(
    'ai',
    ['artificial intelligence', 'ai', 'machine learning', 'chatgpt', 'openai'],
    ['automation', 'algorithm', 'neural', 'network', 'prompt', 'technology'],
    ['agency', 'marketing agency', 'business agency'],
    [
      /\bartificial.*intelligence.*machine/gi,
      /\bai.*automation.*tool/gi,
      /\bmachine.*learning.*algorithm/gi
    ]
  )) {
    return 'AI';
  }
  
  // COMPUTER SCIENCE - Programming and development
  if (holisticMatch(
    'computer science',
    ['programming', 'coding', 'software development', 'web development'],
    ['developer', 'programmer', 'javascript', 'python', 'react', 'html', 'css'],
    [],
    [
      /\blearn.*to.*code/gi,
      /\bsoftware.*development.*programming/gi,
      /\bweb.*development.*coding/gi
    ]
  )) {
    return 'COMPUTER_SCIENCE';
  }
  
  // REAL ESTATE - Property and real estate investment
  if (holisticMatch(
    'real estate',
    ['real estate', 'property', 'rental', 'landlord', 'realtor'],
    ['house', 'apartment', 'mortgage', 'airbnb', 'investment'],
    []
  )) {
    return 'REAL_ESTATE';
  }
  
  // CAREERS - Job and career development
  if (holisticMatch(
    'careers',
    ['career', 'job', 'resume', 'interview', 'employment'],
    ['linkedin', 'workplace', 'hiring', 'salary', 'professional'],
    []
  )) {
    return 'CAREERS';
  }
  
  // RECREATION - Hobbies and creative activities
  if (holisticMatch(
    'recreation',
    ['hobby', 'art', 'music', 'photography', 'cooking'],
    ['creative', 'paint', 'draw', 'instrument', 'guitar', 'piano'],
    []
  )) {
    return 'RECREATION';
  }
  
  // TRAVEL - Travel and tourism
  if (holisticMatch(
    'travel',
    ['travel', 'vacation', 'trip', 'tourism', 'nomad'],
    ['flight', 'hotel', 'destination', 'abroad', 'adventure'],
    []
  )) {
    return 'TRAVEL';
  }
  
  // DATING - Relationships and dating
  if (holisticMatch(
    'dating',
    ['dating', 'relationship', 'romance', 'love'],
    ['attraction', 'tinder', 'bumble', 'hinge'],
    []
  )) {
    return 'DATING';
  }
  
  // AGENCIES - Freelancing and service agencies
  if (holisticMatch(
    'agencies',
    ['agency', 'freelance', 'freelancing', 'contractor'],
    ['upwork', 'fiverr', 'service', 'client work'],
    []
  )) {
    return 'AGENCIES';
  }
  
  // LANGUAGES - Language learning (with strong exclusions)
  if (holisticMatch(
    'languages',
    ['language', 'spanish', 'french', 'english', 'translation'],
    ['learn', 'fluency', 'duolingo', 'babbel'],
    ['resell', 'betting', 'trading', 'business', 'ecommerce']
  )) {
    return 'LANGUAGES';
  }
  
  // PODCASTS - Podcasting and audio content
  if (holisticMatch(
    'podcasts',
    ['podcast', 'podcasting', 'audio'],
    ['interview', 'spotify', 'apple podcast'],
    []
  )) {
    return 'PODCASTS';
  }
  
  // NEWSLETTERS - Email marketing and newsletters
  if (holisticMatch(
    'newsletters',
    ['newsletter', 'email marketing'],
    ['substack', 'mailchimp', 'email list'],
    []
  )) {
    return 'NEWSLETTERS';
  }
  
  // SPIRITUALITY - Spiritual and wellness practices
  if (holisticMatch(
    'spirituality',
    ['spiritual', 'meditation', 'manifestation'],
    ['chakra', 'consciousness', 'enlightenment'],
    []
  )) {
    return 'SPIRITUALITY';
  }
  
  // GAME SHOW - Game shows and competitions
  if (holisticMatch(
    'game show',
    ['game show', 'quiz', 'trivia'],
    ['competition', 'contest'],
    []
  )) {
    return 'GAME_SHOW';
  }
  
  // Default to OTHER if no clear category match
  return 'OTHER';
}

async function categorizeAllWhops(dryRun: boolean = true) {
  try {
    console.log(`🔍 ${dryRun ? 'ANALYZING' : 'UPDATING'} all whops for holistic categorization...\n`);
    
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
    const updates: Array<{id: string, name: string, oldCategory: string, newCategory: string, description: string}> = [];
    
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
          newCategory: newCategory,
          description: whop.description?.substring(0, 100) + '...' || ''
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
      updates.slice(0, 15).forEach(update => {
        console.log(`  • ${update.name}: ${update.oldCategory} → ${update.newCategory}`);
        console.log(`    "${update.description}"`);
      });
      if (updates.length > 15) {
        console.log(`  ... and ${updates.length - 15} more`);
      }
    }
    
    if (dryRun && updates.length > 0) {
      console.log(`\n💡 This was a holistic analysis. To apply changes, run with --apply flag`);
    } else if (!dryRun && updates.length > 0) {
      console.log(`\n✅ Successfully applied holistic categorization to ${updatedCount} whops!`);
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