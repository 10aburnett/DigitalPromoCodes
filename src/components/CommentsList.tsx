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
        setComments(Array.isArray(data) ? data : [])
      } else {
        setComments([])
      }
    } catch (error) {
      console.error('Error fetching comments:', error)
      setComments([])
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
    const maxNestingDepth = 5
    
    // For comments deeper than max nesting, render them flattened with straight lines
    if (depth > maxNestingDepth) {
      return (
        <div key={comment.id} className="mt-4 relative">
          {/* Straight vertical line for flattened deep comments */}
          <div 
            className="absolute left-0 top-0 w-0.5 h-full"
            style={{ 
              backgroundColor: 'var(--thread-line-color, #b3cdfc)',
              marginLeft: '12px'
            }}
          ></div>
          
          <div 
            className="ml-6 border rounded-lg p-4"
            style={{ 
              borderColor: 'var(--card-border)',
              backgroundColor: 'var(--card-bg)',
              borderLeftWidth: '2px',
              borderLeftColor: 'var(--thread-line-color, #b3cdfc)'
            }}
          >
            {renderCommentContent(comment)}
          </div>
          
          {/* Render deeply nested replies also flattened */}
          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-2">
              {comment.replies.map(reply => renderComment(reply, depth + 1))}
            </div>
          )}
        </div>
      )
    }
    
    // Normal nested rendering for levels 1-5
    return (
      <div key={comment.id} className={`${depth > 0 ? 'ml-8 mt-4' : ''} relative`}>
        {/* Reddit-style curved threading line for nested comments */}
        {depth > 0 && (
          <div className="absolute left-0 top-0 opacity-40">
            {/* Curved connector from parent */}
            <div 
              className="w-4 h-6"
              style={{
                borderLeft: `2px solid var(--accent-color)`,
                borderBottom: `2px solid var(--accent-color)`,
                borderBottomLeftRadius: '8px',
                marginLeft: '-32px'
              }}
            ></div>
            {/* Vertical line for child replies */}
            {comment.replies && comment.replies.length > 0 && (
              <div 
                className="w-0.5 opacity-30"
                style={{ 
                  backgroundColor: 'var(--accent-color)',
                  height: 'calc(100% - 24px)',
                  marginLeft: '-32px',
                  marginTop: '0px'
                }}
              ></div>
            )}
          </div>
        )}
        
        <div 
          className="border rounded-lg p-4 relative" 
          style={{ 
            borderColor: 'var(--card-border)',
            backgroundColor: depth > 0 ? 'var(--card-bg)' : 'var(--background-color)'
          }}
        >
          {renderCommentContent(comment)}
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

  // Extract comment content rendering to avoid duplication
  const renderCommentContent = (comment: Comment) => {
    const netScore = comment.upvotes - comment.downvotes
    const isVoting = votingStates[comment.id]
    
    return (
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
                  className="text-sm font-medium transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  onMouseEnter={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--accent-color)'}
                  onMouseLeave={(e) => (e.currentTarget as HTMLElement).style.color = 'var(--text-muted)'}
                >
                  Reply
                </button>
              )}
            </div>
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
        Comments ({comments?.length || 0})
      </h3>

      {!comments || comments.length === 0 ? (
        <div className="text-center py-8">
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            No comments yet. Be the first to share your thoughts!
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {comments.map(comment => comment ? renderComment(comment) : null).filter(Boolean)}
        </div>
      )}
    </div>
  )
}