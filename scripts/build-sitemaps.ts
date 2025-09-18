import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync, existsSync, readFileSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface WhopData {
  slug: string
  locale: string | null
  updatedAt: Date
}

interface FreshnessEntry {
  checkedAt?: string
  verifiedAt?: string
}

interface FreshnessFile {
  lastUpdated: string
  ledger: FreshnessEntry[]
}

const SITE_URL = process.env.SITE_URL?.replace(/\/$/, '') || 'https://whpcodes.com'
const INCLUDE_TEMP_SITEMAPS = process.env.INCLUDE_TEMP_SITEMAPS === '1'
const MAX_URLS_PER_FILE = 45000

function getLastModFromFreshness(slug: string, dbUpdatedAt: Date): string {
  try {
    const freshnessPath = join(process.cwd(), 'data', 'pages', `${slug}.json`)
    if (!existsSync(freshnessPath)) {
      return dbUpdatedAt.toISOString()
    }

    const freshnessData: FreshnessFile = JSON.parse(readFileSync(freshnessPath, 'utf8'))

    // Collect all timestamps: file lastUpdated + all ledger timestamps
    const timestamps = [freshnessData.lastUpdated]

    for (const entry of freshnessData.ledger) {
      if (entry.verifiedAt) timestamps.push(entry.verifiedAt)
      if (entry.checkedAt) timestamps.push(entry.checkedAt)
    }

    // Find the most recent timestamp
    const latestFreshness = timestamps
      .map(ts => new Date(ts))
      .reduce((latest, current) => current > latest ? current : latest, new Date(0))

    // Return the most recent between freshness data and DB
    return latestFreshness > dbUpdatedAt ? latestFreshness.toISOString() : dbUpdatedAt.toISOString()

  } catch (error) {
    // Fallback to DB timestamp if anything goes wrong
    return dbUpdatedAt.toISOString()
  }
}

function buildUrl(slug: string, locale: string | null): string {
  const localePath = locale === 'en' || !locale ? '' : `${locale}/`
  // Canonicalize slug: lowercase + encode colons
  const canonicalSlug = slug.toLowerCase().replace(/:/g, '%3a').replace(/%3a/gi, '%3a')
  const url = `${SITE_URL}/${localePath}whop/${canonicalSlug}`
  // Fix double slashes but preserve the protocol://
  return url.replace(/([^:]\/)\/+/g, '$1')
}

function generateXmlHeader(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>\n`
}

function generateUrlsetXml(urls: string[]): string {
  const now = new Date().toISOString()
  const urlEntries = urls.map(url => `  <url>
    <loc>${url}</loc>
    <lastmod>${now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`).join('\n')

  return `${generateXmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`
}

function generateWhopUrlsetXml(whops: WhopData[]): string {
  const urlEntries = whops.map(whop => {
    const url = buildUrl(whop.slug, whop.locale)
    const lastmod = getLastModFromFreshness(whop.slug, whop.updatedAt)
    return `  <url>
    <loc>${url}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>daily</changefreq>
    <priority>0.8</priority>
  </url>`
  }).join('\n')

  return `${generateXmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urlEntries}
</urlset>`
}


function chunkArray<T>(array: T[], chunkSize: number): T[][] {
  const chunks: T[][] = []
  for (let i = 0; i < array.length; i += chunkSize) {
    chunks.push(array.slice(i, i + chunkSize))
  }
  return chunks
}

async function main() {
  console.log('🗺️  Building sitemaps...')
  console.log(`Site URL: ${SITE_URL}`)
  console.log(`Include temp sitemaps: ${INCLUDE_TEMP_SITEMAPS}`)

  // Ensure directories exist
  const publicDir = join(process.cwd(), 'public')
  const sitemapsDir = join(publicDir, 'sitemaps')
  
  if (!existsSync(publicDir)) {
    mkdirSync(publicDir, { recursive: true })
  }
  if (!existsSync(sitemapsDir)) {
    mkdirSync(sitemapsDir, { recursive: true })
  }

  // INDEXABLE (live + index)
  const indexable = await prisma.whop.findMany({
    where: { indexingStatus: 'INDEX', retired: false, retirement: 'NONE' },
    select: { slug: true, locale: true, updatedAt: true },
  })

  // NOINDEX (live but noindex)  ❗ EXCLUDE retired/gone
  const noindex = await prisma.whop.findMany({
    where: { indexingStatus: 'NOINDEX', retired: false, retirement: 'NONE' },
    select: { slug: true, locale: true, updatedAt: true },
  })

  // GONE (410)  ✅ retired OR explicit GONE
  const gone = await prisma.whop.findMany({
    where: { OR: [{ retirement: 'GONE' }, { retired: true }] },
    select: { slug: true, locale: true, updatedAt: true },
  })

  // Make categories mutually exclusive (belt-and-suspenders)
  const path = (x: { locale: string | null; slug: string }) => `/${x.locale || 'en'}/whop/${x.slug}`

  const setIndex = new Set(indexable.map(path))
  const setNoindex = new Set(noindex.map(path))
  const setGone = new Set(gone.map(path))

  // Remove overlaps if any bad data slips in
  const cleanNoindex = noindex.filter(x => !setIndex.has(path(x)) && !setGone.has(path(x)))
  const cleanIndex = indexable.filter(x => !setNoindex.has(path(x)) && !setGone.has(path(x)))

  console.log('[sitemaps] counts', {
    indexable: cleanIndex.length,
    noindex: cleanNoindex.length,
    gone: gone.length,
  })

  // Generate static pages sitemap
  const staticPages = [
    { url: '', priority: '1.0', changefreq: 'daily' },
    { url: 'blog', priority: '0.8', changefreq: 'weekly' },
    { url: 'subscribe', priority: '0.7', changefreq: 'monthly' },
    { url: 'unsubscribe', priority: '0.4', changefreq: 'monthly' },
    { url: 'about', priority: '0.8', changefreq: 'monthly' },
    { url: 'contact', priority: '0.6', changefreq: 'monthly' },
    { url: 'privacy', priority: '0.5', changefreq: 'yearly' },
    { url: 'terms', priority: '0.5', changefreq: 'yearly' }
  ]

  const staticUrls = staticPages.map(page => `  <url>
    <loc>${SITE_URL}${page.url ? `/${page.url}` : ''}</loc>
    <lastmod>${new Date().toISOString()}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
  </url>`).join('\n')

  const staticXml = `${generateXmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${staticUrls}
</urlset>`
  writeFileSync(join(sitemapsDir, 'static.xml'), staticXml)
  console.log(`📄 Created static.xml with ${staticPages.length} URLs`)

  // Generate blog sitemap
  let blogPosts = []
  try {
    blogPosts = await prisma.blogPost.findMany({
      where: { published: true },
      select: { slug: true, updatedAt: true }
    })
  } catch (error) {
    console.log('⚠️ No blog posts table found')
  }

  if (blogPosts.length > 0) {
    const blogUrls = blogPosts.map(post => `  <url>
    <loc>${SITE_URL}/blog/${post.slug}</loc>
    <lastmod>${post.updatedAt.toISOString()}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.7</priority>
  </url>`).join('\n')

    const blogXml = `${generateXmlHeader()}<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${blogUrls}
</urlset>`
    writeFileSync(join(sitemapsDir, 'blog.xml'), blogXml)
    console.log(`📝 Created blog.xml with ${blogPosts.length} URLs`)
  }

  // Generate indexable URLs with freshness-aware lastmod
  const indexChunks = chunkArray(cleanIndex, MAX_URLS_PER_FILE)
  const indexFilenames: string[] = []

  indexChunks.forEach((chunk, i) => {
    const filename = `index-${i + 1}.xml`
    const filepath = join(sitemapsDir, filename)
    const xml = generateWhopUrlsetXml(chunk)
    writeFileSync(filepath, xml)
    indexFilenames.push(filename)
    console.log(`✅ Created ${filename} with ${chunk.length} URLs (freshness-aware lastmod)`)
  })

  // Generate temporary sitemaps if requested
  if (INCLUDE_TEMP_SITEMAPS) {
    if (cleanNoindex.length > 0) {
      const noindexXml = generateWhopUrlsetXml(cleanNoindex)
      writeFileSync(join(sitemapsDir, 'noindex.xml'), noindexXml)
      console.log(`🚫 Created noindex.xml with ${cleanNoindex.length} URLs (freshness-aware lastmod)`)
    }

    if (gone.length > 0) {
      const goneXml = generateWhopUrlsetXml(gone)
      writeFileSync(join(sitemapsDir, 'gone.xml'), goneXml)
      console.log(`💀 Created gone.xml with ${gone.length} URLs (freshness-aware lastmod)`)
    }
  }

  // --- write /public/sitemap.xml as a sitemapindex ---
  const base = process.env.SITE_URL || 'https://whpcodes.com'
  const now = new Date().toISOString()

  const parts = [
    `${base}/sitemaps/index-1.xml`,
    `${base}/sitemaps/static.xml`,
    `${base}/sitemaps/blog.xml`,
    ...(process.env.INCLUDE_TEMP_SITEMAPS === '1'
        ? [`${base}/sitemaps/noindex.xml`, `${base}/sitemaps/gone.xml`]
        : []),
  ]

  const sitemapIndexXml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    parts.map(u => `  <sitemap><loc>${u}</loc><lastmod>${now}</lastmod></sitemap>`).join('\n') +
    `\n</sitemapindex>\n`

  mkdirSync(publicDir, { recursive: true })
  writeFileSync(join(publicDir, 'sitemap.xml'), sitemapIndexXml)
  console.log(`🎯 Created sitemap.xml referencing ${parts.length} child sitemaps: ${parts.map(p => p.split('/').pop()).join(', ')}`)

  console.log('🎉 Sitemap generation complete!')
}

main()
  .catch((e) => {
    console.error('❌ Sitemap generation failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })