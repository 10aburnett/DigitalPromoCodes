import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-origin';
import ContactClient from '@/components/ContactClient';

// SSG configuration - form is client component but page shell is static
export const dynamic = 'force-static'
export const fetchCache = 'force-cache'
export const revalidate = 86400 // 24h

export const metadata: Metadata = {
  title: 'Contact WHPCodes - Get in Touch for Whop Promo Codes & Support',
  description: 'Contact WHPCodes for questions about Whop promo codes, partnerships, or support. We respond within 24-48 hours to all inquiries.',
  alternates: {
    canonical: `${siteOrigin()}/contact`,
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
    title: 'Contact WHPCodes - Get in Touch for Whop Promo Codes & Support',
    description: 'Contact WHPCodes for questions about Whop promo codes, partnerships, or support. We respond within 24-48 hours to all inquiries.',
    url: `${siteOrigin()}/contact`,
    type: 'website',
    siteName: 'WHPCodes',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Contact WHPCodes - Get in Touch for Whop Promo Codes & Support',
    description: 'Contact WHPCodes for questions about Whop promo codes, partnerships, or support. We respond within 24-48 hours to all inquiries.',
  },
};

export default function ContactPage() {
  const origin = siteOrigin();

  return (
    <>
      {/* ContactPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "ContactPage",
            name: "Contact WHPCodes",
            url: `${origin}/contact`,
            mainEntity: {
              "@type": "Organization",
              name: "WHPCodes",
              url: origin,
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                email: "whpcodes@gmail.com",
                url: `${origin}/contact`
              }
            }
          })
        }}
      />

      <ContactClient />
    </>
  );
}
