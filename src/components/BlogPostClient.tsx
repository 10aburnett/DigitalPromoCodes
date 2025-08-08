'use client'
import { useState } from 'react'
import Link from 'next/link'
import ReactMarkdown from 'react-markdown'
import CommentForm from '@/components/CommentForm'
import CommentsList from '@/components/CommentsList'

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

interface BlogPostClientProps {
  post: BlogPost
}

export default function BlogPostClient({ post }: BlogPostClientProps) {
  const [refreshComments, setRefreshComments] = useState(0)
  const [replyTo, setReplyTo] = useState<{ parentId: string, parentAuthor: string } | null>(null)

  const handleCommentSubmitted = () => {
    setRefreshComments(prev => prev + 1)
    setReplyTo(null) // Clear reply state after submission
  }

  const handleReply = (parentId: string, parentAuthor: string) => {
    setReplyTo({ parentId, parentAuthor })
    // Scroll to comment form
    setTimeout(() => {
      document.querySelector('[data-comment-form]')?.scrollIntoView({ behavior: 'smooth' })
    }, 100)
  }

  const handleCancelReply = () => {
    setReplyTo(null)
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
              <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r bg-clip-text text-transparent py-2" 
                  style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))`, lineHeight: '1.3' }}>
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
              >
                <ReactMarkdown
                  components={{
                    a: ({ href, children, ...props }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="font-medium hover:opacity-80 transition-opacity underline"
                        style={{ color: 'var(--accent-color)' }}
                        {...props}
                      >
                        {children}
                      </a>
                    ),
                    p: ({ children }) => (
                      <p className="mb-4 leading-relaxed whitespace-pre-wrap">
                        {children}
                      </p>
                    )
                  }}
                >
                  {post.content}
                </ReactMarkdown>
              </div>
            </div>
          </article>

          {/* Comments Section */}
          <div className="mt-12 space-y-8">
            <CommentsList 
              blogPostId={post.id} 
              refreshTrigger={refreshComments} 
              onReply={handleReply}
            />
            <div data-comment-form>
              <CommentForm 
                blogPostId={post.id} 
                onCommentSubmitted={handleCommentSubmitted}
                parentId={replyTo?.parentId}
                parentAuthor={replyTo?.parentAuthor}
                onCancel={replyTo ? handleCancelReply : undefined}
              />
            </div>
          </div>

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