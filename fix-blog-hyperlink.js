const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function fixBlogHyperlink() {
  try {
    console.log('=== FIXING BLOG POST HYPERLINKS ===');
    
    // Find all blog posts to check for hyperlink issues
    const allBlogPosts = await prisma.blogPost.findMany({
      select: { id: true, title: true, content: true }
    });
    
    console.log(`Checking ${allBlogPosts.length} blog post(s) for hyperlink fixes`);
    
    for (const post of allBlogPosts) {
      console.log(`\nChecking post: "${post.title}" (ID: ${post.id})`);
      
      let updatedContent = post.content;
      let hasChanges = false;
      
      // Fix VIP Access link
      const vipLinkRegex = /https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21(?!\])/g;
      if (vipLinkRegex.test(post.content)) {
        updatedContent = updatedContent.replace(
          vipLinkRegex,
          '[https://whop.com/exclusive-vip-access/?a=alexburnett21](https://whop.com/exclusive-vip-access/?a=alexburnett21)'
        );
        console.log('  ✓ Fixed VIP Access hyperlink');
        hasChanges = true;
      }
      
      // Fix WHPCodes.com links (both with and without www)
      const whpCodesRegex = /(?:https?:\/\/)?(?:www\.)?WHPCodes\.com(?!\])/g;
      if (whpCodesRegex.test(post.content)) {
        updatedContent = updatedContent.replace(
          whpCodesRegex,
          '[WHPCodes.com](https://whpcodes.com)'
        );
        console.log('  ✓ Fixed WHPCodes.com hyperlink');
        hasChanges = true;
      }
      
      // Also fix plain "whpcodes.com" references
      const whpCodesPlainRegex = /\bwhpcodes\.com(?!\])/gi;
      if (whpCodesPlainRegex.test(updatedContent)) {
        updatedContent = updatedContent.replace(
          whpCodesPlainRegex,
          '[whpcodes.com](https://whpcodes.com)'
        );
        console.log('  ✓ Fixed plain whpcodes.com references');
        hasChanges = true;
      }
      
      if (hasChanges) {
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { content: updatedContent }
        });
        console.log('  ✅ Updated hyperlinks successfully');
      } else {
        console.log('  ⚠️ No hyperlink changes needed');
      }
    }
    
  } catch (error) {
    console.error('Error fixing blog hyperlink:', error);
  } finally {
    await prisma.$disconnect();
  }
}

fixBlogHyperlink();