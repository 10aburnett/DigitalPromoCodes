// @ts-nocheck
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Script from 'next/script'
import { prisma } from '@/lib/prisma'
import { getBlogPostBySlug } from '@/lib/blog'
import BlogPostClient from '@/components/BlogPostClient'
import { generateArticleSchema, generateBreadcrumbSchema, calculateReadingTime, extractHeadings, processContentWithHeadingIds, optimizeInternalLinkingServer, optimizeImageAltText } from '@/lib/blog-utils'
import { siteOrigin } from '@/lib/site-origin'

// SSG + ISR configuration
export const dynamic = 'force-static'
export const revalidate = 3600 // 1 hour
export const dynamicParams = true // Enable ISR for new posts
export const fetchCache = 'force-cache'
export const runtime = 'nodejs' // Required for Prisma

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
  author: {
    name: string
  }
}

// Prebuild all published blog posts at build time
export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true }
  });

  return posts.map(p => ({ slug: p.slug }));
}

// Generate metadata with canonical URL and proper robots tags
export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  try {
    const post = await prisma.blogPost.findUnique({
      where: { slug: params.slug },
      select: {
        title: true,
        excerpt: true,
        published: true,
        updatedAt: true,
        publishedAt: true,
        slug: true,
        authorName: true,
        User: { select: { name: true } }
      }
    });

    if (!post || !post.published) {
      return {
        title: 'Blog Post Not Found - WHP Codes',
        description: 'The requested blog post could not be found.',
        robots: { index: false, follow: true }
      }
    }

    const canonical = `${siteOrigin()}/blog/${post.slug}`;
    const currentYear = new Date().getFullYear();
    const metaDescription = post.excerpt ?? undefined;
    const publishedDate = post.publishedAt ? new Date(post.publishedAt).toISOString() : undefined;

    const authorName = post.User?.name || post.authorName || 'WHP Team';

    return {
      title: `${post.title} - WHP Blog | Whop Promo Codes & Digital Products ${currentYear}`,
      description: metaDescription,
      keywords: `${post.title}, WHP blog, Whop promo codes ${currentYear}, digital products, ${authorName}`,
      authors: [{ name: authorName }],
      alternates: {
        canonical
      },
      robots: {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          'max-image-preview': 'large',
          'max-snippet': -1,
          'max-video-preview': -1,
        }
      },
      openGraph: {
        title: `${post.title} - WHP Blog`,
        description: metaDescription,
        type: 'article',
        url: canonical,
        publishedTime: publishedDate,
        authors: [authorName],
        siteName: 'WHP Codes'
      },
      twitter: {
        card: 'summary_large_image',
        title: `${post.title} - WHP Blog`,
        description: metaDescription,
        creator: `@${authorName.replace(/\s+/g, '')}`
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

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  // Guard: Only serve published posts
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug },
    include: { User: { select: { name: true } } },
  });

  if (!post || !post.published) {
    return notFound();
  }

  const authorName = post.User?.name || post.authorName || 'WHP Codes';

  // Server-rendered BlogPosting schema (minimal, truthful)
  const articleLd = {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: post.title,
    description: post.excerpt ?? undefined,
    datePublished: post.publishedAt?.toISOString?.(),
    dateModified: post.updatedAt?.toISOString?.(),
    mainEntityOfPage: `${siteOrigin()}/blog/${post.slug}`,
    author: authorName
      ? { '@type': 'Person', name: authorName }
      : { '@type': 'Organization', name: 'WHP Codes' },
  };

  // Breadcrumb schema
  const breadcrumbLd = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: 'Home',
        item: siteOrigin()
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: `${siteOrigin()}/blog`
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: post.title,
        item: `${siteOrigin()}/blog/${post.slug}`
      }
    ]
  }
  
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
      {/* Server-rendered Article Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleLd) }}
      />

      {/* Server-rendered Breadcrumb Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }}
      />
      
      {/* Pass the processed post data to the client component */}
      <BlogPostClient post={processedPost} />
    </>
  )
}