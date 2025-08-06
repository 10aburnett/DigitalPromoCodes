'use client'
import { useState, useEffect } from 'react'

interface Comment {
  id: string
  content: string
  authorName: string
  createdAt: string
  upvotes: number
  downvotes: number
  userVote: 'UPVOTE' | 'DOWNVOTE' | null
  replies: Comment[]
}

interface CommentsListProps {
  blogPostId: string
  refreshTrigger: number
  onReply?: (parentId: string, parentAuthor: string) => void
}

export default function CommentsList({ blogPostId, refreshTrigger, onReply }: CommentsListProps) {
  const [comments, setComments] = useState<Comment[]>([])
  const [loading, setLoading] = useState(true)
  const [votingStates, setVotingStates] = useState<Record<string, boolean>>({})

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

  const handleVote = async (commentId: string, voteType: 'UPVOTE' | 'DOWNVOTE') => {
    if (votingStates[commentId]) return // Prevent double-clicking
    
    setVotingStates(prev => ({ ...prev, [commentId]: true }))
    
    try {
      const response = await fetch(`/api/comments/${commentId}/vote`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voteType })
      })

      if (response.ok) {
        const data = await response.json()
        
        // Update the comment in state with new vote counts and user vote
        setComments(prevComments => 
          updateCommentVotes(prevComments, commentId, {
            upvotes: data.upvotes,
            downvotes: data.downvotes,
            userVote: data.userVote
          })
        )
      }
    } catch (error) {
      console.error('Error voting on comment:', error)
    } finally {
      setVotingStates(prev => ({ ...prev, [commentId]: false }))
    }
  }

  // Helper function to recursively update vote counts in nested comments
  const updateCommentVotes = (comments: Comment[], targetId: string, voteData: { upvotes: number, downvotes: number, userVote: 'UPVOTE' | 'DOWNVOTE' | null }): Comment[] => {
    return comments.map(comment => {
      if (comment.id === targetId) {
        return {
          ...comment,
          upvotes: voteData.upvotes,
          downvotes: voteData.downvotes,
          userVote: voteData.userVote
        }
      }
      if (comment.replies && comment.replies.length > 0) {
        return {
          ...comment,
          replies: updateCommentVotes(comment.replies, targetId, voteData)
        }
      }
      return comment
    })
  }

  const renderComment = (comment: Comment, depth = 0) => {
    const netScore = comment.upvotes - comment.downvotes
    const isVoting = votingStates[comment.id]
    
    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : ''}`}>
        <div 
          className="border rounded-lg p-4" 
          style={{ 
            borderColor: 'var(--card-border)',
            backgroundColor: depth > 0 ? 'var(--background-color)' : 'transparent'
          }}
        >
          <div className="flex items-start space-x-3">
            {/* Vote buttons */}
            <div className="flex flex-col items-center space-y-1 pt-1">
              <button
                onClick={() => handleVote(comment.id, 'UPVOTE')}
                disabled={isVoting}
                className={`p-1 rounded transition-colors ${
                  comment.userVote === 'UPVOTE' 
                    ? 'text-green-500' 
                    : 'text-gray-400 hover:text-green-500'
                } ${isVoting ? 'opacity-50' : ''}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M14.707 12.707a1 1 0 01-1.414 0L10 9.414l-3.293 3.293a1 1 0 01-1.414-1.414l4-4a1 1 0 011.414 0l4 4a1 1 0 010 1.414z" clipRule="evenodd" />
                </svg>
              </button>
              
              <span 
                className={`text-sm font-medium ${
                  netScore > 0 ? 'text-green-500' : 
                  netScore < 0 ? 'text-red-500' : 
                  'text-gray-500'
                }`}
              >
                {netScore}
              </span>
              
              <button
                onClick={() => handleVote(comment.id, 'DOWNVOTE')}
                disabled={isVoting}
                className={`p-1 rounded transition-colors ${
                  comment.userVote === 'DOWNVOTE' 
                    ? 'text-red-500' 
                    : 'text-gray-400 hover:text-red-500'
                } ${isVoting ? 'opacity-50' : ''}`}
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>

            <div className="flex-1">
              {/* Comment header */}
              <div className="flex items-center space-x-2 mb-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                  style={{ backgroundColor: 'var(--accent-color)' }}
                >
                  {comment.authorName.charAt(0).toUpperCase()}
                </div>
                <span className="font-medium" style={{ color: 'var(--text-color)' }}>
                  {comment.authorName}
                </span>
                <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                  {formatDate(comment.createdAt)}
                </span>
              </div>
              
              {/* Comment content */}
              <p 
                className="whitespace-pre-wrap leading-relaxed mb-3" 
                style={{ color: 'var(--text-secondary)' }}
              >
                {comment.content}
              </p>
              
              {/* Reply button */}
              {onReply && (
                <button
                  onClick={() => onReply(comment.id, comment.authorName)}
                  className="text-sm font-medium transition-colors"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => e.target.style.color = 'var(--accent-color)'}
                  onMouseLeave={(e) => e.target.style.color = 'var(--text-muted)'}
                >
                  Reply
                </button>
              )}
            </div>
          </div>
        </div>
        
        {/* Nested replies */}
        {comment.replies && comment.replies.length > 0 && (
          <div className="mt-2">
            {comment.replies.map(reply => renderComment(reply, depth + 1))}
          </div>
        )}
      </div>
    )
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
        <div className="space-y-4">
          {comments.map(comment => renderComment(comment))}
        </div>
      )}
    </div>
  )
}