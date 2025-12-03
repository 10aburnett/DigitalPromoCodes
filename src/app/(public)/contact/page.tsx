import type { Metadata } from 'next';
import { siteOrigin } from '@/lib/site-origin';
import ContactClient from '@/components/ContactClient';
import { SITE_BRAND, CONTACT_EMAIL } from '@/lib/brand';

// SSG configuration - form is client component but page shell is static
export const dynamic = 'force-static'
export const fetchCache = 'force-cache'
export const revalidate = 86400 // 24h

const title = `Contact ${SITE_BRAND} - Get in Touch for Support & Partnerships`;
const description = `Contact ${SITE_BRAND} for questions about deals, partnerships, or support. We respond within 24-48 hours to all inquiries.`;

export const metadata: Metadata = {
  title,
  description,
  alternates: {
// PHASE1-DEINDEX:     canonical: `${siteOrigin()}/contact`,
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
    title,
    description,
    url: `${siteOrigin()}/contact`,
    type: 'website',
    siteName: SITE_BRAND,
  },
  twitter: {
    card: 'summary_large_image',
    title,
    description,
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
            "@id": `${origin}/contact#page`,
            name: `Contact ${SITE_BRAND}`,
            url: `${origin}/contact`,
            mainEntity: {
              "@type": "Organization",
              "@id": `${origin}#org`,
              name: SITE_BRAND,
              url: origin,
              contactPoint: {
                "@type": "ContactPoint",
                contactType: "customer service",
                email: CONTACT_EMAIL,
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
