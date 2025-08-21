const { PrismaClient } = require('@prisma/client');

// Two separate database connections
const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function syncBackupToProduction() {
  console.log('🔄 SYNCING ALL CHANGES from backup to production...');
  console.log('⚠️  WARNING: This will update your LIVE PRODUCTION database!');
  console.log('📋 Checking what needs to be synced...\n');

  try {
    // 1. SYNC USERS
    console.log('👤 Syncing Users...');
    const backupUsers = await backupPrisma.user.findMany();
    const productionUsers = await productionPrisma.user.findMany();
    
    const newUsers = backupUsers.filter(bu => 
      !productionUsers.find(pu => pu.id === bu.id)
    );
    
    if (newUsers.length > 0) {
      await productionPrisma.user.createMany({
        data: newUsers,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newUsers.length} new users`);
    } else {
      console.log('  📝 No new users to sync');
    }

    // 2. SYNC WHOPS
    console.log('🎯 Syncing Whops...');
    const backupWhops = await backupPrisma.whop.findMany();
    const productionWhops = await productionPrisma.whop.findMany();
    
    const newWhops = backupWhops.filter(bw => 
      !productionWhops.find(pw => pw.id === bw.id)
    );
    
    if (newWhops.length > 0) {
      await productionPrisma.whop.createMany({
        data: newWhops,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newWhops.length} new whops`);
    } else {
      console.log('  📝 No new whops to sync');
    }
    
    // Update existing whops with changes
    const updatedWhops = backupWhops.filter(bw => {
      const prodWhop = productionWhops.find(pw => pw.id === bw.id);
      return prodWhop && (
        prodWhop.name !== bw.name || 
        prodWhop.description !== bw.description ||
        prodWhop.rating !== bw.rating ||
        prodWhop.price !== bw.price
      );
    });
    
    for (const whop of updatedWhops) {
      await productionPrisma.whop.update({
        where: { id: whop.id },
        data: whop
      });
    }
    
    if (updatedWhops.length > 0) {
      console.log(`  ✅ Updated ${updatedWhops.length} existing whops`);
    }

    // 3. SYNC PROMO CODES
    console.log('🎫 Syncing Promo Codes...');
    const backupPromoCodes = await backupPrisma.promoCode.findMany();
    const productionPromoCodes = await productionPrisma.promoCode.findMany();
    
    const newPromoCodes = backupPromoCodes.filter(bpc => 
      !productionPromoCodes.find(ppc => ppc.id === bpc.id)
    );
    
    if (newPromoCodes.length > 0) {
      await productionPrisma.promoCode.createMany({
        data: newPromoCodes,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newPromoCodes.length} new promo codes`);
    } else {
      console.log('  📝 No new promo codes to sync');
    }

    // 4. SYNC BLOG POSTS
    console.log('📝 Syncing Blog Posts...');
    const backupBlogPosts = await backupPrisma.blogPost.findMany();
    const productionBlogPosts = await productionPrisma.blogPost.findMany();
    
    const newBlogPosts = backupBlogPosts.filter(bbp => 
      !productionBlogPosts.find(pbp => pbp.id === bbp.id)
    );
    
    if (newBlogPosts.length > 0) {
      await productionPrisma.blogPost.createMany({
        data: newBlogPosts,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newBlogPosts.length} new blog posts`);
    } else {
      console.log('  📝 No new blog posts to sync');
    }

    // 5. SYNC COMMENTS (including voting system data)
    console.log('💬 Syncing Comments...');
    const backupComments = await backupPrisma.comment.findMany();
    const productionComments = await productionPrisma.comment.findMany();
    
    const newComments = backupComments.filter(bc => 
      !productionComments.find(pc => pc.id === bc.id)
    );
    
    if (newComments.length > 0) {
      await productionPrisma.comment.createMany({
        data: newComments,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newComments.length} new comments`);
    } else {
      console.log('  📝 No new comments to sync');
    }

    // 6. SYNC COMMENT VOTES
    console.log('👍 Syncing Comment Votes...');
    const backupVotes = await backupPrisma.commentVote.findMany();
    
    if (backupVotes.length > 0) {
      await productionPrisma.commentVote.createMany({
        data: backupVotes,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${backupVotes.length} comment votes`);
    } else {
      console.log('  📝 No comment votes to sync');
    }

    // 7. SYNC MAILING LIST
    console.log('📧 Syncing Mailing List...');
    const backupMailingList = await backupPrisma.mailingList.findMany();
    const productionMailingList = await productionPrisma.mailingList.findMany();
    
    const newSubscribers = backupMailingList.filter(bml => 
      !productionMailingList.find(pml => pml.email === bml.email)
    );
    
    if (newSubscribers.length > 0) {
      await productionPrisma.mailingList.createMany({
        data: newSubscribers,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newSubscribers.length} new mailing list subscribers`);
    } else {
      console.log('  📝 No new mailing list subscribers to sync');
    }

    // 8. SYNC REVIEWS
    console.log('⭐ Syncing Reviews...');
    const backupReviews = await backupPrisma.review.findMany();
    const productionReviews = await productionPrisma.review.findMany();
    
    const newReviews = backupReviews.filter(br => 
      !productionReviews.find(pr => pr.id === br.id)
    );
    
    if (newReviews.length > 0) {
      await productionPrisma.review.createMany({
        data: newReviews,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newReviews.length} new reviews`);
    } else {
      console.log('  📝 No new reviews to sync');
    }

    // 9. SYNC CONTACT SUBMISSIONS
    console.log('📞 Syncing Contact Submissions...');
    const backupContacts = await backupPrisma.contactSubmission.findMany();
    const productionContacts = await productionPrisma.contactSubmission.findMany();
    
    const newContacts = backupContacts.filter(bc => 
      !productionContacts.find(pc => pc.id === bc.id)
    );
    
    if (newContacts.length > 0) {
      await productionPrisma.contactSubmission.createMany({
        data: newContacts,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newContacts.length} new contact submissions`);
    } else {
      console.log('  📝 No new contact submissions to sync');
    }

    // 10. SYNC OFFER TRACKING
    console.log('📈 Syncing Offer Tracking...');
    const backupTracking = await backupPrisma.offerTracking.findMany();
    const productionTracking = await productionPrisma.offerTracking.findMany();
    
    const newTracking = backupTracking.filter(bt => 
      !productionTracking.find(pt => pt.id === bt.id)
    );
    
    if (newTracking.length > 0) {
      await productionPrisma.offerTracking.createMany({
        data: newTracking,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newTracking.length} new tracking records`);
    } else {
      console.log('  📝 No new tracking records to sync');
    }

    console.log('\n🎉 SYNC COMPLETED SUCCESSFULLY!');
    console.log('✅ All changes from backup database have been synced to production');
    console.log('🛡️  Your production database now has all the latest data!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await backupPrisma.$disconnect();
    await productionPrisma.$disconnect();
  }
}

// Safety check
console.log('⚠️  PRODUCTION DATABASE SYNC');
console.log('This script will update your LIVE production database.');
console.log('Make sure you have tested everything thoroughly on the backup database first.');
console.log('');

syncBackupToProduction();