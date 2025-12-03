const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function exportAllData() {
  console.log('🔄 Exporting production data...');
  
  try {
    // Export all tables
    const data = {
      whops: await prisma.deal.findMany(),
      blogPosts: await prisma.blogPost.findMany(),
      comments: await prisma.comment.findMany({
        select: {
          id: true,
          content: true,
          authorName: true,
          authorEmail: true,
          status: true,
          flaggedReason: true,
          createdAt: true,
          updatedAt: true,
          blogPostId: true
        }
      }),
      users: await prisma.user.findMany(),
      mailingList: await prisma.mailingList.findMany(),
      promoCodes: await prisma.promoCode.findMany(),
      reviews: await prisma.review.findMany(),
      settings: await prisma.settings.findMany(),
      legalPages: await prisma.legalPage.findMany(),
      contactSubmissions: await prisma.contactSubmission.findMany(),
      offerTracking: await prisma.offerTracking.findMany(),
    };

    // Write to JSON file
    fs.writeFileSync('production-data-backup.json', JSON.stringify(data, null, 2));
    
    console.log('✅ Production data exported successfully!');
    console.log('📊 Data counts:');
    Object.entries(data).forEach(([table, records]) => {
      console.log(`  ${table}: ${records.length} records`);
    });
    
  } catch (error) {
    console.error('❌ Export failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

exportAllData();