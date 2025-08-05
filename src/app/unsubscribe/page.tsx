'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function UnsubscribePage() {
  const [email, setEmail] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/mailing-list/unsubscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setEmail('')
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to unsubscribe' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to unsubscribe. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[600px]">
        <div className="space-y-8">
          {/* Back to Home */}
          <div className="mb-8">
            <Link
              href="/"
              className="inline-flex items-center font-medium hover:opacity-80 transition-opacity"
              style={{ color: 'var(--accent-color)' }}
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
          </div>

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r bg-clip-text text-transparent py-2" 
                style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))`, lineHeight: '1.3' }}>
              Unsubscribe from Mailing List
            </h1>
            <div className="w-20 h-1 mx-auto rounded-full mb-6" style={{ backgroundColor: 'var(--accent-color)' }}></div>
            <p className="text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              Sorry to see you go! Enter your email below to unsubscribe from our mailing list.
            </p>
          </div>

          {/* Unsubscribe Form */}
          <div className="rounded-2xl shadow-lg p-8 border" 
               style={{ 
                 backgroundColor: 'var(--card-bg)', 
                 borderColor: 'var(--card-border)',
                 boxShadow: 'var(--promo-shadow)'
               }}>
            
            {message && (
              <div className={`p-4 rounded-lg mb-6 ${
                message.type === 'success' 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-200 border border-green-200 dark:border-green-800' 
                  : 'bg-red-50 dark:bg-red-900/20 text-red-800 dark:text-red-200 border border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center">
                  {message.type === 'success' ? (
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5 mr-3" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  )}
                  {message.text}
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                  Email Address *
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                  style={{ 
                    backgroundColor: 'var(--background-color)', 
                    borderColor: 'var(--card-border)',
                    color: 'var(--text-color)'
                  }}
                  placeholder="Enter the email address to unsubscribe"
                  required
                  disabled={isSubmitting}
                />
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  We'll remove this email from all future mailings
                </p>
              </div>

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-3 rounded-lg font-medium transition-colors disabled:opacity-50"
                  style={{ 
                    backgroundColor: 'var(--accent-color)', 
                    color: 'white'
                  }}
                >
                  {isSubmitting ? 'Unsubscribing...' : 'Unsubscribe'}
                </button>
              </div>
            </form>

            {/* Privacy Notice */}
            <div className="mt-8 pt-6 border-t" style={{ borderColor: 'var(--border-color)' }}>
              <div className="text-sm space-y-2" style={{ color: 'var(--text-muted)' }}>
                <p><strong>Privacy Notice:</strong></p>
                <ul className="list-disc list-inside space-y-1 ml-4">
                  <li>Your email will be removed from our mailing list within 48 hours</li>
                  <li>You may still receive emails that were already in transit</li>
                  <li>You can resubscribe at any time through our website</li>
                  <li>We respect your privacy and will not share your information</li>
                </ul>
              </div>
            </div>
          </div>

          {/* Contact Info */}
          <div className="text-center">
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
              Having trouble? Contact us at{' '}
              <a 
                href="mailto:whpcodes@gmail.com" 
                className="hover:opacity-80 transition-opacity"
                style={{ color: 'var(--accent-color)' }}
              >
                whpcodes@gmail.com
              </a>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}