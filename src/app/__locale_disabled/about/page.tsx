import React from 'react';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'About Us - DigitalPromoCodes',
  description: 'Learn about DigitalPromoCodes - your go-to hub for exclusive promo codes, discounts, and digital product insights. We curate 8,000+ verified listings with daily updates.',
  keywords: ['about digitalpromocodes', 'promo codes', 'digital product discounts', 'affiliate', 'product reviews'],
  openGraph: {
    title: 'About Us - DigitalPromoCodes',
    description: 'Learn about DigitalPromoCodes - your go-to hub for exclusive promo codes, discounts, and digital product insights.',
    url: 'https://digitalpromocodes.com/about',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About Us - DigitalPromoCodes',
    description: 'Learn about DigitalPromoCodes - your go-to hub for exclusive promo codes, discounts, and digital product insights.',
  },
};

export default function AboutPage() {
  return (
    <div className="min-h-screen py-12 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-[800px]">
        <div className="space-y-8">
          {/* Header */}
          <div className="text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-4 bg-gradient-to-r bg-clip-text text-transparent leading-tight"
                style={{ backgroundImage: `linear-gradient(to right, var(--text-color), var(--text-secondary))` }}>
              About Us
            </h1>
            <div className="w-20 h-1 mx-auto rounded-full" style={{ backgroundColor: 'var(--accent-color)' }}></div>
          </div>

          {/* Main Content */}
          <div className="prose prose-lg max-w-none space-y-6" style={{ color: 'var(--text-color)' }}>
            <div className="text-center mb-8">
              <p className="text-xl leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Welcome to <strong style={{ color: 'var(--accent-color)' }}>DigitalPromoCodes</strong> — your go-to hub for exclusive promo codes, discounts, and digital product insights.
              </p>
            </div>

            <div className="space-y-6">
              <p className="text-lg leading-relaxed">
                We curate and maintain one of the largest collections of verified digital product offers online, helping you save money on premium courses, tools, and digital communities. Whether you're a trader, entrepreneur, or digital learner, we've got codes that unlock real value — without the guesswork.
              </p>

              <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                <h2 className="text-2xl font-bold mb-4 text-center" style={{ color: 'var(--accent-color)' }}>
                  Our Mission
                </h2>
                <p className="text-xl text-center font-medium" style={{ color: 'var(--text-color)' }}>
                  Make premium digital products more affordable and transparent.
                </p>
              </div>

              <div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
                  What sets us apart?
                </h2>

                <div className="grid gap-4">
                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 mt-1">
                      <svg className="w-6 h-6" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <strong>8,000+ curated listings</strong>, organised for easy navigation
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 mt-1">
                      <svg className="w-6 h-6" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <strong>Daily updates</strong> to keep codes fresh and active
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 mt-1">
                      <svg className="w-6 h-6" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <strong>No misleading offers</strong> — every listing includes product summaries, pricing details, and our honest take
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 mt-1">
                      <svg className="w-6 h-6" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <strong>Affiliate transparency</strong> — we earn a commission when you use our links, at no extra cost to you
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                <p className="text-lg leading-relaxed mb-4">
                  We're independent curators and affiliates who use our experience to help others navigate the fast-growing world of online learning and mentorship.
                </p>
              </div>

              <div className="text-center p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                <p className="text-xl font-semibold" style={{ color: 'var(--text-color)' }}>
                  If you're tired of wasting time hunting for working promo codes, welcome home.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
