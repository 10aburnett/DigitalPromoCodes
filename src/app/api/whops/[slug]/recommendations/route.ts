import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Helpers
function looksLikeCuid(s: string) {
  // cuid2 from Prisma typically starts with a letter, length ~ 24–32
  return /^[a-z][a-z0-9]{20,}$/i.test(s);
}
function normSlug(s: string) {
  return decodeURIComponent(s || '').trim();
}

interface RecommendedWhop {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
  category: string | null;
  price: string | null;
  rating: number;
  promoCodes: Array<{
    id: string;
    title: string;
    type: string;
    value: string;
    code: string | null;
  }>;
}

// Comprehensive topic keywords for precise matching
const TOPIC_KEYWORDS = {
  // E-commerce and dropshipping
  ecommerce: ['dropshipping', 'shopify', 'amazon fba', 'ecommerce', 'e-commerce', 'online store', 'product research', 'amazon', 'ebay', 'etsy', 'facebook ads', 'google ads', 'product sourcing', 'aliexpress', 'wholesale', 'retail', 'online selling', 'marketplace', 'brand building', 'private label', 'inventory', 'fulfillment'],
  
  // Day trading and forex
  daytrading: ['day trading', 'daytrading', 'forex', 'fx trading', 'scalping', 'swing trading', 'technical analysis', 'chart patterns', 'price action', 'indicators', 'currency trading', 'pip', 'spread', 'leverage', 'margin', 'mt4', 'mt5', 'trading signals', 'market analysis', 'trading strategy', 'risk management'],
  
  // Cryptocurrency trading
  cryptotrading: ['crypto trading', 'bitcoin', 'ethereum', 'altcoin', 'cryptocurrency', 'blockchain', 'defi', 'nft trading', 'binance', 'coinbase', 'trading bot', 'crypto signals', 'hodl', 'spot trading', 'futures trading', 'margin trading', 'crypto analysis'],
  
  // Stock trading and investing
  stocktrading: ['stock trading', 'stocks', 'equities', 'options trading', 'penny stocks', 'dividend', 'portfolio', 'wall street', 'nasdaq', 'dow jones', 's&p 500', 'market cap', 'earnings', 'bull market', 'bear market', 'value investing', 'growth stocks'],
  
  // Sports betting and gambling
  sportsbetting: ['sports betting', 'sportsbetting', 'bet', 'gambling', 'odds', 'handicapping', 'picks', 'tipster', 'bookmaker', 'sportsbook', 'matched betting', 'arbitrage betting', 'betting strategy', 'football betting', 'basketball betting', 'soccer betting', 'tennis betting', 'horse racing', 'casino', 'poker'],
  
  // Real estate investing
  realestate: ['real estate', 'property', 'rental', 'landlord', 'flip', 'wholesale', 'airbnb', 'fix and flip', 'buy and hold', 'reit', 'mortgage', 'foreclosure', 'investment property', 'commercial real estate', 'residential'],
  
  // Digital marketing and SMM
  digitalmarketing: ['digital marketing', 'social media marketing', 'smm', 'instagram', 'tiktok', 'youtube', 'facebook marketing', 'content creation', 'influencer', 'affiliate marketing', 'email marketing', 'lead generation', 'conversion', 'funnel', 'copywriting'],
  
  // Business and entrepreneurship
  business: ['business', 'entrepreneur', 'startup', 'consulting', 'coaching', 'mentoring', 'scaling', 'revenue', 'profit', 'business model', 'saas', 'agency', 'freelancing', 'side hustle'],
  
  // Fitness and health
  fitness: ['fitness', 'workout', 'gym', 'bodybuilding', 'weight loss', 'nutrition', 'diet', 'muscle building', 'personal training', 'health coaching', 'supplements'],
  
  // Education and courses
  education: ['course', 'training', 'masterclass', 'tutorial', 'education', 'learning', 'skill development', 'certification', 'academy', 'bootcamp', 'workshop'],
  
  // Software and tools
  tools: ['software', 'tool', 'automation', 'bot', 'system', 'platform', 'app', 'plugin', 'script', 'api', 'saas tool'],
  
  // Technology and AI
  technology: ['ai', 'artificial intelligence', 'machine learning', 'coding', 'programming', 'development', 'tech', 'blockchain', 'web development', 'app development']
};

// Function to extract topic relevance with weighted scoring
function extractTopicRelevance(text: string, targetTopics: string[]): number {
  if (!text) return 0;
  
  const normalizedText = text.toLowerCase();
  let relevanceScore = 0;
  
  for (const topic of targetTopics) {
    const topicWords = topic.split(' ');
    
    // Exact phrase match gets highest score
    if (normalizedText.includes(topic)) {
      relevanceScore += topicWords.length * 5; // Multi-word phrases get higher scores
    }
    
    // Individual word matches
    for (const word of topicWords) {
      if (word.length > 2) { // Skip very short words
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        const matches = normalizedText.match(regex);
        if (matches) {
          relevanceScore += matches.length * 2;
        }
      }
    }
  }
  
  return relevanceScore;
}

// Function to determine primary topic categories from text
function getTopicCategories(text: string, whopName: string = ''): string[] {
  if (!text && !whopName) return [];
  
  const combinedText = `${text} ${whopName}`.toLowerCase();
  const categoryScores: { [key: string]: number } = {};
  
  for (const [category, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    const score = extractTopicRelevance(combinedText, keywords);
    if (score > 0) {
      categoryScores[category] = score;
    }
  }
  
  // Sort by score and return top categories
  return Object.entries(categoryScores)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 3) // Take top 3 categories
    .map(([category]) => category);
}

// Enhanced similarity scoring with stricter requirements
function calculateSimilarityScore(currentWhop: any, candidateWhop: any): number {
  let score = 0;
  
  // Get topic categories for both whops
  const currentTopics = getTopicCategories(currentWhop.description || '', currentWhop.name || '');
  const candidateTopics = getTopicCategories(candidateWhop.description || '', candidateWhop.name || '');
  
  // Exact category match (if both have categories set)
  if (currentWhop.category && candidateWhop.category) {
    if (currentWhop.category.toLowerCase() === candidateWhop.category.toLowerCase()) {
      score += 100; // Very high score for exact category match
    }
  }
  
  // Primary topic category match (highest priority)
  const primaryCurrentTopic = currentTopics[0];
  const primaryCandidateTopic = candidateTopics[0];
  
  if (primaryCurrentTopic && primaryCandidateTopic) {
    if (primaryCurrentTopic === primaryCandidateTopic) {
      score += 80; // High score for same primary topic
    }
  }
  
  // Secondary topic matches
  const commonTopics = currentTopics.filter(topic => candidateTopics.includes(topic));
  score += commonTopics.length * 25; // 25 points per common topic
  
  // Price range similarity (lower priority)
  if (currentWhop.price && candidateWhop.price && currentWhop.price === candidateWhop.price) {
    score += 10;
  }
  
  // Advanced keyword matching with domain-specific terms
  if (currentWhop.description && candidateWhop.description) {
    const currentKeywords = extractDomainKeywords(currentWhop.description, currentWhop.name);
    const candidateKeywords = extractDomainKeywords(candidateWhop.description, candidateWhop.name);
    
    const commonKeywords = currentKeywords.filter(keyword => 
      candidateKeywords.includes(keyword)
    ).length;
    
    score += Math.min(commonKeywords * 3, 30); // Cap at 30 points
  }
  
  // Quality bonus for higher-rated content
  if (candidateWhop.rating > 4.0) {
    score += candidateWhop.rating * 2;
  }
  
  return score;
}

// Extract important domain-specific keywords
function extractDomainKeywords(text: string, name: string = ''): string[] {
  const combinedText = `${text} ${name}`.toLowerCase();
  const keywords: Set<string> = new Set();
  
  // Extract all keywords from all categories
  for (const categoryKeywords of Object.values(TOPIC_KEYWORDS)) {
    for (const keyword of categoryKeywords) {
      if (combinedText.includes(keyword)) {
        keywords.add(keyword);
      }
    }
  }
  
  // Extract important standalone words (4+ characters)
  const words = combinedText.match(/\b[a-z]{4,}\b/g) || [];
  const importantWords = words.filter(word => 
    !['that', 'this', 'with', 'from', 'they', 'have', 'been', 'will', 'make', 'more', 'time', 'like', 'just', 'only', 'also', 'your', 'their', 'other', 'such', 'even', 'much', 'many', 'most', 'some'].includes(word)
  );
  
  importantWords.forEach(word => keywords.add(word));
  
  return Array.from(keywords);
}

export async function GET(req: Request, { params }: { params: { slug: string } }) {
  try {
    const key = normSlug(params.slug);
    if (!key) {
      return new Response(JSON.stringify({ error: 'Missing slug or id' }), { status: 400 });
    }

    // Try slug first; if not found and it looks like an id, try id.
    let currentWhop = await prisma.whop.findUnique({
      where: { slug: key },
      select: { id: true, slug: true, name: true, description: true, category: true, price: true },
    });

    if (!currentWhop && looksLikeCuid(key)) {
      currentWhop = await prisma.whop.findUnique({
        where: { id: key },
        select: { id: true, slug: true, name: true, description: true, category: true, price: true },
      });
    }

    if (!currentWhop) {
      return new Response(JSON.stringify({ error: 'Whop not found' }), { status: 404 });
    }

    // Get current whop's primary topics
    const currentTopics = getTopicCategories(currentWhop.description || '', currentWhop.name || '');
    
    // Get all potential candidate whops
    const candidateWhops = await prisma.whop.findMany({
      where: {
        id: { not: currentWhop.id }
      },
      include: {
        PromoCode: {
          select: {
            id: true,
            title: true,
            type: true,
            value: true,
            code: true,
          }
        }
      },
      take: 200 // Increased to get more candidates for better filtering
    });

    // Calculate similarity scores and filter for relevance
    const scoredCandidates = candidateWhops
      .map(candidate => ({
        ...candidate,
        similarityScore: calculateSimilarityScore(currentWhop, candidate)
      }))
      .filter(candidate => candidate.similarityScore >= 20); // Only include candidates with meaningful similarity

    // Sort by similarity score, then by rating, then by creation date
    const sortedCandidates = scoredCandidates.sort((a, b) => {
      if (b.similarityScore !== a.similarityScore) {
        return b.similarityScore - a.similarityScore;
      }
      if (b.rating !== a.rating) {
        return b.rating - a.rating;
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Take top 4 recommendations
    const recommendations = sortedCandidates.slice(0, 4);

    return new Response(JSON.stringify({
      whop: currentWhop,
      recommendations,
      total: recommendations.length,
      debug: process.env.NODE_ENV === 'development' ? {
        currentWhopName: currentWhop.name,
        currentWhopCategory: currentWhop.category,
        currentWhopTopics: currentTopics,
        topScores: recommendations.map(r => ({
          name: r.name,
          score: r.similarityScore,
          category: r.category,
          topics: getTopicCategories(r.description || '', r.name || ''),
          matchedTopics: currentTopics.filter(topic =>
            getTopicCategories(r.description || '', r.name || '').includes(topic)
          )
        })),
        totalCandidates: candidateWhops.length,
        relevantCandidates: scoredCandidates.length
      } : undefined
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  } catch (err: any) {
    console.error('recommendations API error:', err);
    // Surface a non-500 when cause is Prisma validation
    if (String(err?.name).includes('PrismaClientValidationError')) {
      return new Response(JSON.stringify({ error: 'Invalid where clause' }), { status: 400 });
    }
    return new Response(JSON.stringify({ error: 'Internal error' }), { status: 500 });
  }
} 