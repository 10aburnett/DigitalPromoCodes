// src/lib/topics.ts
// Topical clustering helpers for SEO internal linking
// Regex-based topic extraction + Jaccard similarity (no DB changes)

export const TOPIC_PATTERNS = {
  // E-commerce and dropshipping
  ecommerce: /\b(dropshipping|shopify|amazon\s+fba|e[-\s]?commerce|online\s+store|product\s+research|amazon|ebay|etsy|facebook\s+ads|google\s+ads|product\s+sourcing|aliexpress|wholesale|retail|online\s+selling|marketplace|brand\s+building|private\s+label|inventory|fulfillment)\b/i,

  // Day trading and forex
  daytrading: /\b(day\s*trading|forex|fx\s*trading|scalping|swing\s*trading|technical\s*analysis|chart\s*patterns|price\s*action|indicator(s)?|currency\s*trading|pip(s)?|spread|leverage|margin|mt4|mt5|trading\s*signals|market\s*analysis|trading\s*strategy|risk\s*management)\b/i,

  // Cryptocurrency trading
  cryptotrading: /\b(crypto\s*trading|bitcoin|ethereum|altcoin(s)?|cryptocurrency|blockchain|defi|nft\s*trading|binance|coinbase|trading\s*bot|crypto\s*signals|hodl|spot\s*trading|futures\s*trading|margin\s*trading|crypto\s*analysis)\b/i,

  // Stock/options trading and investing
  stocktrading: /\b(stock\s*trading|stocks|equities|options\s*trading|penny\s*stocks|dividend(s)?|portfolio|wall\s*street|nasdaq|dow\s*jones|s&?p\s*500|market\s*cap|earnings|bull\s*market|bear\s*market|value\s*investing|growth\s*stocks)\b/i,

  // Sports betting and gambling
  sportsbetting: /\b(sports\s*betting|sportsbook|bet(ting)?|gambling|odds|handicapping|picks|tipster(s)?|bookmaker|matched\s*betting|arbitrage\s*betting|betting\s*strategy|football|basketball|soccer|tennis|horse\s*racing|casino|poker)\b/i,

  // Real estate investing
  realestate: /\b(real\s*estate|property|rental|landlord|flip|wholesale|airbnb|fix\s*and\s*flip|buy\s*and\s*hold|reit(s)?|mortgage|foreclosure|investment\s*property|commercial\s*real\s*estate|residential)\b/i,

  // Digital marketing and SMM
  digitalmarketing: /\b(digital\s*marketing|social\s*media\s*marketing|smm|instagram|tiktok|youtube|facebook\s*marketing|content\s*creation|influencer|affiliate\s*marketing|email\s*marketing|lead\s*generation|conversion|funnel|copywriting)\b/i,

  // Business and entrepreneurship
  business: /\b(business|entrepreneur(ship)?|startup|consulting|coaching|mentoring|scaling|revenue|profit|business\s*model|saas|agency|freelancing|side\s*hustle)\b/i,

  // Fitness and health
  fitness: /\b(fitness|workout|gym|bodybuilding|weight\s*loss|nutrition|diet|muscle\s*building|personal\s*training|health\s*coaching|supplements?)\b/i,

  // Education and courses
  education: /\b(course|training|masterclass|tutorial|education|learning|skill\s*development|certification|academy|bootcamp|workshop)\b/i,

  // Software and tools
  tools: /\b(software|tool|automation|bot|system|platform|app|plugin|script|api|saas\s*tool)\b/i,

  // Technology and AI
  technology: /\b(ai|artificial\s*intelligence|machine\s*learning|coding|programming|development|tech|blockchain|web\s*development|app\s*development)\b/i,
} as const;

/**
 * Extract topics from whop name and description using regex patterns.
 * Returns array of matched topic keys.
 */
export function extractTopics(name: string = '', description: string = ''): string[] {
  const text = `${name} ${description}`.toLowerCase();
  const topics: string[] = [];

  for (const [topic, pattern] of Object.entries(TOPIC_PATTERNS)) {
    // no /g flag → no lastIndex surprises
    if (pattern.test(text)) topics.push(topic);
  }
  return topics;
}

/**
 * Jaccard similarity between two arrays (0..1).
 */
export function jaccard(a: string[], b: string[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const setA = new Set(a);
  const setB = new Set(b);
  const intersection = new Set([...setA].filter(x => setB.has(x)));
  const union = new Set([...setA, ...setB]);

  return intersection.size / union.size;
}