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
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-purple-50">
      <div className="container mx-auto px-4 py-16">
        {/* Back to Blog */}
        <div className="mb-8">
          <Link
            href="/blog"
            className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium"
          >
            <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back to Blog
          </Link>
        </div>

        {/* Article */}
        <article className="max-w-4xl mx-auto">
          <header className="text-center mb-12">
            <h1 className="text-5xl font-bold text-gray-900 mb-6">
              {post.title}
            </h1>
            
            <div className="flex items-center justify-center space-x-6 text-gray-600">
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

          <div className="bg-white rounded-2xl shadow-lg p-8 md:p-12">
            <div 
              className="prose prose-lg max-w-none prose-headings:text-gray-900 prose-a:text-blue-600 prose-a:no-underline hover:prose-a:underline"
              dangerouslySetInnerHTML={{ __html: post.content }}
            />
          </div>
        </article>

        {/* Navigation */}
        <div className="max-w-4xl mx-auto mt-12 pt-8 border-t border-gray-200">
          <div className="text-center">
            <Link
              href="/blog"
              className="inline-flex items-center justify-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              View All Posts
            </Link>
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