import { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Blog - Latest Updates & Insights',
  description: 'Stay updated with the latest news, insights, and tips from our blog.',
}

export default async function BlogPage() {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
    select: {
      id: true,
      title: true,
      slug: true,
      excerpt: true,
      publishedAt: true,
      author: {
        select: {
          name: true,
        }
      }
    }
  })

  return (
    <div className="min-h-screen py-8 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1200px]">
        <div className="space-y-6">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold py-1" 
                style={{ lineHeight: '1.3', marginBottom: '0.6rem' }}>
              <span style={{ color: 'var(--accent-color)' }}>WHP</span>
              <span className="ml-2" style={{ color: 'var(--text-color)' }}>
                Blog
              </span>
            </h1>
            <div className="w-20 h-1 mx-auto rounded-full" style={{ backgroundColor: 'var(--accent-color)' }}></div>
          </div>

          <div className="text-center -mt-2">
            <p className="text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Stay updated with the latest insights, tips, and Whop news.
            </p>
          </div>

          {posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-8 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>No blog posts published yet.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <article
                    className="rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border cursor-pointer bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20"
                    style={{ 
                      borderColor: 'var(--card-border)',
                      boxShadow: 'var(--promo-shadow)'
                    }}
                  >
                    <div className="p-8">
                      <div className="mb-4">
                        <time className="text-sm text-gray-500 dark:text-gray-400">
                          {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          }) : ''}
                        </time>
                      </div>
                      
                      <h2 className="text-2xl font-bold mb-4 group-hover:opacity-80 transition-colors text-gray-900 dark:text-white">
                        {post.title}
                      </h2>
                      
                      {post.excerpt && (
                        <p className="mb-6 line-clamp-3 text-gray-700 dark:text-gray-300">
                          {post.excerpt}
                        </p>
                      )}
                      
                      <div className="flex items-center justify-between">
                        <span
                          className="inline-flex items-center font-medium group-hover:opacity-80 transition-opacity"
                          style={{ color: 'var(--accent-color)' }}
                        >
                          Read More
                          <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </span>
                        
                        {post.author?.name && (
                          <span className="text-sm text-gray-500 dark:text-gray-400">
                            By {post.author.name}
                          </span>
                        )}
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}