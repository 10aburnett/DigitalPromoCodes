import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { prisma } from '@/lib/prisma'
import BlogPostClient from '@/components/BlogPostClient'
import { generateArticleSchema, generateBreadcrumbSchema, calculateReadingTime, extractHeadings, processContentWithHeadingIds, optimizeInternalLinkingServer, optimizeImageAltText } from '@/lib/blog-utils'

interface BlogPostPageProps {
  params: {
    slug: string
  }
}

interface BlogPost {
  id: string
  title: string
  content: string
  excerpt: string | null
  publishedAt: string | null
  updatedAt: string | null
  slug: string
  authorName: string | null
  author?: {
    name: string
  }
}

// Generate dynamic metadata for each blog post
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  try {
    const post = await prisma.blogPost.findFirst({
      where: { 
        slug: params.slug,
        published: true 
      },
      select: {
        title: true,
        excerpt: true,
        content: true,
        publishedAt: true,
        updatedAt: true,
        slug: true,
        authorName: true,
        author: {
          select: { name: true }
        }
      }
    })

    if (!post) {
      return {
        title: 'Blog Post Not Found - WHP Codes',
        description: 'The requested blog post could not be found.'
      }
    }

    // Create SEO-optimized meta description
    // Priority: excerpt > first 150 chars of content > fallback
    let metaDescription = ''
    if (post.excerpt) {
      metaDescription = post.excerpt
    } else if (post.content) {
      // Extract first 150 characters from content, clean HTML if any
      const plainTextContent = post.content.replace(/<[^>]*>/g, '').trim()
      metaDescription = plainTextContent.length > 150 
        ? plainTextContent.substring(0, 147) + '...'
        : plainTextContent
    } else {
      metaDescription = `Read "${post.title}" on the WHP Blog. Discover the latest Whop promo codes, digital product insights, and exclusive deals.`
    }

    // Ensure meta description is between 120-160 characters for optimal SEO
    if (metaDescription.length < 120) {
      metaDescription += ' Get the latest Whop promo codes and digital product insights at WHPCodes.com.'
    }

    const publishedDate = post.publishedAt ? new Date(post.publishedAt).toISOString() : new Date().toISOString()
    const currentYear = new Date().getFullYear()

    return {
      title: `${post.title} - WHP Blog | Whop Promo Codes & Digital Products ${currentYear}`,
      description: metaDescription,
      keywords: `${post.title}, WHP blog, Whop promo codes ${currentYear}, digital products, ${post.authorName || post.author?.name || 'WHP Team'}`,
      authors: post.authorName || post.author?.name ? [{ name: post.authorName || post.author?.name }] : [{ name: 'WHP Team' }],
      openGraph: {
        title: `${post.title} - WHP Blog`,
        description: metaDescription,
        type: 'article',
        url: `https://whpcodes.com/blog/${params.slug}`,
        publishedTime: publishedDate,
        authors: post.authorName || post.author?.name ? [post.authorName || post.author.name] : ['WHP Team'],
        siteName: 'WHP Codes'
      },
      twitter: {
        card: 'summary_large_image',
        title: `${post.title} - WHP Blog`,
        description: metaDescription,
        creator: post.authorName || post.author?.name ? `@${(post.authorName || post.author.name).replace(/\s+/g, '')}` : '@WHPCodes'
      },
      alternates: {
        canonical: `https://whpcodes.com/blog/${params.slug}`
      }
    }
  } catch (error) {
    console.error('Error generating blog post metadata:', error)
    return {
      title: 'Blog Post - WHP Codes',
      description: 'Read the latest insights about Whop promo codes and digital products.'
    }
  }
}

// Force dynamic rendering to avoid build-time database connection issues
export const dynamic = 'force-dynamic'

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  let post: BlogPost | null = null

  try {
    post = await prisma.blogPost.findFirst({
      where: { 
        slug: params.slug,
        published: true 
      },
      select: {
        id: true,
        title: true,
        content: true,
        excerpt: true,
        publishedAt: true,
        updatedAt: true,
        slug: true,
        authorName: true,
        author: {
          select: { name: true }
        }
      }
    })
  } catch (error) {
    console.error('Error fetching blog post:', error)
    post = null
  }

  if (!post) {
    notFound()
  }

  // Generate schema markup for SEO
  const articleSchema = generateArticleSchema({
    title: post.title,
    content: post.content,
    excerpt: post.excerpt,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    author: post.authorName ? { name: post.authorName } : post.author,
    slug: post.slug
  })
  
  const breadcrumbSchema = generateBreadcrumbSchema(post.title, post.slug)
  
  // Get all blog posts for internal linking optimization
  const allPosts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { id: true, title: true, slug: true }
  })
  
  // Process content with all optimizations
  let optimizedContent = post.content
  
  // 1. Optimize image alt text
  optimizedContent = optimizeImageAltText(optimizedContent, post.title)
  
  // 2. Add internal links to other blog posts
  optimizedContent = await optimizeInternalLinkingServer(optimizedContent, post.id, allPosts)
  
  // 3. Add IDs to headings for table of contents
  optimizedContent = processContentWithHeadingIds(optimizedContent)
  
  const processedPost = {
    ...post,
    content: optimizedContent,
    readingTime: calculateReadingTime(post.content),
    headings: extractHeadings(optimizedContent)
  }

  return (
    <>
      {/* Article Schema Markup */}
      <Script 
        id="article-schema" 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
      
      {/* Breadcrumb Schema Markup */}
      <Script 
        id="breadcrumb-schema" 
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbSchema) }}
      />
      
      {/* Pass the processed post data to the client component */}
      <BlogPostClient post={processedPost} />
    </>
  )
}