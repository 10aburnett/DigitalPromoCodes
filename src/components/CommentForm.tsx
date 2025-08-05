'use client'
import { useState } from 'react'
import MailingListPopup from './MailingListPopup'

interface CommentFormProps {
  blogPostId: string
  onCommentSubmitted: () => void
}

export default function CommentForm({ blogPostId, onCommentSubmitted }: CommentFormProps) {
  const [formData, setFormData] = useState({
    authorName: '',
    authorEmail: '',
    content: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [showMailingListPopup, setShowMailingListPopup] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/comments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          blogPostId
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        onCommentSubmitted()
        
        // Show mailing list popup after successful comment submission
        setTimeout(() => {
          setShowMailingListPopup(true)
        }, 1500) // Small delay to let user see success message
        
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to submit comment' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to submit comment. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleMailingListClose = () => {
    setShowMailingListPopup(false)
    // Clear form data after mailing list interaction
    setFormData({ authorName: '', authorEmail: '', content: '' })
  }

  const handleMailingListSubmit = (subscribed: boolean) => {
    // Popup component handles the API call, we just need to cleanup
    setShowMailingListPopup(false)
    setFormData({ authorName: '', authorEmail: '', content: '' })
  }

  return (
    <div className="rounded-2xl shadow-lg p-8 border" 
         style={{ 
           backgroundColor: 'var(--card-bg)', 
           borderColor: 'var(--card-border)',
           boxShadow: 'var(--promo-shadow)'
         }}>
      <h3 className="text-2xl font-bold mb-6" style={{ color: 'var(--text-color)' }}>
        Leave a Comment
      </h3>

      {message && (
        <div className={`p-4 rounded-lg mb-6 ${
          message.type === 'success' 
            ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
            : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
        }`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
              Name *
            </label>
            <input
              type="text"
              value={formData.authorName}
              onChange={(e) => setFormData(prev => ({ ...prev, authorName: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                backgroundColor: 'var(--background-color)', 
                borderColor: 'var(--card-border)',
                color: 'var(--text-color)'
              }}
              required
              disabled={isSubmitting}
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
              Email *
            </label>
            <input
              type="email"
              value={formData.authorEmail}
              onChange={(e) => setFormData(prev => ({ ...prev, authorEmail: e.target.value }))}
              className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
              style={{ 
                backgroundColor: 'var(--background-color)', 
                borderColor: 'var(--card-border)',
                color: 'var(--text-color)'
              }}
              required
              disabled={isSubmitting}
            />
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              Your email will not be published
            </p>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
            Comment *
          </label>
          <textarea
            value={formData.content}
            onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
            rows={5}
            className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500 resize-vertical"
            style={{ 
              backgroundColor: 'var(--background-color)', 
              borderColor: 'var(--card-border)',
              color: 'var(--text-color)'
            }}
            placeholder="Share your thoughts..."
            required
            disabled={isSubmitting}
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSubmitting}
            className="px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
            style={{ 
              backgroundColor: 'var(--accent-color)', 
              color: 'white'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Post Comment'}
          </button>
        </div>
      </form>

      {/* Mailing List Popup */}
      <MailingListPopup
        isOpen={showMailingListPopup}
        onClose={handleMailingListClose}
        userEmail={formData.authorEmail}
        userName={formData.authorName}
        onSubmit={handleMailingListSubmit}
      />
    </div>
  )
}