const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function findVipContent() {
  try {
    console.log('=== SEARCHING FOR VIP ACCESS CONTENT ===');
    
    // Check all posts including drafts
    const allPosts = await prisma.blogPost.findMany({
      select: { id: true, title: true, slug: true, content: true, published: true }
    });
    
    console.log(`Searching ${allPosts.length} blog post(s) (including drafts)`);
    
    for (const post of allPosts) {
      console.log(`\n--- ${post.published ? 'PUBLISHED' : 'DRAFT'}: "${post.title}" ---`);
      
      // Check for VIP Access content
      if (post.content.includes('Josh\'s Exclusive VIP Access') || 
          post.content.includes('TL;DR') ||
          post.content.includes('Discord-plus-alerts') ||
          post.content.includes('whop.com/exclusive-vip-access')) {
        console.log('🎯 FOUND VIP ACCESS CONTENT!');
        console.log('Content preview:', post.content.substring(0, 300) + '...');
      }
      
      // Check for WHPCodes references
      if (post.content.toLowerCase().includes('whpcodes.com')) {
        console.log('🎯 FOUND WHPCODES.COM REFERENCE!');
      }
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

findVipContent();