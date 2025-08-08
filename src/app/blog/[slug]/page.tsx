import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { prisma } from '@/lib/prisma'
import BlogPostClient from '@/components/BlogPostClient'

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
      keywords: `${post.title}, WHP blog, Whop promo codes ${currentYear}, digital products, ${post.author?.name || 'WHP Team'}`,
      authors: post.author?.name ? [{ name: post.author.name }] : [{ name: 'WHP Team' }],
      openGraph: {
        title: `${post.title} - WHP Blog`,
        description: metaDescription,
        type: 'article',
        url: `https://whpcodes.com/blog/${params.slug}`,
        publishedTime: publishedDate,
        authors: post.author?.name ? [post.author.name] : ['WHP Team'],
        siteName: 'WHP Codes'
      },
      twitter: {
        card: 'summary_large_image',
        title: `${post.title} - WHP Blog`,
        description: metaDescription,
        creator: post.author?.name ? `@${post.author.name.replace(/\s+/g, '')}` : '@WHPCodes'
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

  // Pass the post data to the client component for interactivity
  return <BlogPostClient post={post} />
}