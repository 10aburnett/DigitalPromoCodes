const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function showAllPosts() {
  try {
    console.log('DATABASE_URL:', process.env.DATABASE_URL?.substring(0, 50) + '...');
    console.log('=== ALL BLOG POSTS ===');
    
    const posts = await prisma.blogPost.findMany({
      select: { 
        id: true, 
        title: true, 
        slug: true, 
        published: true,
        createdAt: true,
        publishedAt: true
      },
      orderBy: { createdAt: 'desc' }
    });
    
    console.log(`Total posts: ${posts.length}`);
    
    posts.forEach((post, index) => {
      console.log(`${index + 1}. "${post.title}" (${post.slug})`);
      console.log(`   Status: ${post.published ? 'Published' : 'Draft'}`);
      console.log(`   Created: ${post.createdAt}`);
      console.log(`   Published: ${post.publishedAt || 'Not published'}`);
      console.log('');
    });
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

showAllPosts();