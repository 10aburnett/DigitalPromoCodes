import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// The new categories as specified by the user
const NEW_CATEGORIES = [
  'Personal Development',
  'Social Media', 
  'Languages',
  'Careers',
  'Gaming',
  'AI',
  'Trading',
  'Recreation',
  'Fitness',
  'Agencies',
  'Spirituality',
  'Real Estate',
  'Travel',
  'Game Show',
  'Sports Betting',
  'E-commerce',
  'Business',
  'Reselling',
  'Podcasts',
  'Dating',
  'Computer Science',
  'Newsletters',
  'Personal Finance',
  'Other'
];

async function analyzeWhopCategories() {
  try {
    console.log('🔍 Analyzing existing whops to understand categorization needs...\n');
    
    // Get all whops with their names and descriptions
    const whops = await prisma.deal.findMany({
      select: {
        id: true,
        name: true,
        description: true,
        category: true // existing category if any
      },
      take: 100 // Sample for analysis
    });
    
    console.log(`Analyzing ${whops.length} whops...\n`);
    
    // Analyze content to suggest categories
    const categorySuggestions: Record<string, Array<{name: string, description: string | null, reason: string}>> = {};
    
    // Initialize category buckets
    NEW_CATEGORIES.forEach(cat => {
      categorySuggestions[cat] = [];
    });
    
    whops.forEach(whop => {
      const name = whop.name.toLowerCase();
      const desc = (whop.description || '').toLowerCase();
      const content = `${name} ${desc}`;
      
      let assigned = false;
      
      // Trading & Finance
      if (content.match(/trading|forex|crypto|bitcoin|stocks|futures|options|investment|finance|money|profit|signals|market|chart|technical analysis|fundamental|scalping/)) {
        if (content.match(/personal finance|budgeting|savings|debt|credit|financial planning/)) {
          categorySuggestions['Personal Finance'].push({name: whop.name, description: whop.description, reason: 'Contains personal finance keywords'});
        } else {
          categorySuggestions['Trading'].push({name: whop.name, description: whop.description, reason: 'Contains trading/investment keywords'});
        }
        assigned = true;
      }
      
      // AI & Tech
      else if (content.match(/ai|artificial intelligence|machine learning|automation|bot|algorithm|tech|software|coding|programming|development|computer|digital/)) {
        if (content.match(/computer science|programming|coding|development|software engineering/)) {
          categorySuggestions['Computer Science'].push({name: whop.name, description: whop.description, reason: 'Contains computer science keywords'});
        } else {
          categorySuggestions['AI'].push({name: whop.name, description: whop.description, reason: 'Contains AI/tech keywords'});
        }
        assigned = true;
      }
      
      // Social Media
      else if (content.match(/social media|instagram|tiktok|youtube|twitter|facebook|influencer|content creator|viral|followers|engagement|posting|social|media/)) {
        categorySuggestions['Social Media'].push({name: whop.name, description: whop.description, reason: 'Contains social media keywords'});
        assigned = true;
      }
      
      // E-commerce & Business
      else if (content.match(/ecommerce|e-commerce|dropshipping|shopify|amazon|fba|business|entrepreneur|startup|marketing|sales|revenue|profit/)) {
        if (content.match(/reselling|flipping|arbitrage|buy.*(sell|resell)/)) {
          categorySuggestions['Reselling'].push({name: whop.name, description: whop.description, reason: 'Contains reselling keywords'});
        } else {
          categorySuggestions['E-commerce'].push({name: whop.name, description: whop.description, reason: 'Contains e-commerce/business keywords'});
        }
        assigned = true;
      }
      
      // Gaming
      else if (content.match(/gaming|game|esports|streaming|twitch|discord|minecraft|fortnite|console|pc gaming|mobile games/)) {
        categorySuggestions['Gaming'].push({name: whop.name, description: whop.description, reason: 'Contains gaming keywords'});
        assigned = true;
      }
      
      // Sports Betting
      else if (content.match(/sports betting|betting|picks|odds|sportsbook|wager|bet|parlay|moneyline|spread|props/)) {
        categorySuggestions['Sports Betting'].push({name: whop.name, description: whop.description, reason: 'Contains sports betting keywords'});
        assigned = true;
      }
      
      // Fitness & Health
      else if (content.match(/fitness|workout|gym|health|nutrition|diet|exercise|training|muscle|weight loss|bodybuilding/)) {
        categorySuggestions['Fitness'].push({name: whop.name, description: whop.description, reason: 'Contains fitness keywords'});
        assigned = true;
      }
      
      // Personal Development
      else if (content.match(/personal development|self help|motivation|mindset|productivity|goals|success|leadership|confidence|growth/)) {
        categorySuggestions['Personal Development'].push({name: whop.name, description: whop.description, reason: 'Contains personal development keywords'});
        assigned = true;
      }
      
      // Real Estate
      else if (content.match(/real estate|property|rental|landlord|investing|houses|apartments|commercial|residential/)) {
        categorySuggestions['Real Estate'].push({name: whop.name, description: whop.description, reason: 'Contains real estate keywords'});
        assigned = true;
      }
      
      // Dating
      else if (content.match(/dating|relationship|romance|love|match|tinder|bumble|pickup|flirting/)) {
        categorySuggestions['Dating'].push({name: whop.name, description: whop.description, reason: 'Contains dating keywords'});
        assigned = true;
      }
      
      // Agencies & Services
      else if (content.match(/agency|service|client|freelance|consulting|marketing agency|digital agency/)) {
        categorySuggestions['Agencies'].push({name: whop.name, description: whop.description, reason: 'Contains agency/service keywords'});
        assigned = true;
      }
      
      // Travel
      else if (content.match(/travel|vacation|trip|flight|hotel|tourism|destination|adventure/)) {
        categorySuggestions['Travel'].push({name: whop.name, description: whop.description, reason: 'Contains travel keywords'});
        assigned = true;
      }
      
      // Languages
      else if (content.match(/language|learn.*language|spanish|french|english|german|chinese|japanese|translation/)) {
        categorySuggestions['Languages'].push({name: whop.name, description: whop.description, reason: 'Contains language learning keywords'});
        assigned = true;
      }
      
      // Podcasts
      else if (content.match(/podcast|audio|interview|talk show|radio|broadcasting/)) {
        categorySuggestions['Podcasts'].push({name: whop.name, description: whop.description, reason: 'Contains podcast keywords'});
        assigned = true;
      }
      
      // Newsletters
      else if (content.match(/newsletter|email|subscribe|updates|digest|news/)) {
        categorySuggestions['Newsletters'].push({name: whop.name, description: whop.description, reason: 'Contains newsletter keywords'});
        assigned = true;
      }
      
      // Spirituality
      else if (content.match(/spiritual|meditation|mindfulness|chakra|energy|healing|wellness|consciousness/)) {
        categorySuggestions['Spirituality'].push({name: whop.name, description: whop.description, reason: 'Contains spirituality keywords'});
        assigned = true;
      }
      
      // Recreation
      else if (content.match(/recreation|hobby|fun|entertainment|leisure|activity|creative/)) {
        categorySuggestions['Recreation'].push({name: whop.name, description: whop.description, reason: 'Contains recreation keywords'});
        assigned = true;
      }
      
      // Careers
      else if (content.match(/career|job|resume|interview|professional|work|employment|skills/)) {
        categorySuggestions['Careers'].push({name: whop.name, description: whop.description, reason: 'Contains career keywords'});
        assigned = true;
      }
      
      // If nothing matches, put in Other
      if (!assigned) {
        categorySuggestions['Other'].push({name: whop.name, description: whop.description, reason: 'No clear category match'});
      }
    });
    
    // Display results
    console.log('📋 CATEGORY ANALYSIS RESULTS:\n');
    
    NEW_CATEGORIES.forEach(category => {
      const items = categorySuggestions[category];
      if (items.length > 0) {
        console.log(`\n${category.toUpperCase()} (${items.length} items):`);
        items.slice(0, 5).forEach(item => {
          console.log(`  • ${item.name}`);
          if (item.description) {
            console.log(`    Description: ${item.description.substring(0, 100)}...`);
          }
          console.log(`    Reason: ${item.reason}\n`);
        });
        if (items.length > 5) {
          console.log(`  ... and ${items.length - 5} more\n`);
        }
      }
    });
    
    // Summary
    const totalCategorized = Object.values(categorySuggestions).reduce((sum, items) => sum + items.length, 0);
    console.log(`\n📊 SUMMARY:`);
    console.log(`Total whops analyzed: ${whops.length}`);
    console.log(`Total categorized: ${totalCategorized}`);
    console.log(`Categories with content: ${NEW_CATEGORIES.filter(cat => categorySuggestions[cat].length > 0).length}`);
    
  } catch (error) {
    console.error('❌ Error analyzing whop categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

analyzeWhopCategories(); 