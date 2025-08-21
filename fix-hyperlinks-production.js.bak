const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixProductionHyperlinks() {
  try {
    console.log('=== FIXING HYPERLINKS IN PRODUCTION DATABASE ===');
    
    // Get all blog posts
    const posts = await prisma.blogPost.findMany({
      select: { id: true, title: true, content: true }
    });
    
    console.log(`Found ${posts.length} blog posts to check`);
    
    for (const post of posts) {
      console.log(`\nProcessing: "${post.title}"`);
      
      let updatedContent = post.content;
      let hasChanges = false;
      
      // Fix VIP Access links (whop.com/exclusive-vip-access)
      const vipLinkPattern = /https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21(?![)\]])/g;
      if (vipLinkPattern.test(post.content)) {
        updatedContent = updatedContent.replace(
          vipLinkPattern,
          '[https://whop.com/exclusive-vip-access/?a=alexburnett21](https://whop.com/exclusive-vip-access/?a=alexburnett21)'
        );
        console.log('  ✅ Fixed VIP Access link');
        hasChanges = true;
      }
      
      // Fix WHPCodes.com references
      const whpCodesPattern = /(?<![\[\(])(?:https?:\/\/)?(?:www\.)?WHPCodes\.com(?![)\]])/gi;
      if (whpCodesPattern.test(updatedContent)) {
        updatedContent = updatedContent.replace(
          whpCodesPattern,
          '[WHPCodes.com](https://whpcodes.com)'
        );
        console.log('  ✅ Fixed WHPCodes.com reference');
        hasChanges = true;
      }
      
      // Fix plain whpcodes.com references
      const plainWhpPattern = /(?<![\[\(])whpcodes\.com(?![)\]])/gi;
      if (plainWhpPattern.test(updatedContent)) {
        updatedContent = updatedContent.replace(
          plainWhpPattern,
          '[whpcodes.com](https://whpcodes.com)'
        );
        console.log('  ✅ Fixed plain whpcodes.com reference');
        hasChanges = true;
      }
      
      if (hasChanges) {
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { content: updatedContent }
        });
        console.log('  🎯 Updated database successfully');
      } else {
        console.log('  ⚪ No changes needed');
      }
    }
    
    console.log('\n=== HYPERLINK FIXING COMPLETE ===');
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixProductionHyperlinks();