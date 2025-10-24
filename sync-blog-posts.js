const { PrismaClient } = require('@prisma/client');

async function syncBlogPosts() {
  try {
    console.log('🔄 SYNCING BLOG POSTS FROM PRODUCTION TO BACKUP\n');
    
    // Production Database (source)
    const productionPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
        }
      }
    });
    
    // Backup Database (destination)
    const backupPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://neondb_owner:npg_GL1sjBY8oSOb@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
        }
      }
    });
    
    // Get all blog posts from production
    console.log('📥 Fetching blog posts from production...');
    const productionPosts = await productionPrisma.blogPost.findMany({
      include: {
        author: true
      },
      orderBy: { createdAt: 'asc' }
    });
    
    console.log(`Found ${productionPosts.length} blog posts in production`);
    
    // Get existing posts in backup
    const backupPosts = await backupPrisma.blogPost.findMany({
      select: { slug: true, id: true }
    });
    const backupSlugs = new Set(backupPosts.map(p => p.slug));
    
    console.log(`Found ${backupPosts.length} existing blog posts in backup`);
    
    // Ensure admin user exists in backup
    let adminUser = await backupPrisma.user.findFirst({
      where: { role: 'ADMIN' }
    });
    
    if (!adminUser) {
      console.log('⚠️  No admin user found in backup, creating one...');
      adminUser = await backupPrisma.user.create({
        data: {
          email: 'admin@whpcodes.com',
          name: 'Admin',
          role: 'ADMIN'
        }
      });
    }
    
    console.log(`Using admin user: ${adminUser.email} (${adminUser.id})`);
    
    // Sync posts
    let syncedCount = 0;
    let skippedCount = 0;
    
    for (const post of productionPosts) {
      if (backupSlugs.has(post.slug)) {
        console.log(`⏭️  Skipping "${post.title}" - already exists`);
        skippedCount++;
        continue;
      }
      
      try {
        await backupPrisma.blogPost.create({
          data: {
            title: post.title,
            slug: post.slug,
            content: post.content,
            excerpt: post.excerpt,
            published: post.published,
            publishedAt: post.publishedAt,
            createdAt: post.createdAt,
            updatedAt: post.updatedAt,
            authorId: adminUser.id, // Use backup admin user
            pinned: post.pinned || false
          }
        });
        
        console.log(`✅ Synced: "${post.title}"`);
        syncedCount++;
        
      } catch (error) {
        console.log(`❌ Failed to sync "${post.title}": ${error.message}`);
      }
    }
    
    console.log('\n📊 SYNC SUMMARY:');
    console.log(`   ✅ Synced: ${syncedCount} posts`);
    console.log(`   ⏭️  Skipped: ${skippedCount} posts (already existed)`);
    console.log(`   ❌ Failed: ${productionPosts.length - syncedCount - skippedCount} posts`);
    
    // Final verification
    const finalBackupCount = await backupPrisma.blogPost.count();
    const finalProductionCount = await productionPrisma.blogPost.count();
    
    console.log('\n🎯 FINAL VERIFICATION:');
    console.log(`   Production: ${finalProductionCount} posts`);
    console.log(`   Backup: ${finalBackupCount} posts`);
    
    if (finalBackupCount === finalProductionCount) {
      console.log('   ✅ Blog posts are now synchronized!');
    } else {
      console.log('   ⚠️  Counts still don\'t match - manual review needed');
    }
    
    await productionPrisma.$disconnect();
    await backupPrisma.$disconnect();
    
  } catch (error) {
    console.error('Sync error:', error);
  }
}

syncBlogPosts();