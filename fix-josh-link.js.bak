const { PrismaClient } = require('@prisma/client');

async function fixJoshLink() {
  try {
    console.log('=== FIXING JOSH VIP ACCESS LINK ===');
    
    const prisma = new PrismaClient({
      datasources: {
        db: {
          url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
        }
      }
    });
    
    // Find the Stocks with Josh post
    const post = await prisma.blogPost.findFirst({
      where: {
        title: { contains: 'Stocks With Josh' }
      },
      select: { id: true, title: true, content: true }
    });
    
    if (!post) {
      console.log('❌ Josh post not found');
      return;
    }
    
    console.log(`Found post: "${post.title}"`);
    
    // Replace the wrong link with the correct one
    const updatedContent = post.content.replace(
      /\[https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21\]\(https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21\)/g,
      '[https://whpcodes.com/whop/josh-exclusive-vip-access](https://whpcodes.com/whop/josh-exclusive-vip-access)'
    );
    
    if (updatedContent !== post.content) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { content: updatedContent }
      });
      console.log('✅ Fixed Josh VIP Access link to point to WHPCodes page');
    } else {
      console.log('⚠️  No changes needed - link already correct or not found');
    }
    
    await prisma.$disconnect();
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixJoshLink();