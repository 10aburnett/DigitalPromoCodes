import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { prisma } from "@/lib/prisma";
import { authOptions } from "@/lib/auth";
import { Role } from "@prisma/client";
import { cookies } from "next/headers";
import { verify } from "jsonwebtoken";
import { JWT_SECRET } from "@/lib/auth-utils";
import { normalizeImagePath } from "@/lib/image-utils";
import { unstable_cache } from "next/cache";

export const dynamic = 'force-dynamic'; // Explicitly mark this route as dynamic
export const revalidate = 0; // Disable caching completely for debugging

// Direct function for fetching published whops (cache disabled)
const getWhops = async (isAdmin: boolean, whereClause: any, sortBy: string = '', page: number = 1, limit: number = 20) => {
  console.log('Fetching whops from database (cache disabled)');
  console.log('Environment check:', {
    nodeEnv: process.env.NODE_ENV,
    databaseUrl: process.env.DATABASE_URL ? 'Set' : 'Missing',
    isAdmin,
    whereClause,
    sortBy
  });
  
  if (sortBy === 'highest' || sortBy === 'lowest' || sortBy === 'alpha-asc' || sortBy === 'alpha-desc' || sortBy === 'default' || sortBy === 'newest' || sortBy === 'highest-rated') {
    // For custom sorting, fetch all whops first
    console.log('Attempting Prisma query for custom sorting...');
    const allWhops = await prisma.whop.findMany({
      where: whereClause,
      include: { 
        PromoCode: true,
        Review: {
          where: { verified: true },
          orderBy: { createdAt: 'desc' }
        }
      }
    });
    console.log('Prisma query successful, found', allWhops.length, 'whops');
    
    return allWhops;
  } else {
    // For database-level sorting
    const orderBy: any = {};
    switch (sortBy) {
      case 'rating':
        orderBy.rating = 'desc';
        break;
      case 'newest':
        orderBy.createdAt = 'desc';
        break;
      case 'oldest':
        orderBy.createdAt = 'asc';
        break;
      default:
        orderBy.displayOrder = 'asc';
    }
    
    const whops = await prisma.whop.findMany({
      where: whereClause,
      include: { 
        PromoCode: true,
        Review: {
          where: { verified: true },
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy,
      skip: (page - 1) * limit,
      take: limit
    });
    
    return whops;
  }
};

// Direct function for counting whops (cache disabled)
const getWhopCount = async (whereClause: any) => {
  console.log('Counting whops from database (cache disabled)');
  return await prisma.whop.count({ where: whereClause });
};

// Direct function for fetching single whop by slug (cache disabled)
const getWhopBySlug = async (slug: string, isAdmin: boolean) => {
  console.log(`Fetching whop by slug: ${slug} (cache disabled)`);
  return await prisma.whop.findFirst({
    where: { 
      slug: slug,
      publishedAt: isAdmin ? undefined : { not: null }
    },
    include: { 
      PromoCode: true,
      reviews: {
        where: { verified: true },
        orderBy: { createdAt: 'desc' }
      }
    }
  });
};

// Define a type for decoded JWT token
interface DecodedToken {
  id: string;
  email: string;
  role: string;
}

// Define a simplified Whop interface for our transformation function
interface SimplifiedWhop {
  id: string;
  name: string;
  slug: string;
  logo: string | null;
  description: string;
  rating: number;
  displayOrder?: number;
  createdAt: Date;
  updatedAt: Date;
  affiliateLink: string | null;
  website?: string | null;
  price?: string | null;
  category?: string | null;
  screenshots?: string[] | null;
  promoCodes: {
    id: string;
    title: string;
    description: string;
    code: string | null;
    type: string;
    value: string;
    whopId: string;
    createdAt: Date;
    updatedAt: Date;
  }[];
}

// Courses that have legitimate prices that might otherwise be flagged (whitelist)
const LEGITIMATE_COURSE_PRICES = [
  'ATN $25,000',  // User confirmed this is actually $100/month, but keeping name for reference
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

// Transform whop data for UI presentation
function transformWhopDataForUI(whop: any) {
  try {
    if (!whop) {
      console.log("Warning: Received null or undefined whop object");
      return null; // Still return null for truly invalid data
    }
    
    console.log(`Transforming whop data for UI, whop ID: ${whop.id}`);
  
  // Clean up fields
  const displayName = whop.name || 'Unknown Whop';
  
  // Use a default placeholder image only if no logo is provided
  const logoPath = whop.logo || '/images/Simplified Logo.png';
  
  // Get the first promo code (if any) - don't create placeholders
  const firstPromoCode = whop.PromoCode && Array.isArray(whop.PromoCode) && whop.PromoCode.length > 0 
    ? whop.PromoCode[0] 
    : null;
  
  // Format price properly with validation (simplified to avoid crashes)
  const formattedPrice = whop.price || 'Free';
  
  // Determine promoText - prioritize whop description over generic promo code titles
  let promoText;
  
  // Check if promo code title is generic/placeholder text
  const isGenericTitle = !firstPromoCode?.title || 
    firstPromoCode.title.toLowerCase().includes('exclusive access') ||
    firstPromoCode.title.toLowerCase().includes('exclusive') ||
    firstPromoCode.title.toLowerCase().includes('access') ||
    firstPromoCode.title === 'N/A' ||
    firstPromoCode.title.trim() === '';
  
  if (!isGenericTitle && firstPromoCode?.title) {
    // Use specific promo code title if it's not generic, with truncation
    const maxLength = 25;
    const title = firstPromoCode.title || '';
    promoText = title.length > maxLength 
      ? title.substring(0, maxLength) + '...'
      : title;
  } else if (whop.description) {
    // Use whop description, truncate to ensure exactly one line only (25 characters max)
    const maxLength = 25;
    const description = whop.description || '';
    promoText = description.length > maxLength 
      ? description.substring(0, maxLength) + '...'
      : description;
  } else {
    promoText = 'N/A';
  }
  
  // Always return the whop data, even if no promo codes - this shows real whops
  return {
    id: whop.slug || `whop-${whop.id}`,
    whopName: displayName,
    name: displayName,
    slug: whop.slug || `whop-${whop.id}`,
    logo: logoPath,
    description: whop.description || "", // Empty string if no description
    rating: typeof whop.rating === 'number' ? whop.rating : 0,
    displayOrder: typeof whop.displayOrder === 'number' ? whop.displayOrder : 0,
    promoType: firstPromoCode?.type?.toLowerCase?.() || 'exclusive',
    promoValue: firstPromoCode ? (parseFloat(firstPromoCode?.value || '0') || 0) : 0,
    promoText: promoText,
    logoUrl: logoPath,
    promoCode: firstPromoCode?.code || null,
    affiliateLink: whop.affiliateLink || '#',
    isActive: true,
    price: formattedPrice, // Use formatted price
    // Add whop and promo code IDs for tracking
    whopId: whop.id,
    promoCodeId: firstPromoCode?.id || null,
    // Include original promoCodes array if available
    promoCodes: Array.isArray(whop.PromoCode) ? whop.PromoCode : [],
    // Include reviews if available
    reviews: Array.isArray(whop.Review) ? whop.Review : [],
    // Include additional fields that might be useful
    website: whop.website,
    category: whop.category
  };
  
  } catch (error) {
    console.error('Error transforming whop data:', error);
    console.error('Failed whop data:', {
      id: whop?.id,
      name: whop?.name,
      promoCodesCount: whop?.PromoCode?.length,
      firstPromoTitle: whop?.PromoCode?.[0]?.title
    });
    // Return a safe fallback object
    return {
      id: whop?.id || 'unknown',
      name: whop?.name || 'Unknown Whop',
      slug: whop?.slug || 'unknown',
      logo: whop?.logo || '/images/Simplified Logo.png',
      description: whop?.description || 'No description available',
      price: 'N/A',
      promoText: 'N/A',
      promoCode: null,
      promoType: null,
      promoValue: null,
      rating: 0,
      affiliateLink: whop?.affiliateLink || null,
      createdAt: whop?.createdAt || new Date(),
      promoCodes: [],
      reviews: [],
      website: whop?.website || null,
      category: whop?.category || null
    };
  }
}

// Helper function to validate and correct obviously incorrect prices
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
  
  // Check if this course is on the whitelist of legitimate prices
  if (LEGITIMATE_COURSE_PRICES.includes(whopName)) {
    console.log(`Info: Preserving whitelisted legitimate price for ${whopName}: ${price}`);
    // Clean up the price format but don't change the value
    if (price.endsWith('/') || price.endsWith('/ ')) {
      return price.replace(/\s*\/\s*$/, '');
    }
    return price;
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

// Helper function to extract numeric value from price string for sorting
function extractPriceValue(priceString: string): number {
  if (!priceString || priceString === 'N/A') return -1; // N/A items go to the end
  if (priceString.toLowerCase() === 'free') return 0; // Free items have value 0
  
  // Remove currency symbols, commas, and extract the first number
  const numericMatch = priceString.replace(/[\$,€£]/g, '').match(/[\d.]+/);
  return numericMatch ? parseFloat(numericMatch[0]) : -1; // Invalid prices go to the end
}

// Helper function to extract alphabetic characters for proper alphabetical sorting
function extractAlphabeticString(text: string): string {
  // Remove all non-alphabetic characters and convert to lowercase
  return text.replace(/[^a-zA-Z]/g, '').toLowerCase();
}

// Helper function to check if whop has a special promo code (frontend hardcoded ones)
function hasSpecialPromoCode(whopName: string): boolean {
  const whopsWithPromoCodes = [
    'Josh Exclusive VIP Access',
    'Momentum Monthly',
    'Larry\'s Lounge Premium',
    'Dodgy\'s Dungeon',
    'Trade With Insight - Pro',
    'ParlayScience Discord Access',
    'Scarface Trades Premium',
    'The Haven',
    'PropFellas VIP',
    'Owls Full Access',
    'Stellar AIO',
    'Goat Ecom Growth',
    'Indicators & VIP | LIFETIME',
    'Supercar Income',
    'GOAT Sports Bets Membership',
    'Best Of Both Worlds',
    'Moementum University',
    'ZWM Lifetime Access',
    'Ayecon Academy Lifetime Membership',
    'The BFI Traders University'
  ];
  return whopsWithPromoCodes.includes(whopName);
}

export async function GET(request: Request) {
  try {
    console.log("🔥 GET /api/whops - Starting API call");
    console.log("🔥 hasSpecialPromoCode function loaded:", typeof hasSpecialPromoCode);
    console.log("🔥 Testing Josh whop:", hasSpecialPromoCode('Josh Exclusive VIP Access'));
    
    // Check if user is admin
    let isAdmin = false;
    try {
      const cookieStore = cookies();
      const token = cookieStore.get('admin-token')?.value;
      
      if (token) {
        const decoded = verify(token, JWT_SECRET) as DecodedToken;
        if (decoded.role === "ADMIN") {
          isAdmin = true;
        }
      }
    } catch (error) {
      // Also try NextAuth session as fallback
      const session = await getServerSession(authOptions);
      if (session?.user?.role === "ADMIN") {
        isAdmin = true;
      }
    }
    
    // Parse query parameters
    const url = new URL(request.url);
    const slug = url.searchParams.get('slug');
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const search = url.searchParams.get('search') || '';
    const promoType = url.searchParams.get('promoType') || '';
    const whopName = url.searchParams.get('whop') || '';
    const sortBy = url.searchParams.get('sortBy') || '';
    const whopCategory = url.searchParams.get('whopCategory') || '';
    
    // Disable caching temporarily to ensure fresh data
    const headers = {
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    };
    
    if (slug) {
      // Get a specific whop by slug using direct function
      console.log(`Fetching specific whop with slug: ${slug}`);
      const whop = await getWhopBySlug(slug, isAdmin);
      
      if (!whop) {
        return NextResponse.json({ error: "Whop not found" }, { status: 404, headers });
      }
      
      return NextResponse.json(transformWhopDataForUI(whop), { headers });
    }
    
    // Build where clause for filtering
    const whereClause: any = {
      // Only show published whops (unless admin)
      publishedAt: isAdmin ? undefined : { not: null }
    };
    
    if (search) {
      whereClause.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { PromoCode: { some: { title: { contains: search, mode: 'insensitive' } } } },
        { PromoCode: { some: { code: { contains: search, mode: 'insensitive' } } } }
      ];
    }
    
    if (whopName) {
      whereClause.name = { contains: whopName, mode: 'insensitive' };
    }
    
    if (whopCategory) {
      whereClause.whopCategory = whopCategory;
    }
    
    // Get total count for pagination using direct database query
    const totalCount = await prisma.whop.count({ where: whereClause });
    
    // For price-based sorting and alphabetical sorting, we need to fetch ALL whops first, then sort and paginate
    if (sortBy === 'highest' || sortBy === 'lowest' || sortBy === 'alpha-asc' || sortBy === 'alpha-desc' || sortBy === 'default' || sortBy === 'newest' || sortBy === 'highest-rated') {
      console.log(`Fetching ALL whops for custom sorting - sortBy: ${sortBy}`);
      
      // Fetch ALL whops that match the filter criteria
      const allWhops = await prisma.whop.findMany({
        where: whereClause,
        include: { PromoCode: true }
      });
      
      console.log(`Found ${allWhops.length} whops for custom sorting`);
      
      // Transform all whops
      let transformedWhops = allWhops.map(whop => transformWhopDataForUI(whop)).filter(whop => whop !== null);
      
      // Apply promo type filter after transformation (since it depends on promo codes)
      if (promoType) {
        transformedWhops = transformedWhops.filter(whop => 
          whop.promoType === promoType.toLowerCase()
        );
      }
      
      // Sort ALL whops by the specified criteria with two-tier system
      if (sortBy === 'highest') {
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, sort by price (highest first)
          const priceA = extractPriceValue(a.price);
          const priceB = extractPriceValue(b.price);
          
          // Handle special cases for highest price sorting
          if (priceA === -1 && priceB === -1) return 0; // Both N/A, maintain order
          if (priceA === -1) return 1; // A is N/A, put it at the end
          if (priceB === -1) return -1; // B is N/A, put it at the end
          if (priceA === 0 && priceB === 0) return 0; // Both free, maintain order
          if (priceA === 0) return 1; // A is free, put it after paid items
          if (priceB === 0) return -1; // B is free, put it after paid items
          
          return priceB - priceA; // Normal highest price first sorting
        });
      } else if (sortBy === 'lowest') {
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, sort by price (lowest first)
          const priceA = extractPriceValue(a.price);
          const priceB = extractPriceValue(b.price);
          
          // Handle special cases for lowest price sorting
          if (priceA === -1 && priceB === -1) return 0; // Both N/A, maintain order
          if (priceA === -1) return 1; // A is N/A, put it at the end
          if (priceB === -1) return -1; // B is N/A, put it at the end
          if (priceA === 0 && priceB === 0) return 0; // Both free, maintain order
          if (priceA === 0) return -1; // A is free, put it first
          if (priceB === 0) return 1; // B is free, put it first
          
          return priceA - priceB; // Normal lowest price first sorting
        });
      } else if (sortBy === 'alpha-asc') {
        // Alphabetical sorting with two-tier system (A-Z)
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, sort alphabetically A-Z
          const alphaA = extractAlphabeticString(a.name);
          const alphaB = extractAlphabeticString(b.name);
          return alphaA.localeCompare(alphaB);
        });
      } else if (sortBy === 'alpha-desc') {
        // Alphabetical sorting with two-tier system (Z-A)
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, sort alphabetically Z-A
          const alphaA = extractAlphabeticString(a.name);
          const alphaB = extractAlphabeticString(b.name);
          return alphaB.localeCompare(alphaA);
        });
      } else if (sortBy === 'default') {
        // Default sorting: promo codes first, then by display order
        
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, maintain original order (displayOrder)
          const orderA = a.displayOrder || 0;
          const orderB = b.displayOrder || 0;
          if (orderA !== orderB) {
            return orderA - orderB;
          }
          
          // Tertiary: if display orders are equal, sort by rating then creation date
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          if (ratingA !== ratingB) {
            return ratingB - ratingA;
          }
          
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      } else if (sortBy === 'newest') {
        // Newest sorting with two-tier system
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, sort by creation date (newest first)
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      } else if (sortBy === 'highest-rated') {
        // Highest-rated sorting with two-tier system
        transformedWhops.sort((a, b) => {
          const aHasPromo = hasSpecialPromoCode(a.name);
          const bHasPromo = hasSpecialPromoCode(b.name);
          
          // First tier: promo codes vs non-promo codes
          if (aHasPromo !== bHasPromo) {
            return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
          }
          
          // Second tier: within same promo status, sort by rating (highest first)
          const ratingA = a.rating || 0;
          const ratingB = b.rating || 0;
          if (ratingA !== ratingB) {
            return ratingB - ratingA;
          }
          
          // Tertiary: if ratings are equal, sort by creation date
          const dateA = new Date(a.createdAt || 0).getTime();
          const dateB = new Date(b.createdAt || 0).getTime();
          return dateB - dateA;
        });
      }
      
      // Now apply pagination to the sorted results
      const offset = (page - 1) * limit;
      const paginatedWhops = transformedWhops.slice(offset, offset + limit);
      
      // Debug log the first item
      if (paginatedWhops.length > 0) {
        console.log("First transformed whop:", JSON.stringify(paginatedWhops[0]).substring(0, 200) + "...");
      } else {
        console.log("No whops found matching the current filters");
      }
      
      // Return paginated response with metadata (use transformedWhops length for accurate pagination)
      const response = {
        data: paginatedWhops,
        pagination: {
          page,
          limit,
          total: transformedWhops.length, // Use filtered and transformed count
          totalPages: Math.ceil(transformedWhops.length / limit),
          hasMore: page * limit < transformedWhops.length
        }
      };
      
      return NextResponse.json(response, { headers });
    }
    
    // For any remaining sorting methods, use the original pagination approach
    // Build orderBy clause (fallback, should rarely be used now)
    let orderBy: any = [
      { displayOrder: 'asc' },
      { rating: 'desc' },
      { createdAt: 'desc' }
    ];
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    console.log(`Fetching whops - page: ${page}, limit: ${limit}, offset: ${offset}, search: "${search}", whopCategory: "${whopCategory}"`);
    
    // Get whops with pagination
    const whops = await prisma.whop.findMany({
      where: whereClause,
      orderBy: orderBy,
      skip: offset,
      take: limit,
      include: { PromoCode: true }
    });
    
    console.log(`Found ${whops.length} whops out of ${totalCount} total`);
    
    // Transform the database data into the format expected by the UI
    let transformedWhops = whops.map(whop => transformWhopDataForUI(whop)).filter(whop => whop !== null); // Remove only null results, keep all valid whops
    
    // Apply promo type filter after transformation (since it depends on promo codes)
    if (promoType) {
      transformedWhops = transformedWhops.filter(whop => 
        whop.promoType === promoType.toLowerCase()
      );
    }
    
    // Apply two-tier sorting for all sorting methods
    if (sortBy === 'newest') {
      transformedWhops.sort((a, b) => {
        const aHasPromo = hasSpecialPromoCode(a.name);
        const bHasPromo = hasSpecialPromoCode(b.name);
        
        // First tier: promo codes vs non-promo codes
        if (aHasPromo !== bHasPromo) {
          return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
        }
        
        // Second tier: within same promo status, sort by creation date (newest first)
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    } else if (sortBy === 'highest-rated') {
      transformedWhops.sort((a, b) => {
        const aHasPromo = hasSpecialPromoCode(a.name);
        const bHasPromo = hasSpecialPromoCode(b.name);
        
        // First tier: promo codes vs non-promo codes
        if (aHasPromo !== bHasPromo) {
          return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
        }
        
        // Second tier: within same promo status, sort by rating (highest first)
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }
        
        // Tertiary: if ratings are equal, sort by creation date
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    } else if (!sortBy || sortBy === '' || sortBy === 'default') {
      // Default sorting: promo codes first, then by display order (fallback - should not be reached now)
      console.log('🚀 Applying default sorting with promo code priority (fallback)');
      
      transformedWhops.sort((a, b) => {
        const aHasPromo = hasSpecialPromoCode(a.name);
        const bHasPromo = hasSpecialPromoCode(b.name);
        
        // First tier: promo codes vs non-promo codes
        if (aHasPromo !== bHasPromo) {
          return bHasPromo ? 1 : -1; // Prioritize whops with promo codes
        }
        
        // Second tier: within same promo status, maintain original order (displayOrder)
        const orderA = a.displayOrder || 0;
        const orderB = b.displayOrder || 0;
        if (orderA !== orderB) {
          return orderA - orderB;
        }
        
        // Tertiary: if display orders are equal, sort by rating then creation date
        const ratingA = a.rating || 0;
        const ratingB = b.rating || 0;
        if (ratingA !== ratingB) {
          return ratingB - ratingA;
        }
        
        const dateA = new Date(a.createdAt || 0).getTime();
        const dateB = new Date(b.createdAt || 0).getTime();
        return dateB - dateA;
      });
    }
    
    // Note: 'newest' and 'highest-rated' are handled by database orderBy clause above
    
    // Debug log the first item
    if (transformedWhops.length > 0) {
      console.log("First transformed whop:", JSON.stringify(transformedWhops[0]).substring(0, 200) + "...");
    } else {
      console.log("No whops found matching the current filters");
    }
    
    // Return paginated response with metadata
    const response = {
      data: transformedWhops,
      pagination: {
        page,
        limit,
        total: totalCount, // Use database count, not transformed count
        totalPages: Math.ceil(totalCount / limit),
        hasMore: page * limit < totalCount
      }
    };
    
    return NextResponse.json(response, { headers });
  } catch (error) {
    console.error("Error in GET /api/whops:", error);
    console.error("Error details:", {
      message: error instanceof Error ? error.message : "Unknown error",
      stack: error instanceof Error ? error.stack : undefined,
      name: error instanceof Error ? error.name : undefined
    });
    return NextResponse.json({ 
      error: "Internal server error", 
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}

export async function POST(request: Request) {
  // First try JWT token authentication
  let isAuthorized = false;
  
  // Check JWT token in cookies
  try {
    const cookieStore = cookies();
    const token = cookieStore.get('admin-token')?.value;
    
    if (token) {
      const decoded = verify(token, JWT_SECRET) as DecodedToken;
      if (decoded.role === "ADMIN") {
        isAuthorized = true;
      }
    }
  } catch (error) {
    console.error("JWT verification error:", error);
  }
  
  // Also try NextAuth session as fallback
  if (!isAuthorized) {
    const session = await getServerSession(authOptions);
    if (session?.user?.role === "ADMIN") {
      isAuthorized = true;
    }
  }

  // Return 401 if not authorized
  if (!isAuthorized) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const data = await request.json();
    console.log("POST /api/whops - Starting whop creation");
    console.log("POST /api/whops - Received data:", JSON.stringify(data, null, 2));
    
    // Validate required fields
    if (!data.name || !data.affiliateLink) {
      return NextResponse.json(
        { error: "Missing required fields: name and affiliateLink" },
        { status: 400 }
      );
    }
    
    // Validate promo code fields if provided
    if (data.promoTitle || data.promoDescription || data.promoType || data.promoValue) {
      if (!data.promoTitle || !data.promoDescription || !data.promoType || !data.promoValue) {
        return NextResponse.json(
          { error: "When creating promo codes, promoTitle, promoDescription, promoType, and promoValue are all required" },
          { status: 400 }
        );
      }
    }
    
    // Find the highest display order value and add 1
    // Only if displayOrder is not explicitly provided
    let displayOrder = data.displayOrder;
    if (displayOrder === undefined) {
      const highestOrderWhop = await prisma.whop.findFirst({
        orderBy: {
          displayOrder: 'desc'
        }
      });
      
      displayOrder = highestOrderWhop ? highestOrderWhop.displayOrder + 1 : 0;
    } else {
      // Make sure provided displayOrder is a number
      displayOrder = typeof displayOrder === 'number' ? 
        displayOrder : (parseInt(displayOrder) || 0);
    }
    
    // Create the new whop using Prisma's create method
    const whop = await prisma.whop.create({
      data: {
        name: data.name,
        slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        logo: data.logo || null,
        description: data.description || null,
        rating: data.rating || 0,
        affiliateLink: data.affiliateLink,
        website: data.website || null,
        price: data.price || null,
        category: data.category || null,
        screenshots: data.screenshots || [],
        displayOrder: displayOrder
      }
    });

    console.log("Created whop:", whop.id, whop.name);
    
    // Create promo code if promo data is provided
    let promoCode = null;
    if (data.promoTitle && data.promoDescription && data.promoType && data.promoValue) {
      try {
        promoCode = await prisma.promoCode.create({
          data: {
            whopId: whop.id,
            code: data.promoCode || null, // Allow null for "NO CODE REQUIRED" cases
            title: data.promoTitle,
            description: data.promoDescription,
            type: data.promoType,
            value: data.promoValue
          }
        });
        console.log("Created promo code:", promoCode.id, promoCode.title);
      } catch (promoError) {
        console.error("Error creating promo code:", promoError);
        // Don't fail the whole operation if promo creation fails
        // The whop was created successfully
      }
    }
    
    // Return the whop with promo code if created
    const response = {
      ...whop,
      promoCode: promoCode
    };
    
    return NextResponse.json(response);
  } catch (error) {
    console.error("Error creating whop:", error);
    return NextResponse.json(
      { error: "Failed to create whop", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
} 