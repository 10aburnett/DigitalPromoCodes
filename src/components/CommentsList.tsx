'use client'
import { useState, useEffect } from 'react'

interface Comment {
  id: string
  content: string
  authorName: string
  createdAt: string
}

interface CommentsListProps {
  blogPostId: string
  refreshTrigger: number
}

export default function CommentsList({ blogPostId, refreshTrigger }: CommentsListProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)

  const fetchComments = async () => {
    try {
      const response = await fetch(`/api/comments?blogPostId=${blogPostId}`)
      if (response.ok) {
        const data = await response.json()
        setComments(data)
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchComments()
  }, [blogPostId, refreshTrigger])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="rounded-2xl shadow-lg p-8 border" 
           style={{ 
             backgroundColor: 'var(--card-bg)', 
             borderColor: 'var(--card-border)',
             boxShadow: 'var(--promo-shadow)'
           }}>
        <div className="animate-pulse">
          <div className="h-6 w-32 rounded mb-4" style={{ backgroundColor: 'var(--text-muted)' }}></div>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="space-y-2">
                <div className="h-4 w-24 rounded" style={{ backgroundColor: 'var(--text-muted)' }}></div>
                <div className="h-16 w-full rounded" style={{ backgroundColor: 'var(--text-muted)' }}></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-2xl shadow-lg p-8 border" 
         style={{ 
           backgroundColor: 'var(--card-bg)', 
           borderColor: 'var(--card-border)',
           boxShadow: 'var(--promo-shadow)'
         }}>
      <h3 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-color)' }}>
        Comments ({comments.length})
      </h3>

      {comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {comments.map((comment) => (
            <div 
              key={comment.id} 
              className="border-b pb-6 last:border-b-0" 
              style={{ borderColor: 'var(--border-color)' }}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center space-x-4">
                  <div 
                    className="w-10 h-10 rounded-full flex items-center justify-center font-bold text-white"
                    style={{ backgroundColor: 'var(--accent-color)' }}
                  >
                    {comment.authorName.charAt(0).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold" style={{ color: 'var(--text-color)' }}>
                      {comment.authorName}
                    </h4>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
                      {formatDate(comment.createdAt)}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="ml-14">
                <p 
                  className="whitespace-pre-wrap leading-relaxed" 
                  style={{ color: 'var(--text-secondary)' }}
                >
                  {comment.content}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}