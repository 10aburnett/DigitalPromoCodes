'use client'
import { useState, useEffect } from 'react'

interface MailingListPopupProps {
  isOpen: boolean
  onClose: () => void
  userEmail: string
  userName: string
  onSubmit: (subscribed: boolean) => void
}

export default function MailingListPopup({ 
  isOpen, 
  onClose, 
  userEmail, 
  userName, 
  onSubmit 
}: MailingListPopupProps) {
  const [isSubscribed, setIsSubscribed] = useState(true) // Default to checked
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)

  // Reset state when popup opens
  useEffect(() => {
    if (isOpen) {
      setIsSubscribed(true)
      setIsSubmitting(false)
      setShowSuccess(false)
    }
  }, [isOpen])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    
    try {
      if (isSubscribed) {
        // Subscribe user to mailing list
        const response = await fetch('/api/mailing-list/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: userEmail,
            name: userName,
            source: 'blog_comment'
          })
        })

        if (!response.ok) {
          throw new Error('Failed to subscribe to mailing list')
        }
      }
      
      // Show success message if subscribed
      if (isSubscribed) {
        console.log('Subscription successful, showing success message')
        setIsSubmitting(false)
        setShowSuccess(true)
        // Auto-close after showing success message
        setTimeout(() => {
          onSubmit(isSubscribed)
          onClose()
        }, 20000)
      } else {
        setIsSubmitting(false)
        onSubmit(isSubscribed)
        onClose()
      }
    } catch (error) {
      console.error('Error handling mailing list subscription:', error)
      setIsSubmitting(false)
      // Still proceed to close popup even if subscription fails
      onSubmit(false)
      onClose()
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50 backdrop-blur-sm"
        onClick={onClose}
      />
      
      {/* Modal */}
      <div 
        className="relative w-full max-w-md mx-4 rounded-2xl shadow-2xl border p-8"
        style={{ 
          backgroundColor: 'var(--card-bg)', 
          borderColor: 'var(--card-border)',
          boxShadow: 'var(--promo-shadow)'
        }}
      >
        {showSuccess ? (
          /* Success Message */
          <div className="text-center">{console.log('Rendering success message')}
            {/* Close Button */}
            <button
              onClick={() => {
                onSubmit(isSubscribed)
                onClose()
              }}
              className="absolute top-4 right-4 p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              style={{ color: 'var(--text-muted)' }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
            
            <div className="w-20 h-20 mx-auto mb-6 rounded-full flex items-center justify-center bg-green-100 dark:bg-green-900/20">
              <svg className="w-10 h-10 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            <h3 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
              Welcome to the VIP List! 🎉
            </h3>
            
            <div className="space-y-3 mb-6">
              <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
                <strong style={{ color: 'var(--accent-color)' }}>You're all set!</strong> We've added <strong>{userEmail}</strong> to our exclusive mailing list.
              </p>
              
              <div className="bg-green-50 dark:bg-green-900/10 p-4 rounded-lg border border-green-200 dark:border-green-800">
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  🎯 <strong>What's next?</strong> Watch your inbox for the latest Whop promo codes, insider tips, and exclusive deals. 
                  Your first VIP email is coming soon!
                </p>
              </div>
            </div>
            
            <div className="text-xs" style={{ color: 'var(--text-muted)' }}>
              Closing automatically in 20 seconds...
            </div>
          </div>
        ) : (
          <>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
               style={{ backgroundColor: 'var(--accent-color)' }}>
            <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
                    d="M3 8l7.89 4.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          
          <h3 className="text-2xl font-bold mb-2" style={{ color: 'var(--text-color)' }}>
            Join Our VIP List! 🎉
          </h3>
          
          <p className="text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
            Get exclusive access to the <strong style={{ color: 'var(--accent-color)' }}>newest Whop promo codes</strong>, 
            insider tips, and deals before anyone else! Join thousands of savvy shoppers saving big.
          </p>
        </div>

        {/* Benefits */}
        <div className="mb-6 space-y-3">
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-5 h-5 mt-1">
              <svg className="w-5 h-5" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong>Exclusive promo codes</strong> not available anywhere else
            </span>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-5 h-5 mt-1">
              <svg className="w-5 h-5" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong>Weekly insider tips</strong> on the best Whop deals
            </span>
          </div>
          
          <div className="flex items-start space-x-3">
            <div className="flex-shrink-0 w-5 h-5 mt-1">
              <svg className="w-5 h-5" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
              </svg>
            </div>
            <span style={{ color: 'var(--text-secondary)' }}>
              <strong>Early access</strong> to limited-time offers
            </span>
          </div>
        </div>

        {/* Subscription Checkbox */}
        <div className="mb-6">
          <label className="flex items-start space-x-3 cursor-pointer">
            <input
              type="checkbox"
              checked={isSubscribed}
              onChange={(e) => setIsSubscribed(e.target.checked)}
              className="w-5 h-5 mt-1 rounded focus:ring-2 focus:ring-offset-2"
              style={{ 
                accentColor: 'var(--accent-color)',
                backgroundColor: 'var(--background-color)',
                borderColor: 'var(--border-color)'
              }}
            />
            <span style={{ color: 'var(--text-secondary)' }}>
              Yes, I want to receive exclusive Whop promo codes and insider tips! 
              <span className="text-xs block mt-1" style={{ color: 'var(--text-muted)' }}>
                (Unsubscribe anytime. We respect your privacy.)
              </span>
            </span>
          </label>
        </div>

        {/* Action Button */}
        <div className="flex justify-center">
          <button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="w-full px-6 py-3 rounded-lg font-medium transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ 
              backgroundColor: 'var(--accent-color)', 
              color: 'white'
            }}
          >
            {isSubmitting ? 'Processing...' : 'Continue'}
          </button>
        </div>
        </>
        )}
      </div>
    </div>
  )
}