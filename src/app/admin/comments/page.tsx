'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Comment {
  id: string
  content: string
  authorName: string
  authorEmail: string
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'FLAGGED'
  flaggedReason?: string
  createdAt: string
  BlogPost?: {
    title: string
    slug: string
  } | null
}

export default function AdminCommentsPage() {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<string>('all')

  useEffect(() => {
    fetchComments()
  }, [])

  const fetchComments = async () => {
    try {
      const response = await fetch('/api/admin/comments', {
        credentials: 'include'
      })
      
      if (!response.ok) {
        if (response.status === 401) {
          setError('Unauthorized - Please login as admin')
          return
        }
        throw new Error('Failed to fetch comments')
      }
      
      const data = await response.json()
      setComments(Array.isArray(data) ? data : [])
    } catch (error) {
      console.error('Error fetching comments:', error)
      setError('Failed to load comments')
    } finally {
      setLoading(false)
    }
  }

  const handleStatusChange = async (id: string, status: string, flaggedReason?: string) => {
    try {
      const response = await fetch(`/api/admin/comments/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status, flaggedReason }),
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchComments()
      }
    } catch (error) {
      console.error('Error updating comment:', error)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this comment?')) return
    
    try {
      const response = await fetch(`/api/admin/comments/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      })
      
      if (response.ok) {
        fetchComments()
      }
    } catch (error) {
      console.error('Error deleting comment:', error)
    }
  }

  const getStatusBadge = (status: string) => {
    const colors = {
      PENDING: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300',
      APPROVED: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300',
      REJECTED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300',
      FLAGGED: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300'
    }
    
    return (
      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${colors[status as keyof typeof colors]}`}>
        {status}
      </span>
    )
  }

  const filteredComments = (comments || []).filter(comment => {
    if (filter === 'all') return true
    return comment.status === filter.toUpperCase()
  })

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse">Loading comments...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          <strong className="font-bold">Error: </strong>
          <span className="block sm:inline">{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-white">Comment Moderation</h1>
        <div className="flex space-x-2">
          {['all', 'pending', 'flagged', 'approved', 'rejected'].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === f
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)} 
              {f !== 'all' && `(${(comments || []).filter(c => c.status === f.toUpperCase()).length})`}
            </button>
          ))}
        </div>
      </div>

      {filteredComments.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-8 text-center">
          <p className="text-gray-500 dark:text-gray-400">
            {filter === 'all' ? 'No comments yet.' : `No ${filter} comments.`}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow overflow-hidden">
          <div className="divide-y divide-gray-200 dark:divide-gray-700">
            {filteredComments.map((comment) => (
              <div key={comment.id} className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div className="flex-1">
                    <div className="flex items-center space-x-4 mb-2">
                      <h3 className="font-semibold text-gray-900 dark:text-white">
                        {comment.authorName}
                      </h3>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {comment.authorEmail}
                      </span>
                      {getStatusBadge(comment.status)}
                    </div>
                    
                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      On: {comment.BlogPost ? (
                        <Link 
                          href={`/blog/${comment.BlogPost.slug}`} 
                          className="text-blue-600 hover:text-blue-800 dark:text-blue-400"
                          target="_blank"
                        >
                          {comment.BlogPost.title || comment.BlogPost.slug}
                        </Link>
                      ) : (
                        <span className="text-gray-500 italic">Post deleted or unavailable</span>
                      )}
                    </p>
                    
                    <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                      {new Date(comment.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>

                <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg mb-4">
                  <p className="text-gray-900 dark:text-white whitespace-pre-wrap">
                    {comment.content}
                  </p>
                </div>

                {comment.flaggedReason && (
                  <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg mb-4">
                    <p className="text-red-800 dark:text-red-200 text-sm">
                      <strong>Flagged:</strong> {comment.flaggedReason}
                    </p>
                  </div>
                )}

                <div className="flex space-x-2">
                  {comment.status !== 'APPROVED' && (
                    <button
                      onClick={() => handleStatusChange(comment.id, 'APPROVED')}
                      className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 text-sm"
                    >
                      Approve
                    </button>
                  )}
                  
                  {comment.status !== 'REJECTED' && (
                    <button
                      onClick={() => handleStatusChange(comment.id, 'REJECTED')}
                      className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 text-sm"
                    >
                      Reject
                    </button>
                  )}
                  
                  {comment.status !== 'FLAGGED' && (
                    <button
                      onClick={() => {
                        const reason = prompt('Reason for flagging:')
                        if (reason) handleStatusChange(comment.id, 'FLAGGED', reason)
                      }}
                      className="px-4 py-2 bg-orange-600 text-white rounded hover:bg-orange-700 text-sm"
                    >
                      Flag
                    </button>
                  )}
                  
                  <button
                    onClick={() => handleDelete(comment.id)}
                    className="px-4 py-2 bg-gray-600 text-white rounded hover:bg-gray-700 text-sm"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}