const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Function to determine category based on holistic content analysis
function determineCategory(name, description) {
  // Special case: if no description, default to OTHER
  if (!description || description.trim().length === 0) {
    return 'OTHER';
  }
  
  const fullContent = `${name} ${description}`;
  const lowerContent = fullContent.toLowerCase();
  
  // Helper function for holistic contextual matching
  const holisticMatch = (
    categoryName,
    primaryKeywords,
    supportingKeywords,
    excludeKeywords = [],
    strongIndicators = []
  ) => {
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
    
    return totalScore >= requiredScore || primaryMatches >= 2;
  };

  // TRADING - Must be most specific due to high volume
  if (holisticMatch(
    'trading',
    ['trading', 'trader', 'forex', 'crypto', 'options', 'futures', 'stocks', 'scalping', 'day trading'],
    ['signals', 'alerts', 'market', 'charts', 'technical analysis', 'indicators', 'portfolio', 'investment', 'profit', 'loss'],
    ['sports betting', 'casino', 'gambling']
  )) {
    return 'TRADING';
  }
  
  // SPORTS BETTING - High specificity needed
  if (holisticMatch(
    'sports betting',
    ['sports betting', 'sportsbook', 'betting', 'picks', 'odds', 'parlays', 'prop bets'],
    ['nfl', 'nba', 'mlb', 'nhl', 'soccer', 'football', 'basketball', 'baseball', 'hockey', 'mma', 'ufc', 'boxing', 'tennis', 'golf', 'esports'],
    ['trading', 'forex', 'crypto', 'stocks']
  )) {
    return 'SPORTS_BETTING';
  }
  
  // AI - Artificial Intelligence and Machine Learning
  if (holisticMatch(
    'ai',
    ['ai', 'artificial intelligence', 'machine learning', 'chatgpt', 'openai', 'automation', 'bot'],
    ['neural', 'algorithm', 'prompt', 'llm', 'generative', 'deep learning', 'nlp', 'computer vision'],
    []
  )) {
    return 'AI';
  }
  
  // BUSINESS - General business and entrepreneurship
  if (holisticMatch(
    'business',
    ['business', 'entrepreneur', 'startup', 'agency', 'consulting', 'marketing', 'sales', 'lead generation'],
    ['revenue', 'profit', 'client', 'customer', 'scaling', 'growth', 'strategy', 'management', 'operations'],
    ['trading', 'ecommerce', 'dropshipping', 'amazon', 'shopify', 'social media', 'reselling']
  )) {
    return 'BUSINESS';
  }
  
  // ECOMMERCE - E-commerce and online selling
  if (holisticMatch(
    'ecommerce',
    ['ecommerce', 'e-commerce', 'dropshipping', 'amazon', 'shopify', 'etsy', 'online store'],
    ['fba', 'fulfillment', 'product', 'supplier', 'inventory', 'selling', 'store', 'retail'],
    ['reselling', 'flipping']
  )) {
    return 'ECOMMERCE';
  }
  
  // SOCIAL MEDIA - Social media marketing and growth
  if (holisticMatch(
    'social media',
    ['social media', 'instagram', 'tiktok', 'youtube', 'facebook', 'twitter', 'linkedin', 'content creation'],
    ['followers', 'engagement', 'viral', 'influencer', 'brand', 'organic', 'growth', 'views', 'likes'],
    []
  )) {
    return 'SOCIAL_MEDIA';
  }
  
  // RESELLING - Reselling and flipping
  if (holisticMatch(
    'reselling',
    ['reselling', 'resell', 'flipping', 'sneakers', 'shoes', 'collectibles', 'arbitrage'],
    ['profit', 'buy', 'sell', 'marketplace', 'ebay', 'stockx', 'goat', 'discord', 'cook group'],
    ['amazon', 'fba', 'dropshipping']
  )) {
    return 'RESELLING';
  }
  
  // FITNESS - Health and fitness
  if (holisticMatch(
    'fitness',
    ['fitness', 'workout', 'gym', 'bodybuilding', 'training', 'exercise', 'nutrition', 'diet'],
    ['muscle', 'weight', 'health', 'strength', 'cardio', 'protein', 'supplements', 'transformation'],
    []
  )) {
    return 'FITNESS';
  }
  
  // PERSONAL DEVELOPMENT - Self-improvement and personal growth
  if (holisticMatch(
    'personal development',
    ['personal development', 'self improvement', 'mindset', 'confidence', 'motivation', 'productivity', 'habits'],
    ['growth', 'success', 'achievement', 'goal', 'discipline', 'leadership', 'communication', 'psychology'],
    []
  )) {
    return 'PERSONAL_DEVELOPMENT';
  }
  
  // REAL ESTATE - Real estate investing and property
  if (holisticMatch(
    'real estate',
    ['real estate', 'property', 'rental', 'investing', 'flipping houses', 'wholesaling', 'section 8'],
    ['mortgage', 'cash flow', 'appreciation', 'tenant', 'landlord', 'market', 'acquisition', 'rehab'],
    []
  )) {
    return 'REAL_ESTATE';
  }
  
  // CAREERS - Career development and job-related
  if (holisticMatch(
    'careers',
    ['career', 'job', 'remote work', 'freelancing', 'resume', 'interview', 'hiring', 'employment'],
    ['salary', 'promotion', 'skills', 'professional', 'workplace', 'networking', 'linkedin'],
    []
  )) {
    return 'CAREERS';
  }
  
  // PERSONAL FINANCE - Personal finance and money management
  if (holisticMatch(
    'personal finance',
    ['personal finance', 'budgeting', 'saving', 'debt', 'credit', 'financial planning', 'wealth building'],
    ['money', 'income', 'expenses', 'investment', 'retirement', 'emergency fund', 'financial freedom'],
    ['trading', 'business', 'ecommerce']
  )) {
    return 'PERSONAL_FINANCE';
  }
  
  // Default to OTHER if no clear category match
  return 'OTHER';
}

async function recategorizeOtherWhops() {
  try {
    console.log('🔍 Recategorizing whops currently in OTHER category...\n');
    
    // Get all whops in OTHER category
    const otherWhops = await prisma.deal.findMany({
      where: { whopCategory: 'OTHER' },
      select: {
        id: true,
        name: true,
        description: true,
        whopCategory: true
      }
    });
    
    console.log(`Found ${otherWhops.length} whops in OTHER category to recategorize...\n`);
    
    let updatedCount = 0;
    const categoryStats = {};
    const updates = [];
    
    for (const whop of otherWhops) {
      const newCategory = determineCategory(whop.name, whop.description);
      
      // Track stats
      categoryStats[newCategory] = (categoryStats[newCategory] || 0) + 1;
      
      // Always update OTHER whops, even if they remain OTHER
      if (newCategory !== 'OTHER') {
        updates.push({
          id: whop.id,
          name: whop.name,
          oldCategory: whop.whopCategory,
          newCategory: newCategory,
          description: whop.description
        });
        
        // Update in database
        await prisma.deal.update({
          where: { id: whop.id },
          data: { whopCategory: newCategory }
        });
        
        updatedCount++;
        console.log(`✅ Updated "${whop.name}" from OTHER to ${newCategory}`);
      }
    }
    
    console.log(`\n📊 CATEGORY DISTRIBUTION (from OTHER category):`);
    Object.entries(categoryStats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([category, count]) => {
        const percentage = ((count / otherWhops.length) * 100).toFixed(1);
        console.log(`  ${category}: ${count} (${percentage}%)`);
      });
    
    console.log(`\n📋 SUMMARY:`);
    console.log(`Total OTHER whops processed: ${otherWhops.length}`);
    console.log(`Categories updated: ${updatedCount}`);
    console.log(`Still in OTHER: ${otherWhops.length - updatedCount}`);
    
    if (updates.length > 0) {
      console.log(`\n🔄 UPDATES MADE:`);
      updates.forEach(update => {
        console.log(`  "${update.name}" → ${update.newCategory}`);
      });
    }
    
  } catch (error) {
    console.error('Error recategorizing whops:', error);
  } finally {
    await prisma.$disconnect();
  }
}

recategorizeOtherWhops();