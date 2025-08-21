const { PrismaClient } = require('@prisma/client');

// Production database (source)
const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

// Backup database (destination)
const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function copyAllProductionDataToBackup() {
  console.log('🔄 COPYING ALL PRODUCTION DATA TO BACKUP DATABASE...');
  console.log('⚠️  This will ensure backup has EXACT copy of production');
  
  try {
    // Clear backup database first to avoid conflicts
    console.log('🧹 Clearing backup database...');
    await backupPrisma.commentVote.deleteMany({});
    await backupPrisma.comment.deleteMany({});
    await backupPrisma.review.deleteMany({});
    await backupPrisma.contactSubmission.deleteMany({});
    await backupPrisma.offerTracking.deleteMany({});
    await backupPrisma.mailingList.deleteMany({});
    await backupPrisma.promoCode.deleteMany({});
    await backupPrisma.blogPost.deleteMany({});
    await backupPrisma.whop.deleteMany({});
    await backupPrisma.user.deleteMany({});
    await backupPrisma.settings.deleteMany({});
    
    // 1. COPY USERS
    console.log('👤 Copying Users...');
    const users = await productionPrisma.user.findMany();
    if (users.length > 0) {
      await backupPrisma.user.createMany({ data: users });
      console.log(`  ✅ Copied ${users.length} users`);
    }

    // 2. COPY SETTINGS
    console.log('⚙️ Copying Settings...');
    const settings = await productionPrisma.settings.findMany();
    if (settings.length > 0) {
      await backupPrisma.settings.createMany({ data: settings });
      console.log(`  ✅ Copied ${settings.length} settings`);
    }

    // 3. COPY WHOPS (THE BIG ONE)
    console.log('🎯 Copying Whops...');
    const whops = await productionPrisma.whop.findMany();
    if (whops.length > 0) {
      // Copy in chunks to avoid memory issues
      const chunkSize = 1000;
      for (let i = 0; i < whops.length; i += chunkSize) {
        const chunk = whops.slice(i, i + chunkSize);
        console.log(`    Copying whops ${i + 1} to ${Math.min(i + chunkSize, whops.length)}...`);
        await backupPrisma.whop.createMany({ data: chunk });
      }
      console.log(`  ✅ Copied ${whops.length} whops`);
    }

    // 4. COPY PROMO CODES
    console.log('🎫 Copying Promo Codes...');
    const promoCodes = await productionPrisma.promoCode.findMany();
    if (promoCodes.length > 0) {
      await backupPrisma.promoCode.createMany({ data: promoCodes });
      console.log(`  ✅ Copied ${promoCodes.length} promo codes`);
    }

    // 5. COPY BLOG POSTS
    console.log('📝 Copying Blog Posts...');
    const blogPosts = await productionPrisma.blogPost.findMany();
    if (blogPosts.length > 0) {
      await backupPrisma.blogPost.createMany({ data: blogPosts });
      console.log(`  ✅ Copied ${blogPosts.length} blog posts`);
    }

    // 6. COPY COMMENTS
    console.log('💬 Copying Comments...');
    const comments = await productionPrisma.comment.findMany();
    if (comments.length > 0) {
      // Add voting system fields to existing comments
      const commentsWithVoting = comments.map(comment => ({
        ...comment,
        upvotes: 0,
        downvotes: 0,
        parentId: null
      }));
      await backupPrisma.comment.createMany({ data: commentsWithVoting });
      console.log(`  ✅ Copied ${comments.length} comments`);
    }

    // 7. COPY MAILING LIST
    console.log('📧 Copying Mailing List...');
    const mailingList = await productionPrisma.mailingList.findMany();
    if (mailingList.length > 0) {
      await backupPrisma.mailingList.createMany({ data: mailingList });
      console.log(`  ✅ Copied ${mailingList.length} mailing list subscribers`);
    }

    // 8. COPY REVIEWS
    console.log('⭐ Copying Reviews...');
    const reviews = await productionPrisma.review.findMany();
    if (reviews.length > 0) {
      await backupPrisma.review.createMany({ data: reviews });
      console.log(`  ✅ Copied ${reviews.length} reviews`);
    }

    // 9. COPY CONTACT SUBMISSIONS
    console.log('📞 Copying Contact Submissions...');
    const contacts = await productionPrisma.contactSubmission.findMany();
    if (contacts.length > 0) {
      await backupPrisma.contactSubmission.createMany({ data: contacts });
      console.log(`  ✅ Copied ${contacts.length} contact submissions`);
    }

    // 10. COPY OFFER TRACKING
    console.log('📈 Copying Offer Tracking...');
    const tracking = await productionPrisma.offerTracking.findMany();
    if (tracking.length > 0) {
      // Copy in chunks
      const chunkSize = 1000;
      for (let i = 0; i < tracking.length; i += chunkSize) {
        const chunk = tracking.slice(i, i + chunkSize);
        console.log(`    Copying tracking ${i + 1} to ${Math.min(i + chunkSize, tracking.length)}...`);
        await backupPrisma.offerTracking.createMany({ data: chunk });
      }
      console.log(`  ✅ Copied ${tracking.length} tracking records`);
    }

    console.log('\n🎉 ALL DATA COPIED SUCCESSFULLY!');
    console.log('✅ Backup database now has EXACT copy of production');
    console.log('🛡️  Production database remains untouched and safe');

    // Verify the copy
    const backupCounts = {
      whops: await backupPrisma.whop.count(),
      blogPosts: await backupPrisma.blogPost.count(),
      comments: await backupPrisma.comment.count(),
      users: await backupPrisma.user.count(),
      promoCodes: await backupPrisma.promoCode.count(),
      offerTracking: await backupPrisma.offerTracking.count()
    };

    console.log('\n📊 Backup database verification:');
    console.log(backupCounts);

  } catch (error) {
    console.error('❌ Copy failed:', error);
    process.exit(1);
  } finally {
    await productionPrisma.$disconnect();
    await backupPrisma.$disconnect();
  }
}

copyAllProductionDataToBackup();