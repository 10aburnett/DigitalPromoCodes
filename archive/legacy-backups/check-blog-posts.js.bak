const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkBlogPosts() {
  try {
    console.log('=== CHECKING ALL BLOG POSTS ===');
    
    const allPosts = await prisma.blogPost.findMany({
      select: { id: true, title: true, slug: true, content: true }
    });
    
    console.log(`Found ${allPosts.length} blog post(s)`);
    
    for (const post of allPosts) {
      console.log(`\n--- Post: "${post.title}" (${post.slug}) ---`);
      console.log('Content preview:', post.content.substring(0, 200) + '...');
      
      if (post.content.includes('whop.com/exclusive-vip-access')) {
        console.log('🔍 Contains VIP Access link');
      }
      if (post.content.toLowerCase().includes('whpcodes.com')) {
        console.log('🔍 Contains WHPCodes.com reference');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBlogPosts();