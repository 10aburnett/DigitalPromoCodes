import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();
const WHOPS_PER_SITEMAP = 1000;

async function generateStaticSitemaps() {
  try {
    console.log('🔄 Generating static sitemap files...');
    
    // Get all published whops
    const whops = await prisma.whop.findMany({
      where: {
        publishedAt: { not: null }
      },
      select: {
        slug: true,
        updatedAt: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`📊 Found ${whops.length} published whops`);

    const totalPages = Math.ceil(whops.length / WHOPS_PER_SITEMAP);
    const baseUrl = 'https://whpcodes.com';
    const publicDir = path.join(process.cwd(), 'public');

    // Ensure public directory exists
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }

    // Generate individual sitemap files
    for (let page = 1; page <= totalPages; page++) {
      const skip = (page - 1) * WHOPS_PER_SITEMAP;
      const pageWhops = whops.slice(skip, skip + WHOPS_PER_SITEMAP);
      
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pageWhops.map(whop => `  <url>
    <loc>${baseUrl}/whop/${whop.slug}</loc>
    <lastmod>${whop.updatedAt.toISOString().split('T')[0]}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.9</priority>
  </url>`).join('\n')}
</urlset>`;

      const filename = path.join(publicDir, `sitemap-whops-${page}.xml`);
      fs.writeFileSync(filename, sitemap);
      console.log(`✅ Generated sitemap-whops-${page}.xml (${pageWhops.length} URLs)`);
    }

    // Generate sitemap index
    const sitemapIndex = `<?xml version="1.0" encoding="UTF-8"?>
<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <sitemap>
    <loc>${baseUrl}/sitemap-static.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>
${Array.from({ length: totalPages }, (_, i) => i + 1).map(page => `  <sitemap>
    <loc>${baseUrl}/sitemap-whops-${page}.xml</loc>
    <lastmod>${new Date().toISOString().split('T')[0]}</lastmod>
  </sitemap>`).join('\n')}
</sitemapindex>`;

    const indexFilename = path.join(publicDir, 'sitemap-index.xml');
    fs.writeFileSync(indexFilename, sitemapIndex);
    console.log(`✅ Generated sitemap-index.xml with ${totalPages + 1} sitemaps`);

    console.log('\n🎉 Static sitemap generation complete!');
    console.log(`📂 Files created in /public:`);
    console.log(`   - sitemap-index.xml (main index)`);
    console.log(`   - sitemap-whops-1.xml to sitemap-whops-${totalPages}.xml`);
    console.log('\n📋 Next steps:');
    console.log('1. Deploy these files to your site');
    console.log('2. Submit https://whpcodes.com/sitemap-index.xml to Google Search Console');
    console.log(`3. Google will discover ${whops.length + 5} pages`);

  } catch (error) {
    console.error('❌ Error generating sitemaps:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
generateStaticSitemaps();