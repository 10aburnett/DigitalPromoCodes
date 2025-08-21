const { PrismaClient } = require('@prisma/client');

async function checkBlogAuthors() {
  const prisma = new PrismaClient({
    datasources: {
      db: {
        url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
      }
    }
  });

  try {
    console.log('📝 BLOG AUTHORS ANALYSIS');
    console.log('========================\n');

    // Get all users who could be authors
    const users = await prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        _count: {
          select: { BlogPost: true }
        }
      }
    });

    console.log('👥 EXISTING USERS:');
    console.log('------------------');
    users.forEach(user => {
      console.log(`• ${user.name || 'No Name'} (${user.email}) - ${user.role} - ${user._count.BlogPost} posts`);
    });

    // Get blog posts with their current authors
    const blogPosts = await prisma.blogPost.findMany({
      select: {
        id: true,
        title: true,
        published: true,
        author: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log(`\n📚 BLOG POSTS (${blogPosts.length} total):`);
    console.log('-------------------');
    blogPosts.forEach(post => {
      const authorName = post.author?.name || 'No Author';
      const publishedStatus = post.published ? '✅' : '❌';
      console.log(`${publishedStatus} "${post.title}" - by ${authorName}`);
    });

    // Check for posts without authors
    const postsWithoutAuthors = blogPosts.filter(post => !post.author);
    if (postsWithoutAuthors.length > 0) {
      console.log(`\n⚠️  ${postsWithoutAuthors.length} posts have no author assigned!`);
    }

    console.log('\n💡 RECOMMENDATIONS:');
    console.log('-------------------');
    console.log('1. Create proper author users with real names (Will, Alex)');
    console.log('2. Update existing blog posts to use correct authors');
    console.log('3. Add author selection dropdown in admin blog editor');

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkBlogAuthors().catch(console.error);