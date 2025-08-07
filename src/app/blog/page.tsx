import { Metadata } from 'next'
import Link from 'next/link'
import { prisma } from '@/lib/prisma'

export const metadata: Metadata = {
  title: 'Blog - Latest Updates & Insights',
  description: 'Stay updated with the latest news, insights, and tips from our blog.',
}

// Force deployment refresh after database schema update

// Force dynamic rendering to avoid build-time database connection issues
export const dynamic = 'force-dynamic'

export default async function BlogPage() {
  let posts = [];
  let hasError = false;
  let errorMessage = '';

  try {
    // Try with pinned column first, fallback without it
    try {
      posts = await prisma.blogPost.findMany({
        where: { published: true },
        orderBy: [
          { pinned: 'desc' },
          { publishedAt: 'desc' }
        ],
        select: {
          id: true,
          title: true,
          slug: true,
          excerpt: true,
          publishedAt: true,
          pinned: true,
          author: {
            select: {
              name: true,
            }
          }
        }
      })
    } catch (columnError) {
      console.log('Pinned column not available, using fallback query');
      // Fallback query without pinned column
      posts = await prisma.blogPost.findMany({
        where: { published: true },
        orderBy: [
          { publishedAt: 'desc' }
        ],
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
      // Add pinned: false to all posts for compatibility
      posts = posts.map(post => ({ ...post, pinned: false }))
    }
  } catch (error) {
    console.error('Blog page error:', error);
    hasError = true;
    errorMessage = error.message || 'Failed to load blog posts';
  }

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

          {hasError ? (
            <div className="text-center py-16">
              <div className="p-8 rounded-lg border" style={{ 
                backgroundColor: 'var(--background-secondary)', 
                borderColor: 'var(--border-color)' 
              }}>
                <div className="mb-4 text-6xl">⚠️</div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
                  Unable to Load Blog Posts
                </h2>
                <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
                  We're experiencing technical difficulties. Please try again in a few moments.
                </p>
                <details className="text-left">
                  <summary className="cursor-pointer font-medium mb-2" style={{ color: 'var(--text-muted)' }}>
                    Technical Details
                  </summary>
                  <pre className="text-sm p-4 rounded bg-gray-100 dark:bg-gray-800 overflow-x-auto" style={{ color: 'var(--text-muted)' }}>
                    {errorMessage}
                  </pre>
                </details>
                <div className="mt-6">
                  <a 
                    href="/blog"
                    className="inline-block px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90"
                    style={{ 
                      backgroundColor: 'var(--accent-color)', 
                      color: 'white',
                      textDecoration: 'none'
                    }}
                  >
                    Try Again
                  </a>
                </div>
              </div>
            </div>
          ) : posts.length === 0 ? (
            <div className="text-center py-16">
              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-8 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-lg text-gray-900 dark:text-white">No blog posts published yet.</p>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <article
                    className="blog-card rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border cursor-pointer relative"
                    style={{ 
                      borderColor: 'var(--card-border)',
                      boxShadow: 'var(--promo-shadow)'
                    }}
                  >
                    {post.pinned && (
                      <div className="absolute top-4 right-4 text-yellow-500 text-xl">
                        📌
                      </div>
                    )}
                    <div className="blog-card-content p-8">
                      <div className="flex flex-col h-full">
                        <div className="mb-4">
                          <time className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : ''}
                          </time>
                        </div>
                        
                        <h2 className="blog-card-title text-2xl font-bold mb-4 group-hover:opacity-80 transition-colors" style={{ color: 'var(--text-color)' }}>
                          {post.title}
                        </h2>
                        
                        {post.excerpt && (
                          <p className="blog-card-excerpt mb-6" style={{ color: 'var(--text-secondary)' }}>
                            {post.excerpt}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-auto">
                          <span
                            className="blog-accent inline-flex items-center font-medium group-hover:opacity-80 transition-opacity"
                          >
                            Read More
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                          
                          {post.author?.name && (
                            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                              By {post.author.name}
                            </span>
                          )}
                        </div>
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