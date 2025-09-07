// Verification script for content migration
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function verifyMigration() {
  try {
    console.log('🔍 Verifying content migration...\n');

    // 1) Total rows
    const totalRows = await prisma.blogPost.count();
    console.log(`1. Total rows: ${totalRows}`);

    // 2) Count of rows with old data vs new data
    const oldNonNull = await prisma.blogPost.count({
      where: { content: { not: null } }
    });
    
    const newNonNull = await prisma.blogPost.count({
      where: { content_text: { not: null } }
    });
    
    console.log(`2. Old content (non-null): ${oldNonNull}`);
    console.log(`   New content_text (non-null): ${newNonNull}`);
    console.log(`   Match: ${oldNonNull === newNonNull ? '✅' : '❌'}`);

    // 3) Sample data check - get a few posts to compare
    const samplePosts = await prisma.blogPost.findMany({
      take: 3,
      select: {
        id: true,
        title: true,
        content: true,
        content_text: true,
      },
      where: {
        content: { not: null }
      }
    });

    console.log(`\n3. Sample data check (${samplePosts.length} posts):`);
    samplePosts.forEach((post, i) => {
      const contentStr = typeof post.content === 'string' ? post.content : JSON.stringify(post.content);
      const matches = contentStr === post.content_text;
      console.log(`   ${i + 1}. "${post.title?.substring(0, 30)}..."`);
      console.log(`      Old length: ${contentStr?.length || 0}`);
      console.log(`      New length: ${post.content_text?.length || 0}`);
      console.log(`      Match: ${matches ? '✅' : '❌'}`);
      if (!matches) {
        console.log(`      Old preview: ${contentStr?.substring(0, 50)}...`);
        console.log(`      New preview: ${post.content_text?.substring(0, 50)}...`);
      }
    });

    console.log('\n🎉 Migration verification complete!');
    
  } catch (error) {
    console.error('❌ Verification failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

verifyMigration();