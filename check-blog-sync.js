const { PrismaClient } = require('@prisma/client');

async function checkBlogSync() {
  try {
    console.log('=== CHECKING BLOG POSTS SYNC ===\n');
    
    // Check Production Database (noisy hat)
    console.log('🔍 PRODUCTION DATABASE (noisy hat):');
    const productionPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
        }
      }
    });
    
    const productionPosts = await productionPrisma.blogPost.findMany({
      select: { id: true, title: true, slug: true, published: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Total: ${productionPosts.length} blog posts`);
    productionPosts.forEach((post, index) => {
      console.log(`   ${index + 1}. "${post.title}" (${post.published ? 'Published' : 'Draft'})`);
    });
    
    await productionPrisma.$disconnect();
    
    // Check Backup Database (rough rain)
    console.log('\n🔍 BACKUP DATABASE (rough rain):');
    const backupPrisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://neondb_owner:npg_GL1sjBY8oSOb@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require"
        }
      }
    });
    
    const backupPosts = await backupPrisma.blogPost.findMany({
      select: { id: true, title: true, slug: true, published: true, createdAt: true },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`   Total: ${backupPosts.length} blog posts`);
    backupPosts.forEach((post, index) => {
      console.log(`   ${index + 1}. "${post.title}" (${post.published ? 'Published' : 'Draft'})`);
    });
    
    await backupPrisma.$disconnect();
    
    // Compare
    console.log('\n📊 COMPARISON:');
    console.log(`   Production: ${productionPosts.length} posts`);
    console.log(`   Backup: ${backupPosts.length} posts`);
    
    if (productionPosts.length === backupPosts.length) {
      console.log('   ✅ Blog post counts match!');
    } else {
      console.log('   ❌ Blog post counts DO NOT match!');
      console.log('   🔄 Blog posts need to be synchronized');
    }
    
  } catch (error) {
    console.error('Error:', error);
  }
}

checkBlogSync();