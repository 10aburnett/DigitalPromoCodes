const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function importProductionData() {
  console.log('🔄 Importing production data to development database...');
  
  try {
    // Read the exported data
    const data = JSON.parse(fs.readFileSync('production-data-backup.json', 'utf8'));
    
    console.log('📊 Importing data:');
    
    // Import in correct order (due to foreign key dependencies)
    
    // 1. Users first
    console.log('  👤 Users...');
    for (const user of data.users) {
      await prisma.user.create({
        data: user
      });
    }
    
    // 2. Settings
    console.log('  ⚙️  Settings...');
    for (const setting of data.settings) {
      await prisma.settings.create({
        data: setting
      });
    }
    
    // 3. Whops
    console.log('  🎯 Whops...');
    for (const whop of data.whops) {
      await prisma.whop.create({
        data: whop
      });
    }
    
    // 4. Promo codes
    console.log('  🎫 Promo Codes...');
    for (const promoCode of data.promoCodes) {
      await prisma.promoCode.create({
        data: promoCode
      });
    }
    
    // 5. Blog posts
    console.log('  📝 Blog Posts...');
    for (const blogPost of data.blogPosts) {
      await prisma.blogPost.create({
        data: blogPost
      });
    }
    
    // 6. Comments (without voting data initially)
    console.log('  💬 Comments...');
    for (const comment of data.comments) {
      await prisma.comment.create({
        data: {
          ...comment,
          upvotes: 0,
          downvotes: 0,
          parentId: null // No replies in original data
        }
      });
    }
    
    // 7. Mailing list
    console.log('  📧 Mailing List...');
    for (const subscriber of data.mailingList) {
      await prisma.mailingList.create({
        data: subscriber
      });
    }
    
    // 8. Contact submissions
    console.log('  📞 Contact Submissions...');
    for (const contact of data.contactSubmissions) {
      await prisma.contactSubmission.create({
        data: contact
      });
    }
    
    // 9. Offer tracking
    console.log('  📈 Offer Tracking...');
    for (const tracking of data.offerTracking) {
      await prisma.offerTracking.create({
        data: tracking
      });
    }
    
    console.log('✅ All production data imported successfully!');
    console.log('🛡️  Your live production data is completely safe!');
    console.log('🧪 Ready for voting system development!');
    
  } catch (error) {
    console.error('❌ Import failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

importProductionData();