const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkEmptyCategories() {
  try {
    console.log('🔍 Checking for empty categories...\n');
    
    // Get all categories from the enum (updated list without empty categories)
    const allCategories = [
      'PERSONAL_DEVELOPMENT',
      'SOCIAL_MEDIA',
      'LANGUAGES',
      'CAREERS',
      'GAMING',
      'AI',
      'TRADING',
      'RECREATION',
      'FITNESS',
      'REAL_ESTATE',
      'TRAVEL',
      'SPORTS_BETTING',
      'ECOMMERCE',
      'BUSINESS',
      'RESELLING',
      'DATING',
      'COMPUTER_SCIENCE',
      'PERSONAL_FINANCE',
      'OTHER'
    ];
    
    // Get count of whops per category
    const categoryStats = {};
    const emptyCategories = [];
    
    for (const category of allCategories) {
      const count = await prisma.whop.count({
        where: { whopCategory: category }
      });
      
      categoryStats[category] = count;
      
      if (count === 0) {
        emptyCategories.push(category);
      }
    }
    
    console.log('📊 CATEGORY USAGE:');
    const sortedCategories = Object.entries(categoryStats).sort((a, b) => b[1] - a[1]);
    sortedCategories.forEach(([category, count]) => {
      const displayName = category.replace(/_/g, ' ');
      const status = count === 0 ? '❌ EMPTY' : '✅';
      console.log(`  ${status} ${displayName}: ${count} whops`);
    });
    
    console.log('\n🗑️  EMPTY CATEGORIES TO REMOVE:');
    if (emptyCategories.length > 0) {
      emptyCategories.forEach(category => {
        console.log(`  - ${category.replace(/_/g, ' ')}`);
      });
    } else {
      console.log('  No empty categories found.');
    }
    
    console.log('\n📋 SUMMARY:');
    console.log(`Total categories: ${allCategories.length}`);
    console.log(`Categories with content: ${allCategories.length - emptyCategories.length}`);
    console.log(`Empty categories: ${emptyCategories.length}`);
    
    if (emptyCategories.length > 0) {
      console.log('\n💡 These empty categories should be removed to avoid SEO issues with empty pages.');
    }
    
  } catch (error) {
    console.error('❌ Error checking categories:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkEmptyCategories();