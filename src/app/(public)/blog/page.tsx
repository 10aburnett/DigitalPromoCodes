import type { Metadata } from 'next'
import Link from 'next/link'
import { getPublishedBlogPosts } from '@/lib/blog'

// SSG + ISR configuration
export const dynamic = 'force-static'
export const revalidate = 3600 // 1 hour
export const fetchCache = 'force-cache'
export const runtime = 'nodejs' // Required for Prisma

const currentYear = new Date().getFullYear()

export const metadata: Metadata = {
  title: `WHP Blog - Latest Whop Promo Codes, Tips & Digital Product Insights ${currentYear}`,
  description: `Discover the latest Whop promo codes, digital product reviews, exclusive deals, and insider tips for ${currentYear}. Stay updated with the newest discounts and insights from the world of digital products and online communities.`,
  keywords: `WHP blog, Whop promo codes ${currentYear}, digital products, online courses, Discord communities, exclusive deals, promo code tips, digital marketplace insights`,
  alternates: {
    canonical: 'https://whpcodes.com/blog'
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
    title: `WHP Blog - Latest Whop Promo Codes & Digital Product Insights ${currentYear}`,
    description: `Your source for the latest Whop promo codes, exclusive deals, and digital product insights for ${currentYear}. Get insider tips and discover new opportunities in the digital marketplace.`,
    type: 'website',
    url: 'https://whpcodes.com/blog'
  },
  twitter: {
    card: 'summary_large_image',
    title: `WHP Blog - Latest Whop Promo Codes & Digital Product Insights ${currentYear}`,
    description: `Your source for the latest Whop promo codes, exclusive deals, and digital product insights for ${currentYear}. Get insider tips and discover new opportunities in the digital marketplace.`
  }
}

export default async function BlogPage() {
  try {
    const posts = await getPublishedBlogPosts();

    if (!posts.length) {
      return (
        <div className="min-h-screen py-8 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
          <div className="mx-auto w-[90%] md:w-[95%] max-w-[1200px]">
            <div className="space-y-6">
              {/* Header */}
              <div className="text-center">
                <h1 className="text-4xl md:text-5xl font-bold py-1" 
                    style={{ lineHeight: '1.3', marginBottom: '0.6rem' }}>
                  <span style={{ color: 'var(--accent-color)' }}>WHP</span>
                  <span className="ml-2" style={{ color: 'var(--text-color)' }}>
                    Blog
                  </span>
                </h1>
                <div className="w-20 h-1 mx-auto rounded-full" style={{ backgroundColor: 'var(--accent-color)' }}></div>
              </div>

              <div className="text-center -mt-2">
                <p className="text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                  Stay updated with the latest insights, tips, and Whop news.
                </p>
              </div>

              <div className="text-center py-16">
                <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/20 dark:to-purple-900/20 p-8 rounded-lg border border-blue-200 dark:border-blue-800">
                  <p className="text-lg text-gray-900 dark:text-white">No blog posts published yet.</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // Build JSON-LD CollectionPage schema for SEO
    const jsonLd = {
      '@context': 'https://schema.org',
      '@type': 'CollectionPage',
      name: 'WHP Blog',
      description: `Latest posts and guides on Whop promo codes and digital products in ${currentYear}.`,
      url: 'https://whpcodes.com/blog',
      hasPart: posts.slice(0, 20).map((p) => ({
        '@type': 'BlogPosting',
        headline: p.title,
        datePublished: p.publishedAt?.toISOString?.() ?? undefined,
        dateModified: p.updatedAt?.toISOString?.() ?? undefined,
        url: `https://whpcodes.com/blog/${p.slug}`,
        author: {
          '@type': 'Person',
          name: (p as any).User?.name || (p as any).authorName || 'WHP Team'
        }
      })),
    };

    return (
      <div className="min-h-screen py-8 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
        {/* Server-rendered JSON-LD for blog collection */}
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

        <div className="mx-auto w-[90%] md:w-[95%] max-w-[1200px]">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold py-1"
                  style={{ lineHeight: '1.3', marginBottom: '0.6rem' }}>
                <span style={{ color: 'var(--accent-color)' }}>WHP</span>
                <span className="ml-2" style={{ color: 'var(--text-color)' }}>
                  Blog
                </span>
              </h1>
              <div className="w-20 h-1 mx-auto rounded-full" style={{ backgroundColor: 'var(--accent-color)' }}></div>
            </div>

            <div className="text-center -mt-2">
              <p className="text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Stay updated with the latest insights, tips, and Whop news.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {posts.map((post) => (
                <Link key={post.id} href={`/blog/${post.slug}`}>
                  <article
                    className="blog-card rounded-2xl shadow-lg hover:shadow-2xl transition-all duration-300 overflow-hidden group border cursor-pointer relative"
                    style={{ 
                      borderColor: 'var(--card-border)',
                      boxShadow: 'var(--promo-shadow)'
                    }}
                  >
                    {post.pinned && (
                      <div className="absolute top-4 right-4 text-yellow-500 text-xl">
                        📌
                      </div>
                    )}
                    <div className="blog-card-content p-8">
                      <div className="flex flex-col h-full">
                        <div className="mb-4">
                          <time className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            {post.publishedAt ? new Date(post.publishedAt).toLocaleDateString('en-US', {
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            }) : ''}
                          </time>
                        </div>
                        
                        <h2 className="blog-card-title text-2xl font-bold mb-4 group-hover:opacity-80 transition-colors" style={{ color: 'var(--text-color)' }}>
                          {post.title}
                        </h2>
                        
                        {post.excerpt && (
                          <p className="blog-card-excerpt mb-6" style={{ color: 'var(--text-secondary)' }}>
                            {post.excerpt}
                          </p>
                        )}
                        
                        <div className="flex items-center justify-between mt-auto">
                          <span
                            className="blog-accent inline-flex items-center font-medium group-hover:opacity-80 transition-opacity"
                          >
                            Read More
                            <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                          </span>
                          
                          <span className="text-sm" style={{ color: 'var(--text-muted)' }}>
                            By {post.author?.name ?? 'Unknown'}
                          </span>
                        </div>
                      </div>
                    </div>
                  </article>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  } catch (err) {
    console.error('Blog page load failed:', err);
    return (
      <div className="min-h-screen py-8 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
        <div className="mx-auto w-[90%] md:w-[95%] max-w-[1200px]">
          <div className="space-y-6">
            {/* Header */}
            <div className="text-center">
              <h1 className="text-4xl md:text-5xl font-bold py-1" 
                  style={{ lineHeight: '1.3', marginBottom: '0.6rem' }}>
                <span style={{ color: 'var(--accent-color)' }}>WHP</span>
                <span className="ml-2" style={{ color: 'var(--text-color)' }}>
                  Blog
                </span>
              </h1>
              <div className="w-20 h-1 mx-auto rounded-full" style={{ backgroundColor: 'var(--accent-color)' }}></div>
            </div>

            <div className="text-center -mt-2">
              <p className="text-xl leading-relaxed max-w-2xl mx-auto" style={{ color: 'var(--text-secondary)' }}>
                Stay updated with the latest insights, tips, and Whop news.
              </p>
            </div>

            <div className="text-center py-16">
              <div className="p-8 rounded-lg border" style={{ 
                backgroundColor: 'var(--background-secondary)', 
                borderColor: 'var(--border-color)' 
              }}>
                <div className="mb-4 text-6xl">⚠️</div>
                <h2 className="text-2xl font-bold mb-4" style={{ color: 'var(--text-color)' }}>
                  Unable to Load Blog Posts
                </h2>
                <p className="text-lg mb-6" style={{ color: 'var(--text-secondary)' }}>
                  We&apos;re experiencing technical difficulties. Please try again in a few moments.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}