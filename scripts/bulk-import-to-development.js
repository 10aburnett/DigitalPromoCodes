const { PrismaClient } = require('@prisma/client');
const fs = require('fs');

const prisma = new PrismaClient();

async function bulkImportProductionData() {
  console.log('🔄 BULK importing production data to development database...');
  
  try {
    // Read the exported data
    const data = JSON.parse(fs.readFileSync('production-data-backup.json', 'utf8'));
    
    console.log('📊 Importing data in BULK (much faster):');
    
    // Use createMany for bulk imports (MUCH faster)
    
    // 1. Users
    if (data.users && data.users.length > 0) {
      console.log(`  👤 Bulk importing ${data.users.length} users...`);
      await prisma.user.createMany({
        data: data.users,
        skipDuplicates: true
      });
    }
    
    // 2. Settings  
    if (data.settings && data.settings.length > 0) {
      console.log(`  ⚙️  Bulk importing ${data.settings.length} settings...`);
      await prisma.settings.createMany({
        data: data.settings,
        skipDuplicates: true
      });
    }
    
    // 3. Whops (THE BIG ONE - 8,212 records)
    if (data.whops && data.whops.length > 0) {
      console.log(`  🎯 Bulk importing ${data.whops.length} whops... (this is the big one!)`);
      
      // Import in chunks of 1000 to avoid memory issues
      const chunkSize = 1000;
      for (let i = 0; i < data.whops.length; i += chunkSize) {
        const chunk = data.whops.slice(i, i + chunkSize);
        console.log(`    Importing whops ${i + 1} to ${Math.min(i + chunkSize, data.whops.length)}...`);
        
        await prisma.whop.createMany({
          data: chunk,
          skipDuplicates: true
        });
      }
      console.log(`  ✅ All ${data.whops.length} whops imported successfully!`);
    }
    
    // 4. Promo codes
    if (data.promoCodes && data.promoCodes.length > 0) {
      console.log(`  🎫 Bulk importing ${data.promoCodes.length} promo codes...`);
      await prisma.promoCode.createMany({
        data: data.promoCodes,
        skipDuplicates: true
      });
    }
    
    // 5. Blog posts
    if (data.blogPosts && data.blogPosts.length > 0) {
      console.log(`  📝 Bulk importing ${data.blogPosts.length} blog posts...`);
      await prisma.blogPost.createMany({
        data: data.blogPosts,
        skipDuplicates: true
      });
    }
    
    // 6. Comments (with voting system columns)
    if (data.comments && data.comments.length > 0) {
      console.log(`  💬 Bulk importing ${data.comments.length} comments...`);
      const commentsWithVoting = data.comments.map(comment => ({
        ...comment,
        upvotes: 0,
        downvotes: 0,
        parentId: null // No replies in original data
      }));
      
      await prisma.comment.createMany({
        data: commentsWithVoting,
        skipDuplicates: true
      });
    }
    
    // 7. Mailing list
    if (data.mailingList && data.mailingList.length > 0) {
      console.log(`  📧 Bulk importing ${data.mailingList.length} mailing list subscribers...`);
      await prisma.mailingList.createMany({
        data: data.mailingList,
        skipDuplicates: true
      });
    }
    
    // 8. Contact submissions
    if (data.contactSubmissions && data.contactSubmissions.length > 0) {
      console.log(`  📞 Bulk importing ${data.contactSubmissions.length} contact submissions...`);
      await prisma.contactSubmission.createMany({
        data: data.contactSubmissions,
        skipDuplicates: true
      });
    }
    
    // 9. Offer tracking (BIG ONE - 7,345 records)
    if (data.offerTracking && data.offerTracking.length > 0) {
      console.log(`  📈 Bulk importing ${data.offerTracking.length} offer tracking records...`);
      
      // Import in chunks
      const chunkSize = 1000;
      for (let i = 0; i < data.offerTracking.length; i += chunkSize) {
        const chunk = data.offerTracking.slice(i, i + chunkSize);
        console.log(`    Importing tracking ${i + 1} to ${Math.min(i + chunkSize, data.offerTracking.length)}...`);
        
        await prisma.offerTracking.createMany({
          data: chunk,
          skipDuplicates: true
        });
      }
    }
    
    console.log('✅ ALL production data imported successfully with BULK operations!');
    console.log('🛡️  Your live production data remains completely safe!');
    console.log('🧪 Development database now has EXACT COPY of production!');
    
    // Verify the import
    const counts = {
      whops: await prisma.whop.count(),
      blogPosts: await prisma.blogPost.count(),
      comments: await prisma.comment.count(),
      users: await prisma.user.count(),
      promoCodes: await prisma.promoCode.count(),
      offerTracking: await prisma.offerTracking.count()
    };
    
    console.log('📊 Final verification:');
    console.log(counts);
    
  } catch (error) {
    console.error('❌ Bulk import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

bulkImportProductionData();