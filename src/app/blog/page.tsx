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
    <div className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1200px]">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r bg-clip-text text-transparent leading-tight" 
                style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))` }}>
              Our Blog
            </h1>
            <div className="w-20 h-1 mx-auto rounded-full mb-6" style={{ backgroundColor: 'var(--accent-color)' }}></div>
            <p className="text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
              Stay updated with the latest insights, tips, and industry news
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
                <article
                  key={post.id}
                  className="rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border"
                  style={{ 
                    backgroundColor: 'var(--card-bg)', 
                    borderColor: 'var(--card-border)',
                    boxShadow: 'var(--promo-shadow)'
                  }}
                >
                  <div className="p-8">
                    <div className="mb-4">
                      <time className="text-sm" style={{ color: 'var(--text-muted)' }}>
                        {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric'
                        }) : ''}
                      </time>
                    </div>
                    
                    <h2 className="text-2xl font-bold mb-4 group-hover:opacity-80 transition-colors" style={{ color: 'var(--text-color)' }}>
                      <Link href={`/blog/${post.slug}`}>
                        {post.title}
                      </Link>
                    </h2>
                    
                    {post.excerpt && (
                      <p className="mb-6 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                        {post.excerpt}
                      </p>
                    )}
                    
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/blog/${post.slug}`}
                        className="inline-flex items-center font-medium hover:opacity-80 transition-opacity"
                        style={{ color: 'var(--accent-color)' }}
                      >
                        Read More
                        <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </Link>
                      
                      {post.author?.name && (
                        <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                          By {post.author.name}
                        </span>
                      )}
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}