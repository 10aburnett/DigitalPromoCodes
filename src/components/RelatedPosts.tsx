'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface RelatedPost {
  id: string
  title: string
  slug: string
  excerpt: string | null
  publishedAt: string | null
  author?: {
    name: string
  } | null
}

interface RelatedPostsProps {
  currentPostId: string
  currentPostTitle: string
}

export default function RelatedPosts({ currentPostId, currentPostTitle }: RelatedPostsProps) {
  const [relatedPosts, setRelatedPosts] = useState<RelatedPost[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchRelatedPosts = async () => {
      try {
        const response = await fetch(`/api/blog/related?postId=${currentPostId}&title=${encodeURIComponent(currentPostTitle)}`)
        if (response.ok) {
          const data = await response.json()
          setRelatedPosts(data.posts || [])
        }
      } catch (error) {
        console.error('Error fetching related posts:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchRelatedPosts()
  }, [currentPostId, currentPostTitle])

  if (loading) {
    return (
      <div className="space-y-4">
        <h3 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>
          Related Articles
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {[1, 2, 3].map(i => (
            <div key={i} className="animate-pulse">
              <div className="rounded-lg p-6 border" style={{ 
                backgroundColor: 'var(--background-secondary)', 
                borderColor: 'var(--border-color)' 
              }}>
                <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded mb-4"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded mb-2"></div>
                <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (relatedPosts.length === 0) {
    return null
  }

  return (
    <div className="space-y-6">
      <h3 className="text-2xl font-bold" style={{ color: 'var(--text-color)' }}>
        Related Articles
      </h3>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {relatedPosts.map((post) => (
          <Link key={post.id} href={`/blog/${post.slug}`}>
            <article
              className="group rounded-lg p-6 border hover:shadow-lg transition-all duration-300 cursor-pointer h-full flex flex-col"
              style={{ 
                backgroundColor: 'var(--card-bg)', 
                borderColor: 'var(--card-border)',
                boxShadow: 'var(--promo-shadow)'
              }}
            >
              <div className="flex-1">
                <h4 className="text-lg font-semibold mb-3 group-hover:opacity-80 transition-opacity line-clamp-2" 
                    style={{ color: 'var(--text-color)' }}>
                  {post.title}
                </h4>
                
                {post.excerpt && (
                  <p className="text-sm mb-4 line-clamp-3" style={{ color: 'var(--text-secondary)' }}>
                    {post.excerpt}
                  </p>
                )}
              </div>
              
              <div className="flex items-center justify-between mt-auto pt-4 border-t" 
                   style={{ borderColor: 'var(--border-color)' }}>
                {post.publishedAt && (
                  <time className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {new Date(post.publishedAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric'
                    })}
                  </time>
                )}
                
                {post.author?.name && (
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    By {post.author.name}
                  </span>
                )}
              </div>
              
              <div className="mt-3">
                <span 
                  className="inline-flex items-center text-sm font-medium group-hover:opacity-80 transition-opacity"
                  style={{ color: 'var(--accent-color)' }}
                >
                  Read More
                  <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </span>
              </div>
            </article>
          </Link>
        ))}
      </div>
    </div>
  )
}