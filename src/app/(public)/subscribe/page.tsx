'use client'
import { useState } from 'react'
import Link from 'next/link'

export default function SubscribePage() {
  const [formData, setFormData] = useState({
    email: '',
    name: ''
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    setMessage(null)

    try {
      const response = await fetch('/api/mailing-list/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          source: 'subscribe_page'
        })
      })

      const data = await response.json()

      if (response.ok) {
        setMessage({ type: 'success', text: data.message })
        setFormData({ email: '', name: '' })
      } else {
        setMessage({ type: 'error', text: data.error || 'Failed to subscribe' })
      }
    } catch (error) {
      setMessage({ type: 'error', text: 'Failed to subscribe. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[700px]">
        <div className="space-y-8">

          {/* Header */}
          <div className="text-center mb-12">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 py-2" 
                style={{ color: 'var(--text-color)', lineHeight: '1.3' }}>
              Join Our VIP List! <span style={{ fontFamily: 'Apple Color Emoji, Segoe UI Emoji, Noto Color Emoji, sans-serif' }}>🎉</span>
            </h1>
            <div className="w-20 h-1 mx-auto rounded-full mb-6" style={{ backgroundColor: 'var(--accent-color)' }}></div>
            <p className="text-lg leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>
              Get exclusive access to the <strong style={{ color: 'var(--accent-color)' }}>newest Whop promo codes</strong>, 
              insider tips, and deals before anyone else! Join thousands of savvy shoppers saving big.
            </p>

            {/* Benefits */}
            <div className="grid md:grid-cols-3 gap-6 mb-8">
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--accent-color)' }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M5 2a1 1 0 011 1v1h1a1 1 0 010 2H6v1a1 1 0 01-2 0V6H3a1 1 0 010-2h1V3a1 1 0 011-1zm0 10a1 1 0 011 1v1h1a1 1 0 110 2H6v1a1 1 0 11-2 0v-1H3a1 1 0 110-2h1v-1a1 1 0 011-1zM12 2a1 1 0 01.967.744L14.146 7.2 17.5 9.134a1 1 0 010 1.732L14.146 12.8l-1.179 4.456a1 1 0 01-1.934 0L9.854 12.8 6.5 10.866a1 1 0 010-1.732L9.854 7.2l1.179-4.456A1 1 0 0112 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                  Exclusive Codes
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Get promo codes not available anywhere else
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--accent-color)' }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                  Early Access
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Be the first to know about new deals and limited-time offers
                </p>
              </div>

              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
                     style={{ backgroundColor: 'var(--accent-color)' }}>
                  <svg className="w-8 h-8 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
                  </svg>
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                  Weekly Tips
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Insider strategies for maximizing your savings
                </p>
              </div>
            </div>
          </div>

          {/* Subscribe Form */}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                    Name *
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ 
                      backgroundColor: 'var(--background-color)', 
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-color)'
                    }}
                    placeholder="Your name"
                    required
                    disabled={isSubmitting}
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                    Email Address *
                  </label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                    className="w-full px-4 py-3 rounded-lg border focus:outline-none focus:ring-2 focus:ring-blue-500"
                    style={{ 
                      backgroundColor: 'var(--background-color)', 
                      borderColor: 'var(--card-border)',
                      color: 'var(--text-color)'
                    }}
                    placeholder="your@email.com"
                    required
                    disabled={isSubmitting}
                  />
                </div>
              </div>

              <div className="flex justify-center">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-8 py-4 rounded-lg font-medium text-lg transition-colors disabled:opacity-50 hover:opacity-90"
                  style={{ 
                    backgroundColor: 'var(--accent-color)', 
                    color: 'white'
                  }}
                >
                  {isSubmitting ? 'Joining...' : 'Join VIP List! 🚀'}
                </button>
              </div>

              <div className="text-center text-xs" style={{ color: 'var(--text-muted)' }}>
                We respect your privacy. Unsubscribe anytime with one click.
              </div>
            </form>
          </div>

          {/* Divider */}
          <div className="flex justify-center">
            <div className="w-full max-w-md h-px" style={{ backgroundColor: 'var(--border-color)' }}></div>
          </div>

          {/* FAQ Section */}
          <div className="rounded-2xl shadow-lg p-8 border" 
               style={{ 
                 backgroundColor: 'var(--card-bg)', 
                 borderColor: 'var(--card-border)',
                 boxShadow: 'var(--promo-shadow)'
               }}>
            <h2 className="text-2xl font-bold mb-6 text-center" style={{ color: 'var(--text-color)' }}>
              Frequently Asked Questions
            </h2>
            
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                  How often will I receive emails?
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  We send out weekly newsletters with the latest promo codes and deals. During special promotions, you might receive 2-3 emails per week.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                  Can I unsubscribe anytime?
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Absolutely! Every email contains an unsubscribe link, or you can visit our <Link href="/unsubscribe" style={{ color: 'var(--accent-color)' }}>unsubscribe page</Link> anytime.
                </p>
              </div>

              <div>
                <h3 className="font-semibold mb-2" style={{ color: 'var(--text-color)' }}>
                  Do you share my email with third parties?
                </h3>
                <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                  Never! We respect your privacy and will only use your email to send you our exclusive promo codes and updates.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}