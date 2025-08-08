const { PrismaClient } = require('@prisma/client');

async function fixJoshLinkBothDatabases() {
  try {
    console.log('=== FIXING JOSH VIP ACCESS LINK IN BOTH DATABASES ===');
    
    const databases = [
      {
        name: 'PRODUCTION',
        url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
      },
      {
        name: 'BACKUP',
        url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
      }
    ];
    
    for (const db of databases) {
      console.log(`\n🔹 Processing ${db.name} database...`);
      
      const prisma = new PrismaClient({
        datasources: {
          db: { url: db.url }
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
        console.log(`❌ Josh post not found in ${db.name}`);
        continue;
      }
      
      console.log(`   Found: "${post.title}"`);
      
      // Replace the wrong link with the correct one
      let updatedContent = post.content;
      let hasChanges = false;
      
      // Fix direct whop.com link
      if (updatedContent.includes('[https://whop.com/exclusive-vip-access/?a=alexburnett21](https://whop.com/exclusive-vip-access/?a=alexburnett21)')) {
        updatedContent = updatedContent.replace(
          /\[https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21\]\(https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21\)/g,
          '[https://whpcodes.com/whop/josh-exclusive-vip-access](https://whpcodes.com/whop/josh-exclusive-vip-access)'
        );
        hasChanges = true;
      }
      
      // Also check for plain text version
      if (updatedContent.includes('https://whop.com/exclusive-vip-access/?a=alexburnett21') && !updatedContent.includes('[https://whpcodes.com/whop/josh-exclusive-vip-access]')) {
        updatedContent = updatedContent.replace(
          /https:\/\/whop\.com\/exclusive-vip-access\/\?a=alexburnett21/g,
          '[https://whpcodes.com/whop/josh-exclusive-vip-access](https://whpcodes.com/whop/josh-exclusive-vip-access)'
        );
        hasChanges = true;
      }
      
      if (hasChanges) {
        await prisma.blogPost.update({
          where: { id: post.id },
          data: { content: updatedContent }
        });
        console.log(`   ✅ Fixed Josh VIP Access link in ${db.name}`);
      } else {
        console.log(`   ⚠️  No changes needed in ${db.name}`);
      }
      
      await prisma.$disconnect();
    }
    
    console.log('\n🎉 JOSH LINK FIX COMPLETED FOR BOTH DATABASES!');
    
  } catch (error) {
    console.error('Error:', error);
  }
}

fixJoshLinkBothDatabases();