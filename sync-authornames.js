/**
 * Sync authorName values from backup to production database
 */

const { PrismaClient } = require('@prisma/client');

// Database connections (using the exact URLs from golden script)
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
    }
  }
});

async function syncAuthorNames() {
  console.log('🔄 SYNCING AUTHOR NAMES FROM BACKUP TO PRODUCTION');
  console.log('=================================================');
  
  try {
    // Get all posts from backup with their authorName values
    console.log('📖 Reading posts from BACKUP database...');
    const backupPosts = await backupDb.blogPost.findMany({
      select: { id: true, slug: true, title: true, authorName: true }
    });
    
    console.log(`Found ${backupPosts.length} posts in backup`);
    
    // Get all posts from production
    console.log('📖 Reading posts from PRODUCTION database...');
    const productionPosts = await productionDb.blogPost.findMany({
      select: { id: true, slug: true, title: true, authorName: true }
    });
    
    console.log(`Found ${productionPosts.length} posts in production`);
    
    console.log('\n🔄 Starting author name sync...');
    let updated = 0;
    let skipped = 0;
    
    for (const backupPost of backupPosts) {
      const prodPost = productionPosts.find(p => p.slug === backupPost.slug);
      
      if (!prodPost) {
        console.log(`⚠️  No matching post found for slug: ${backupPost.slug}`);
        skipped++;
        continue;
      }
      
      if (backupPost.authorName && backupPost.authorName !== prodPost.authorName) {
        console.log(`🔄 Updating "${backupPost.title}"`);
        console.log(`   From: "${prodPost.authorName || 'NULL'}" → To: "${backupPost.authorName}"`);
        
        await productionDb.blogPost.update({
          where: { slug: backupPost.slug },
          data: { authorName: backupPost.authorName }
        });
        
        updated++;
      } else if (!backupPost.authorName) {
        console.log(`⏭️  Skipping "${backupPost.title}" - no authorName in backup`);
        skipped++;
      } else if (backupPost.authorName === prodPost.authorName) {
        console.log(`✅ "${backupPost.title}" - already has correct authorName`);
        skipped++;
      }
    }
    
    console.log('\n📊 SYNC RESULTS:');
    console.log(`   Updated: ${updated} posts`);
    console.log(`   Skipped: ${skipped} posts`);
    console.log(`   Total: ${backupPosts.length} posts`);
    
    if (updated > 0) {
      console.log('\n✅ Verifying updates...');
      const verifyPosts = await productionDb.blogPost.findMany({
        select: { slug: true, title: true, authorName: true }
      });
      
      console.log('\n📋 FINAL PRODUCTION AUTHOR NAMES:');
      for (const post of verifyPosts) {
        console.log(`   "${post.title}" → Author: "${post.authorName || 'NULL'}"`);
      }
    }
    
    console.log('\n🎉 AUTHOR NAME SYNC COMPLETED SUCCESSFULLY!');
    
  } catch (error) {
    console.error('❌ Error syncing author names:', error);
    throw error;
  } finally {
    await backupDb.$disconnect();
    await productionDb.$disconnect();
  }
}

syncAuthorNames().catch(console.error);