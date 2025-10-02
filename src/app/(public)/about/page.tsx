import React from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { siteOrigin } from '@/lib/site-origin';

// SSG configuration
export const dynamic = 'force-static'
export const fetchCache = 'force-cache'
export const revalidate = 86400 // 24h

export const metadata: Metadata = {
  title: 'About WHPCodes - Best Whop Promo Codes & Digital Product Discounts',
  description: 'Learn about WHPCodes - your trusted source for verified Whop promo codes, discount codes, and exclusive digital product deals. We curate 8,000+ verified Whop listings with daily updates.',
  keywords: 'about whpcodes, whop promo codes, whop discount codes, digital course discounts, whop affiliate, course reviews, verified promo codes, whop coupons',
  alternates: {
    canonical: `${siteOrigin()}/about`,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      'max-image-preview': 'large',
      'max-snippet': -1,
      'max-video-preview': -1,
    }
  },
  openGraph: {
    title: 'About WHPCodes - Best Whop Promo Codes & Digital Product Discounts',
    description: 'Learn about WHPCodes - your trusted source for verified Whop promo codes, discount codes, and exclusive digital product deals. We curate 8,000+ verified Whop listings with daily updates.',
    url: `${siteOrigin()}/about`,
    type: 'website',
    siteName: 'WHPCodes',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'About WHPCodes - Best Whop Promo Codes & Digital Product Discounts',
    description: 'Learn about WHPCodes - your trusted source for verified Whop promo codes, discount codes, and exclusive digital product deals. We curate 8,000+ verified Whop listings with daily updates.',
  },
};

export default function AboutPage() {
  const origin = siteOrigin();

  return (
    <>
      {/* Organization Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: "WHPCodes",
            url: origin,
            logo: `${origin}/logo.png`,
            contactPoint: { "@type": "ContactPoint", contactType: "customer service", url: `${origin}/contact` }
          })
        }}
      />

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
                Welcome to <strong style={{ color: 'var(--accent-color)' }}>WHPCodes</strong> — your go-to hub for exclusive Whop promo codes, discounts, and course insights. Check out our <Link href="/blog" className="underline hover:opacity-80" style={{ color: 'var(--accent-color)' }}>latest blog posts</Link> or <Link href="/contact" className="underline hover:opacity-80" style={{ color: 'var(--accent-color)' }}>get in touch</Link>.
              </p>
            </div>

            <section className="about-v2">
              <div className="space-y-6">
                <p className="text-lg leading-relaxed">
                  We curate and maintain one of the largest collections of verified Whop affiliate offers online, helping you save money on premium courses, tools, and digital communities. Whether you're a trader, entrepreneur, or digital learner, we've got codes that unlock real value — without the guesswork.
                </p>

                <div className="about-card bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-6 rounded-lg border border-blue-200 dark:border-blue-800">
                  <h2 className="about-heading text-2xl font-bold mb-4 text-center text-gray-900" style={{ color: 'var(--accent-color)' }}>
                    Our Mission
                  </h2>
                  <p className="about-copy-white text-xl text-center font-medium text-gray-900">
                    Make Whop more affordable and transparent.
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
                      <strong>8,000+ curated Whop listings</strong>, organised for easy navigation
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
                      <strong>No misleading offers</strong> — every listing includes course summaries, pricing details, and our honest take
                    </div>
                  </div>

                  <div className="flex items-start space-x-3">
                    <div className="flex-shrink-0 w-6 h-6 mt-1">
                      <svg className="w-6 h-6" style={{ color: 'var(--accent-color)' }} fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                      </svg>
                    </div>
                    <div>
                      <strong>Affiliate transparency</strong> — we earn a commission from Whop when you use our links, at no extra cost to you
                    </div>
                  </div>
                </div>
              </div>

                <div className="about-card bg-gray-50 dark:bg-gray-900/50 p-6 rounded-lg border border-gray-200 dark:border-gray-800">
                  <p className="about-copy-muted text-lg leading-relaxed mb-4 text-gray-900">
                    We're not affiliated with Whop Inc. directly — we're independent curators and affiliates who use our experience to help others navigate the fast-growing world of online learning and mentorship.
                  </p>
                </div>

                <div className="about-card text-center p-6 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <p className="about-copy-white text-xl font-semibold text-gray-900">
                    If you're tired of wasting time hunting for working promo codes, welcome home.
                  </p>
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
    </>
  );
}