/**
 * Blog utility functions for SEO optimization
 */
import { siteOrigin } from '@/lib/site-origin';
import { SITE_BRAND, SITE_AUTHOR } from '@/lib/brand';

/**
 * Calculate estimated reading time for blog content
 * Based on average reading speed of 200 words per minute
 */
export function calculateReadingTime(content: string): number {
  // Remove HTML tags and get plain text
  const plainText = content.replace(/<[^>]*>/g, '').trim()
  
  // Split by whitespace and filter out empty strings
  const words = plainText.split(/\s+/).filter(word => word.length > 0)
  
  // Calculate reading time (average 200 words per minute)
  const wordsPerMinute = 200
  const readingTimeMinutes = Math.ceil(words.length / wordsPerMinute)
  
  return readingTimeMinutes
}

/**
 * Extract headings from HTML content for table of contents
 */
export function extractHeadings(content: string): Array<{
  id: string
  text: string
  level: number
}> {
  const headings: Array<{ id: string; text: string; level: number }> = []
  
  // Match h1-h6 tags
  const headingRegex = /<h([1-6])[^>]*?(?:id="([^"]*)")?[^>]*>(.*?)<\/h[1-6]>/gi
  let match
  
  while ((match = headingRegex.exec(content)) !== null) {
    const level = parseInt(match[1])
    const existingId = match[2]
    const text = match[3].replace(/<[^>]*>/g, '').trim() // Remove HTML tags from heading text
    
    // Generate ID if not exists
    const id = existingId || text.toLowerCase()
      .replace(/[^\w\s-]/g, '') // Remove special characters
      .replace(/\s+/g, '-') // Replace spaces with hyphens
      .replace(/-+/g, '-') // Replace multiple hyphens with single
      .trim()
    
    headings.push({ id, text, level })
  }
  
  return headings
}

/**
 * Generate article schema markup for SEO
 */
export function generateArticleSchema(post: {
  title: string
  content: string
  excerpt: string | null
  publishedAt: string | null
  updatedAt?: string | null
  author?: { name: string } | null
  slug: string
}) {
  const publishedDate = post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date().toISOString()
  const modifiedDate = post.updatedAt ? new Date(post.updatedAt).toISOString() : publishedDate
  const readingTime = calculateReadingTime(post.content)
  
  const origin = siteOrigin();

  // Extract first image from content for schema
  const imageMatch = post.content.match(/<img[^>]+src="([^"]+)"/i)
  const imageUrl = imageMatch ? imageMatch[1] : `${origin}/logo.png`

  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    'headline': post.title,
    'description': post.excerpt || post.content.replace(/<[^>]*>/g, '').substring(0, 160) + '...',
    'image': imageUrl,
    'author': {
      '@type': 'Person',
      'name': (post as any).authorName || post.author?.name || SITE_AUTHOR,
      'url': origin
    },
    'publisher': {
      '@type': 'Organization',
      'name': SITE_BRAND,
      'url': origin,
      'logo': {
        '@type': 'ImageObject',
        'url': `${origin}/logo.png`
      }
    },
    'datePublished': publishedDate,
    'dateModified': modifiedDate,
    'mainEntityOfPage': {
      '@type': 'WebPage',
      '@id': `${origin}/blog/${post.slug}`
    },
    'url': `${origin}/blog/${post.slug}`,
    'wordCount': post.content.replace(/<[^>]*>/g, '').split(/\s+/).length,
    'timeRequired': `PT${readingTime}M`,
    'genre': 'Technology',
    'keywords': `deals, digital products, ${post.title}, discount codes`,
    'articleSection': 'Digital Products',
    'inLanguage': 'en-US'
  }
}

/**
 * Generate breadcrumb schema markup
 */
export function generateBreadcrumbSchema(postTitle: string, slug: string) {
  const origin = siteOrigin();
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    'itemListElement': [
      {
        '@type': 'ListItem',
        'position': 1,
        'name': 'Home',
        'item': origin
      },
      {
        '@type': 'ListItem',
        'position': 2,
        'name': 'Blog',
        'item': `${origin}/blog`
      },
      {
        '@type': 'ListItem',
        'position': 3,
        'name': postTitle,
        'item': `${origin}/blog/${slug}`
      }
    ]
  }
}

/**
 * Server-side function to optimize internal linking with database access
 */
export async function optimizeInternalLinkingServer(content: string, currentPostId: string, allPosts: Array<{ title: string; slug: string; id: string }>): Promise<string> {
  try {
    let optimizedContent = content
    
    // Find potential internal links by matching blog post titles in content
    for (const post of allPosts) {
      if (post.id === currentPostId) continue
      
      // Create variations of the title to match
      const titleVariations = [
        post.title,
        post.title.replace(/[^\w\s]/g, ''), // Remove punctuation
        post.title.split(' ').slice(0, 4).join(' ') // First 4 words
      ]
      
      for (const title of titleVariations) {
        if (title.length < 10) continue // Skip short titles
        
        // Create regex to find the title in content (not already linked)
        const regex = new RegExp(`(?<!<a[^>]*>)\\b${title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b(?![^<]*</a>)`, 'gi')
        
        // Replace with internal link (limit to 2 replacements per post to avoid over-linking)
        let replacements = 0
        optimizedContent = optimizedContent.replace(regex, (match) => {
          if (replacements >= 2) return match
          replacements++
          return `<a href="/blog/${post.slug}" class="internal-link" style="color: var(--accent-color); text-decoration: underline;">${match}</a>`
        })
      }
    }
    
    return optimizedContent
  } catch (error) {
    console.error('Error optimizing internal links:', error)
    return content
  }
}

/**
 * Extract and optimize images with proper alt text
 */
export function optimizeImageAltText(content: string, postTitle: string): string {
  return content.replace(/<img([^>]*)src="([^"]+)"([^>]*)>/gi, (match, beforeSrc, src, afterSrc) => {
    // Check if alt attribute already exists
    if (match.includes('alt=')) {
      return match
    }
    
    // Generate alt text from filename or use post title
    const filename = src.split('/').pop()?.split('.')[0] || ''
    const altText = filename
      .replace(/[-_]/g, ' ')
      .replace(/\b\w/g, l => l.toUpperCase())
      .trim() || `${postTitle} - Related Image`
    
    return `<img${beforeSrc}src="${src}" alt="${altText}"${afterSrc}>`
  })
}

/**
 * Add structured data for images within blog posts
 */
export function extractImagesForSchema(content: string): string[] {
  const images: string[] = []
  const imgRegex = /<img[^>]+src="([^"]+)"/gi
  let match
  
  const origin = siteOrigin();
  while ((match = imgRegex.exec(content)) !== null) {
    const src = match[1]
    // Convert relative URLs to absolute
    const absoluteUrl = src.startsWith('http') ? src : `${origin}${src}`
    images.push(absoluteUrl)
  }
  
  return images
}

/**
 * Process content to add IDs to headings for table of contents
 */
export function processContentWithHeadingIds(content: string): string {
  return content.replace(/<h([1-6])([^>]*)>(.*?)<\/h[1-6]>/gi, (match, level, attributes, text) => {
    // Check if ID already exists
    if (attributes.includes('id=')) {
      return match
    }
    
    // Generate ID from heading text
    const plainText = text.replace(/<[^>]*>/g, '').trim()
    const id = plainText.toLowerCase()
      .replace(/[^\w\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim()
    
    return `<h${level}${attributes} id="${id}">${text}</h${level}>`
  })
}