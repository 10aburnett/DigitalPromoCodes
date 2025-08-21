const { PrismaClient } = require('@prisma/client');

// Production database (source)
const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

// Backup database (destination)
const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function syncProductionToBackup() {
  console.log('🔄 SYNCING ALL CHANGES from production to backup...');
  console.log('⚠️  WARNING: This will update your BACKUP development database!');
  console.log('📋 Checking what needs to be synced...\n');

  try {
    // 1. SYNC USERS
    console.log('👤 Syncing Users...');
    const productionUsers = await productionPrisma.user.findMany();
    const backupUsers = await backupPrisma.user.findMany();
    
    const newUsers = productionUsers.filter(pu => 
      !backupUsers.find(bu => bu.id === pu.id)
    );
    
    if (newUsers.length > 0) {
      await backupPrisma.user.createMany({
        data: newUsers,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newUsers.length} new users`);
    } else {
      console.log('  📝 No new users to sync');
    }

    // 2. SYNC WHOPS
    console.log('🎯 Syncing Whops...');
    const productionWhops = await productionPrisma.whop.findMany();
    const backupWhops = await backupPrisma.whop.findMany();
    
    const newWhops = productionWhops.filter(pw => 
      !backupWhops.find(bw => bw.id === pw.id)
    );
    
    if (newWhops.length > 0) {
      await backupPrisma.whop.createMany({
        data: newWhops,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newWhops.length} new whops`);
    } else {
      console.log('  📝 No new whops to sync');
    }
    
    // Update existing whops with changes
    const updatedWhops = productionWhops.filter(pw => {
      const backupWhop = backupWhops.find(bw => bw.id === pw.id);
      return backupWhop && (
        backupWhop.name !== pw.name || 
        backupWhop.description !== pw.description ||
        backupWhop.rating !== pw.rating ||
        backupWhop.price !== pw.price
      );
    });
    
    for (const whop of updatedWhops) {
      await backupPrisma.whop.update({
        where: { id: whop.id },
        data: whop
      });
    }
    
    if (updatedWhops.length > 0) {
      console.log(`  ✅ Updated ${updatedWhops.length} existing whops`);
    }

    // 3. SYNC PROMO CODES
    console.log('🎫 Syncing Promo Codes...');
    const productionPromoCodes = await productionPrisma.promoCode.findMany();
    const backupPromoCodes = await backupPrisma.promoCode.findMany();
    
    const newPromoCodes = productionPromoCodes.filter(ppc => 
      !backupPromoCodes.find(bpc => bpc.id === ppc.id)
    );
    
    if (newPromoCodes.length > 0) {
      await backupPrisma.promoCode.createMany({
        data: newPromoCodes,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newPromoCodes.length} new promo codes`);
    } else {
      console.log('  📝 No new promo codes to sync');
    }

    // 4. SYNC BLOG POSTS
    console.log('📝 Syncing Blog Posts...');
    const productionBlogPosts = await productionPrisma.blogPost.findMany();
    const backupBlogPosts = await backupPrisma.blogPost.findMany();
    
    const newBlogPosts = productionBlogPosts.filter(pbp => 
      !backupBlogPosts.find(bbp => bbp.id === pbp.id)
    );
    
    if (newBlogPosts.length > 0) {
      await backupPrisma.blogPost.createMany({
        data: newBlogPosts,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newBlogPosts.length} new blog posts`);
    } else {
      console.log('  📝 No new blog posts to sync');
    }

    // 5. SYNC COMMENTS (including voting system data)
    console.log('💬 Syncing Comments...');
    const productionComments = await productionPrisma.comment.findMany();
    const backupComments = await backupPrisma.comment.findMany();
    
    const newComments = productionComments.filter(pc => 
      !backupComments.find(bc => bc.id === pc.id)
    );
    
    if (newComments.length > 0) {
      await backupPrisma.comment.createMany({
        data: newComments,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newComments.length} new comments`);
    } else {
      console.log('  📝 No new comments to sync');
    }

    // Update existing comments with vote changes
    const updatedComments = productionComments.filter(pc => {
      const backupComment = backupComments.find(bc => bc.id === pc.id);
      return backupComment && (
        backupComment.upvotes !== pc.upvotes ||
        backupComment.downvotes !== pc.downvotes ||
        backupComment.status !== pc.status
      );
    });

    for (const comment of updatedComments) {
      await backupPrisma.comment.update({
        where: { id: comment.id },
        data: {
          upvotes: comment.upvotes,
          downvotes: comment.downvotes,
          status: comment.status,
          flaggedReason: comment.flaggedReason
        }
      });
    }

    if (updatedComments.length > 0) {
      console.log(`  ✅ Updated ${updatedComments.length} existing comments with vote changes`);
    }

    // 6. SYNC COMMENT VOTES
    console.log('👍 Syncing Comment Votes...');
    const productionVotes = await productionPrisma.commentVote.findMany();
    const backupVotes = await backupPrisma.commentVote.findMany();
    
    const newVotes = productionVotes.filter(pv => 
      !backupVotes.find(bv => bv.id === pv.id)
    );
    
    if (newVotes.length > 0) {
      await backupPrisma.commentVote.createMany({
        data: newVotes,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newVotes.length} new comment votes`);
    } else {
      console.log('  📝 No new comment votes to sync');
    }

    // 7. SYNC MAILING LIST
    console.log('📧 Syncing Mailing List...');
    const productionMailingList = await productionPrisma.mailingList.findMany();
    const backupMailingList = await backupPrisma.mailingList.findMany();
    
    const newSubscribers = productionMailingList.filter(pml => 
      !backupMailingList.find(bml => bml.email === pml.email)
    );
    
    if (newSubscribers.length > 0) {
      await backupPrisma.mailingList.createMany({
        data: newSubscribers,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newSubscribers.length} new mailing list subscribers`);
    } else {
      console.log('  📝 No new mailing list subscribers to sync');
    }

    // 8. SYNC REVIEWS
    console.log('⭐ Syncing Reviews...');
    const productionReviews = await productionPrisma.review.findMany();
    const backupReviews = await backupPrisma.review.findMany();
    
    const newReviews = productionReviews.filter(pr => 
      !backupReviews.find(br => br.id === pr.id)
    );
    
    if (newReviews.length > 0) {
      await backupPrisma.review.createMany({
        data: newReviews,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newReviews.length} new reviews`);
    } else {
      console.log('  📝 No new reviews to sync');
    }

    // 9. SYNC CONTACT SUBMISSIONS
    console.log('📞 Syncing Contact Submissions...');
    const productionContacts = await productionPrisma.contactSubmission.findMany();
    const backupContacts = await backupPrisma.contactSubmission.findMany();
    
    const newContacts = productionContacts.filter(pc => 
      !backupContacts.find(bc => bc.id === pc.id)
    );
    
    if (newContacts.length > 0) {
      await backupPrisma.contactSubmission.createMany({
        data: newContacts,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newContacts.length} new contact submissions`);
    } else {
      console.log('  📝 No new contact submissions to sync');
    }

    // 10. SYNC OFFER TRACKING
    console.log('📈 Syncing Offer Tracking...');
    const productionTracking = await productionPrisma.offerTracking.findMany();
    const backupTracking = await backupPrisma.offerTracking.findMany();
    
    const newTracking = productionTracking.filter(pt => 
      !backupTracking.find(bt => bt.id === pt.id)
    );
    
    if (newTracking.length > 0) {
      await backupPrisma.offerTracking.createMany({
        data: newTracking,
        skipDuplicates: true
      });
      console.log(`  ✅ Added ${newTracking.length} new tracking records`);
    } else {
      console.log('  📝 No new tracking records to sync');
    }

    console.log('\n🎉 SYNC COMPLETED SUCCESSFULLY!');
    console.log('✅ All changes from production database have been synced to backup');
    console.log('🛡️  Your backup development database now has all the latest production data!');

  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  } finally {
    await productionPrisma.$disconnect();
    await backupPrisma.$disconnect();
  }
}

// Safety check
console.log('⚠️  BACKUP DATABASE SYNC');
console.log('This script will update your BACKUP development database with production data.');
console.log('Make sure this is what you want to do.');
console.log('');

syncProductionToBackup();