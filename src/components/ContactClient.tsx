'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/contexts/LanguageContext';

export default function ContactClient() {
  const { t } = useLanguage();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    subject: '',
    message: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'success' | 'error'>('idle');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus('idle');

    try {
      const response = await fetch('/api/contact', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit contact form');
      }

      setSubmitStatus('success');
      setFormData({ name: '', email: '', subject: '', message: '' });
    } catch (error) {
      console.error('Contact form submission error:', error);
      setSubmitStatus('error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[1000px]">
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center transition-colors duration-200 hover:opacity-80"
            style={{ color: 'var(--accent-color)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-2">
              <path d="M19 12H5"/>
              <path d="M12 19l-7-7 7-7"/>
            </svg>
            {t('contact.backToHome')}
          </Link>

          <h1 className="text-4xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>{t('contact.title')}</h1>
          <p className="text-lg" style={{ color: 'var(--text-secondary)' }}>
            {t('contact.subtitle')}
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
          {/* Contact Form */}
          <div>
            <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>{t('contact.sendMessage')}</h2>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="name" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                  {t('contact.name')} *
                </label>
                <input
                  type="text"
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-opacity-50 transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)',
                    ':focus': { borderColor: 'var(--accent-color)' }
                  }}
                  placeholder={t('contact.name')}
                />
              </div>

              <div>
                <label htmlFor="email" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                  {t('contact.email')} *
                </label>
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-opacity-50 transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)',
                    ':focus': { borderColor: 'var(--accent-color)' }
                  }}
                  placeholder={t('contact.email')}
                />
              </div>

              <div>
                <label htmlFor="subject" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                  {t('contact.subject')} *
                </label>
                <input
                  type="text"
                  id="subject"
                  name="subject"
                  value={formData.subject}
                  onChange={handleChange}
                  required
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-opacity-50 transition-colors duration-200"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)',
                    ':focus': { borderColor: 'var(--accent-color)' }
                  }}
                  placeholder={t('contact.subject')}
                />
              </div>

              <div>
                <label htmlFor="message" className="block text-sm font-medium mb-2" style={{ color: 'var(--text-color)' }}>
                  {t('contact.message')} *
                </label>
                <textarea
                  id="message"
                  name="message"
                  value={formData.message}
                  onChange={handleChange}
                  required
                  rows={6}
                  className="w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-1 focus:ring-opacity-50 transition-colors duration-200 resize-vertical"
                  style={{
                    backgroundColor: 'var(--background-secondary)',
                    borderColor: 'var(--border-color)',
                    color: 'var(--text-color)',
                    ':focus': { borderColor: 'var(--accent-color)' }
                  }}
                  placeholder={t('contact.message')}
                />
              </div>

              {submitStatus === 'success' && (
                <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(var(--success-color-rgb), 0.1)', borderColor: 'rgba(var(--success-color-rgb), 0.2)' }}>
                  <p className="text-sm" style={{ color: 'var(--success-color)' }}>
                    ✓ {t('contact.successMessage')}
                  </p>
                </div>
              )}

              {submitStatus === 'error' && (
                <div className="border rounded-lg p-4" style={{ backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: 'rgba(239, 68, 68, 0.2)' }}>
                  <p className="text-sm" style={{ color: '#ef4444' }}>
                    ✗ {t('contact.errorMessage')}
                  </p>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full font-semibold py-3 px-6 rounded-lg transition-colors duration-200 disabled:cursor-not-allowed hover:opacity-90"
                style={{
                  backgroundColor: 'var(--accent-color)',
                  color: 'white',
                  opacity: isSubmitting ? 0.5 : 1
                }}
              >
                {isSubmitting ? t('common.loading') : t('contact.send')}
              </button>
            </form>
          </div>

          {/* Contact Information */}
          <div>
            <h2 className="text-2xl font-semibold mb-6" style={{ color: 'var(--text-color)' }}>{t('contact.getInTouch')}</h2>

            <div className="space-y-6">
              <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--accent-color-rgb), 0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/>
                      <polyline points="22,6 12,13 2,6"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-color)' }}>{t('contact.emailSupport')}</h3>
                    <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {t('contact.emailSupportDesc')}
                    </p>
                    <a
                      href="mailto:whpcodes@gmail.com"
                      className="transition-colors duration-200 hover:opacity-80"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      whpcodes@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--accent-color-rgb), 0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/>
                      <rect x="8" y="2" width="8" height="4" rx="1" ry="1"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-color)' }}>{t('contact.businessInquiries')}</h3>
                    <p className="mb-2" style={{ color: 'var(--text-secondary)' }}>
                      {t('contact.businessInquiriesDesc')}
                    </p>
                    <a
                      href="mailto:whpcodes@gmail.com"
                      className="transition-colors duration-200 hover:opacity-80"
                      style={{ color: 'var(--accent-color)' }}
                    >
                      whpcodes@gmail.com
                    </a>
                  </div>
                </div>
              </div>

              <div className="rounded-xl p-6 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'rgba(var(--accent-color-rgb), 0.1)' }}>
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/>
                      <polyline points="12,6 12,12 16,14"/>
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--text-color)' }}>{t('contact.responseTime')}</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>
                      {t('contact.responseTimeDesc')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-8">
              <h3 className="text-xl font-semibold mb-4" style={{ color: 'var(--text-color)' }}>{t('contact.faqTitle')}</h3>
              <div className="space-y-4">
                <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                  <h4 className="font-semibold mb-2" style={{ color: 'var(--accent-color)' }}>{t('contact.faq1Question')}</h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('contact.faq1Answer')}
                  </p>
                </div>

                <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                  <h4 className="font-semibold mb-2" style={{ color: 'var(--accent-color)' }}>{t('contact.faq2Question')}</h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('contact.faq2Answer')}
                  </p>
                </div>

                <div className="rounded-lg p-4 border" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
                  <h4 className="font-semibold mb-2" style={{ color: 'var(--accent-color)' }}>{t('contact.faq3Question')}</h4>
                  <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                    {t('contact.faq3Answer')}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
