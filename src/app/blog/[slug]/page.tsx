import { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

interface BlogPostPageProps {
  params: {
    slug: string
  }
}

export async function generateMetadata({ params }: BlogPostPageProps): Promise<Metadata> {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug, published: true },
    select: {
      title: true,
      excerpt: true,
    }
  })

  if (!post) {
    return {
      title: 'Post Not Found',
    }
  }

  return {
    title: post.title,
    description: post.excerpt || `Read ${post.title} on our blog`,
  }
}

export default async function BlogPostPage({ params }: BlogPostPageProps) {
  const post = await prisma.blogPost.findUnique({
    where: { slug: params.slug, published: true },
    include: {
      author: {
        select: {
          name: true,
        }
      }
    }
  })

  if (!post) {
    notFound()
  }

  return (
    <div className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[800px]">
        <div className="space-y-8">
          {/* Back to Blog */}
          <div className="mb-8">
            <Link
              href="/blog"
              className="inline-flex items-center font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-color)' }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Blog
            </Link>
          </div>

          {/* Article */}
          <article>
            <header className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r bg-clip-text text-transparent leading-tight" 
                  style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))` }}>
                {post.title}
              </h1>
              <div className="w-20 h-1 mx-auto rounded-full mb-6" style={{ backgroundColor: 'var(--accent-color)' }}></div>
              
              <div className="flex items-center justify-center space-x-6" style={{ color: 'var(--text-secondary)' }}>
                {post.publishedAt && (
                  <time>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric'
                    })}
                  </time>
                )}
                
                {post.author?.name && (
                  <span>By {post.author.name}</span>
                )}
              </div>
            </header>

            <div className="rounded-2xl shadow-lg p-8 md:p-12 border" 
                 style={{ 
                   backgroundColor: 'var(--card-bg)', 
                   borderColor: 'var(--card-border)',
                   boxShadow: 'var(--promo-shadow)'
                 }}>
              <div 
                className="prose prose-lg max-w-none"
                style={{ 
                  color: 'var(--text-color)',
                  '--tw-prose-headings': 'var(--text-color)',
                  '--tw-prose-links': 'var(--accent-color)',
                }}
                dangerouslySetInnerHTML={{ __html: post.content }}
              />
            </div>
          </article>

          {/* Navigation */}
          <div className="mt-12 pt-8 border-t" style={{ borderColor: 'var(--border-color)' }}>
            <div className="text-center">
              <Link
                href="/blog"
                className="inline-flex items-center justify-center px-6 py-3 font-medium rounded-lg hover:opacity-80 transition-opacity"
                style={{ 
                  backgroundColor: 'var(--accent-color)', 
                  color: 'white'
                }}
              >
                View All Posts
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export async function generateStaticParams() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    select: { slug: true }
  })

  return posts.map((post) => ({
    slug: post.slug,
  }))
}