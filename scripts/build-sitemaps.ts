import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join } from 'path'

const prisma = new PrismaClient()

interface WhopData {
  slug: string
  locale: string | null
  updatedAt: Date
}

const SITE_URL = process.env.SITE_URL?.replace(/\/$/, '') || 'https://whpcodes.com'
const INCLUDE_TEMP_SITEMAPS = process.env.INCLUDE_TEMP_SITEMAPS === '1'
const MAX_URLS_PER_FILE = 45000

function buildUrl(slug: string, locale: string | null): string {
  const localePath = locale === 'en' || !locale ? '' : `${locale}/`
  const url = `${SITE_URL}/${localePath}whop/${slug}`
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

function generateSitemapIndexXml(sitemapFiles: string[]): string {
  const now = new Date().toISOString()
  const sitemapEntries = sitemapFiles.map(file => `  <sitemap>
    <loc>${SITE_URL}/sitemaps/${file}</loc>
    <lastmod>${now}</lastmod>
  </sitemap>`).join('\n')

  return `${generateXmlHeader()}<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${sitemapEntries}
</sitemapindex>`
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

  // Generate indexable URLs
  const indexableUrls = cleanIndex.map(whop => buildUrl(whop.slug, whop.locale))
  
  // Chunk indexable URLs into multiple files
  const indexChunks = chunkArray(indexableUrls, MAX_URLS_PER_FILE)
  const indexFilenames: string[] = []

  indexChunks.forEach((chunk, i) => {
    const filename = `index-${i + 1}.xml`
    const filepath = join(sitemapsDir, filename)
    const xml = generateUrlsetXml(chunk)
    writeFileSync(filepath, xml)
    indexFilenames.push(filename)
    console.log(`✅ Created ${filename} with ${chunk.length} URLs`)
  })

  // Generate temporary sitemaps if requested
  if (INCLUDE_TEMP_SITEMAPS) {
    if (cleanNoindex.length > 0) {
      const noindexUrls = cleanNoindex.map(whop => buildUrl(whop.slug, whop.locale))
      const noindexXml = generateUrlsetXml(noindexUrls)
      writeFileSync(join(sitemapsDir, 'noindex.xml'), noindexXml)
      console.log(`🚫 Created noindex.xml with ${noindexUrls.length} URLs`)
    }

    if (gone.length > 0) {
      const goneUrls = gone.map(whop => buildUrl(whop.slug, whop.locale))
      const goneXml = generateUrlsetXml(goneUrls)
      writeFileSync(join(sitemapsDir, 'gone.xml'), goneXml)
      console.log(`💀 Created gone.xml with ${goneUrls.length} URLs`)
    }
  }

  // Generate main sitemap index
  const sitemapIndexXml = generateSitemapIndexXml(indexFilenames)
  writeFileSync(join(publicDir, 'sitemap.xml'), sitemapIndexXml)
  console.log(`🎯 Created sitemap.xml referencing ${indexFilenames.length} index files`)

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