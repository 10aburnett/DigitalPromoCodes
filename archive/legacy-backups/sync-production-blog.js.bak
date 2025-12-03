const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function syncProductionBlog() {
  try {
    console.log('🔍 Checking current production database state...');
    
    // Check current posts
    const currentPosts = await prisma.blogPost.findMany({
      select: { id: true, title: true, slug: true, createdAt: true }
    });
    
    console.log(`📊 Current posts in database: ${currentPosts.length}`);
    currentPosts.forEach(post => console.log(`  - ${post.title} (${post.slug})`));
    
    // Check if pinned column exists
    let hasPinnedColumn = false;
    try {
      await prisma.$queryRaw`SELECT pinned FROM "BlogPost" LIMIT 1`;
      hasPinnedColumn = true;
      console.log('✅ Pinned column exists');
    } catch (error) {
      console.log('❌ Pinned column missing, will add it');
    }
    
    // Add missing columns if needed
    if (!hasPinnedColumn) {
      console.log('🔧 Adding missing columns...');
      await prisma.$executeRaw`ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "pinned" BOOLEAN NOT NULL DEFAULT false`;
      await prisma.$executeRaw`ALTER TABLE "BlogPost" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3)`;
      console.log('✅ Added pinned and pinnedAt columns');
    }
    
    // The 4 expected blog posts
    const expectedPosts = [
      {
        id: 'cmdyylj4m00076fhuq03xzjn3',
        title: 'Welcome to WHP Codes!',
        slug: 'welcome-to-whp-codes',
        content: `# Welcome to WHP Codes!

We're excited to launch our comprehensive platform for finding the best Whop promo codes and discounts!

## What We Offer

- **Verified Promo Codes**: All codes are tested and verified before publishing
- **Daily Updates**: Fresh deals and codes added every day
- **Exclusive Access**: VIP codes available only to our subscribers
- **Community Reviews**: Real user feedback on every platform

## Getting Started

Browse our collection of promo codes, read community reviews, and start saving on your favorite Whop platforms today!

Stay tuned for regular updates, exclusive offers, and insider tips on getting the best deals.`,
        excerpt: 'Welcome to WHP Codes - your ultimate destination for verified Whop promo codes and exclusive discounts.',
        published: true,
        publishedAt: new Date('2024-08-05'),
        pinned: true,
        pinnedAt: new Date('2024-08-05')
      },
      {
        title: 'How to Find the Best Whop Promo Codes',
        slug: 'how-to-find-best-whop-promo-codes',
        content: `# How to Find the Best Whop Promo Codes

Finding genuine, working promo codes can be challenging. Here's our insider guide to getting the best deals.

## 1. Look for Verified Codes

Always choose platforms that verify their codes. At WHP Codes, every code is tested before publication.

## 2. Check Expiration Dates

Nothing's worse than finding the perfect code only to discover it's expired. We regularly update our database to remove old codes.

## 3. Read the Terms

Some codes have restrictions:
- Minimum purchase amounts
- First-time users only  
- Specific products or categories

## 4. Stack Your Savings

Look for opportunities to combine promo codes with existing sales or offers.

## Pro Tips

- Sign up for our VIP list for exclusive codes
- Follow creators on social media for flash codes
- Check back regularly - new codes are added daily

Happy saving!`,
        excerpt: 'Master the art of finding working Whop promo codes with our comprehensive guide and insider tips.',
        published: true,
        publishedAt: new Date('2024-08-04'),
        pinned: false
      },
      {
        title: 'Top 10 Whop Communities You Should Join',
        slug: 'top-10-whop-communities-to-join',
        content: `# Top 10 Whop Communities You Should Join

Discover the most valuable Whop communities across different niches, handpicked by our team.

## 1. Trading & Investing Communities
Learn from seasoned traders and get market insights.

## 2. Personal Development Groups
Unlock your potential with life coaches and mentors.

## 3. AI & Tech Courses
Stay ahead in the rapidly evolving tech landscape.

## 4. Business & Entrepreneurship
Network with fellow entrepreneurs and business minds.

## 5. Fitness & Health Communities
Achieve your health goals with expert guidance.

## 6. Creative Arts & Design
Develop your artistic skills and creative vision.

## 7. Language Learning Groups
Master new languages with native speakers.

## 8. Gaming & Esports
Level up your gaming skills and strategies.

## 9. Personal Finance
Take control of your finances with expert advice.

## 10. Social Media Marketing
Grow your online presence and engagement.

## How to Choose

Consider these factors:
- Your current skill level
- Time commitment required
- Community size and engagement
- Creator reputation and track record

Remember to use our exclusive promo codes to get the best prices on these premium communities!`,
        excerpt: 'Explore our curated list of the top 10 Whop communities that offer the most value across different industries.',
        published: true,
        publishedAt: new Date('2024-08-03'),
        pinned: false
      },
      {
        title: 'Understanding Whop Platform Features',
        slug: 'understanding-whop-platform-features',
        content: `# Understanding Whop Platform Features

Get the most out of your Whop experience by understanding all the platform features and tools available.

## Core Features

### 1. Communities & Discord Integration
Most Whop offerings include exclusive Discord servers for community interaction.

### 2. Course Materials
Access to video lessons, PDFs, templates, and other learning resources.

### 3. Live Sessions
Many creators offer live Q&A sessions, trading calls, or workshops.

### 4. Tools & Software Access
Some subscriptions include access to premium tools and software.

## Maximizing Value

### Use All Available Resources
Don't just join - actively participate in communities and consume all content.

### Network Actively
Connect with other members for opportunities and collaborations.

### Apply What You Learn
Theory without practice is worthless. Implement the strategies you learn.

### Ask Questions
Most creators and communities are happy to help active, engaged members.

## Pro Tips

- Set up notifications for important announcements
- Participate in community challenges and events
- Share your wins and progress with the community
- Provide value to others through helpful contributions

## Getting Support

If you need help with any Whop platform:
1. Check the community guidelines first
2. Search previous discussions
3. Reach out to moderators or the creator
4. Use platform support if needed

Make the most of your investment by fully engaging with the platform features!`,
        excerpt: 'Learn how to maximize the value of your Whop subscriptions by understanding and utilizing all available platform features.',
        published: true,
        publishedAt: new Date('2024-08-02'),
        pinned: false
      }
    ];
    
    console.log('🔄 Syncing blog posts...');
    
    for (const postData of expectedPosts) {
      const { id, ...dataWithoutId } = postData;
      
      // Check if post exists
      const existingPost = await prisma.blogPost.findUnique({
        where: { slug: postData.slug }
      });
      
      if (existingPost) {
        // Update existing post with pinned info
        const updated = await prisma.blogPost.update({
          where: { slug: postData.slug },
          data: {
            pinned: postData.pinned || false,
            pinnedAt: postData.pinnedAt || null,
            // Update content if it's different
            content: postData.content,
            excerpt: postData.excerpt
          }
        });
        console.log(`✅ Updated: ${updated.title}`);
      } else {
        // Create new post
        const created = await prisma.blogPost.create({
          data: postData
        });
        console.log(`✅ Created: ${created.title}`);
      }
    }
    
    // Final verification
    const finalPosts = await prisma.blogPost.findMany({
      select: { id: true, title: true, slug: true, pinned: true },
      orderBy: [
        { pinned: 'desc' },
        { publishedAt: 'desc' }
      ]
    });
    
    console.log(`\n🎉 Final result: ${finalPosts.length} blog posts in database`);
    finalPosts.forEach(post => console.log(`  - ${post.title} (pinned: ${post.pinned})`));
    
  } catch (error) {
    console.error('❌ Error syncing blog:', error);
  } finally {
    await prisma.$disconnect();
  }
}

syncProductionBlog();