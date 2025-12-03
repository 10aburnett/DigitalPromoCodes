import React from 'react';
import type { Metadata } from 'next';
import { prisma } from '@/lib/prisma';
import DynamicLegalPage from '@/components/DynamicLegalPage';
import { siteOrigin } from '@/lib/site-origin';
import { SITE_BRAND } from '@/lib/brand';

// SSG configuration
export const dynamic = 'force-static'
export const fetchCache = 'force-cache'
export const revalidate = 86400 // 24h

export const metadata: Metadata = {
  title: `Terms of Service - ${SITE_BRAND}`,
  description: `Read the terms and conditions for using ${SITE_BRAND} deals platform and our affiliate services.`,
  alternates: {
// PHASE1-DEINDEX:     canonical: `${siteOrigin()}/terms`,
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
    title: `Terms of Service - ${SITE_BRAND}`,
    description: `Read the terms and conditions for using ${SITE_BRAND} deals platform and our affiliate services.`,
    url: `${siteOrigin()}/terms`,
    type: 'website',
    siteName: SITE_BRAND,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Terms of Service - ${SITE_BRAND}`,
    description: `Read the terms and conditions for using ${SITE_BRAND} deals platform and our affiliate services.`,
  },
};

// Default content if not found in database
const defaultTermsContent = `
<div class="section">
  <h2>Agreement to Terms</h2>
          <p>By accessing and using this website ("we," "our," or "us"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
</div>

<div class="section">
  <h2>Use License</h2>
          <p>Permission is granted to temporarily download one copy of the materials on this website for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
  <ul>
    <li>Modify or copy the materials</li>
    <li>Use the materials for any commercial purpose or for any public display</li>
    <li>Attempt to reverse engineer any software contained on the website</li>
    <li>Remove any copyright or other proprietary notations from the materials</li>
  </ul>
</div>

<div class="section">
  <h2>Disclaimer</h2>
  <ul>
    <li><strong>Information Accuracy:</strong> The materials on this website are provided on an 'as is' basis. We make no warranties, expressed or implied.</li>
    <li><strong>Third-Party Services:</strong> We are not responsible for the content, policies, or practices of third-party websites that we link to.</li>
    <li><strong>Promotion Availability:</strong> Promotions and discounts are subject to change without notice. We do not guarantee the availability or terms of any promotional offers.</li>
  </ul>
</div>

<div class="section">
  <h2>Responsible Use</h2>
  <p>We promote responsible use of digital products and services. We encourage users to:</p>
  <ul>
    <li>Only purchase products and services you can afford</li>
    <li>Research products thoroughly before purchasing</li>
    <li>Read terms and conditions of products carefully</li>
    <li>Contact providers directly for product support</li>
  </ul>
  <p>If you have concerns about any product or service, please contact the provider directly or reach out to us through our contact form.</p>
</div>

<div class="section">
  <h2>Contact Information</h2>
  <p>If you have any questions about these Terms of Service, please contact us:</p>
  <p>Website: <a href="/contact">Contact Form</a></p>
</div>
`;

export default async function TermsOfService() {
  let legalPage;

  try {
    legalPage = await prisma.legalPage.findUnique({
      where: { slug: 'terms' }
    });
  } catch (error) {
    console.error('Error fetching terms of service:', error);
  }

  // If no page found in database, use default content
  if (!legalPage) {
    legalPage = {
      title: 'Terms of Service',
      content: defaultTermsContent,
      updatedAt: new Date().toISOString()
    };
  }

  const origin = siteOrigin();

  return (
    <>
      {/* WebPage Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebPage",
            name: "Terms of Service",
            description: `Read the terms and conditions for using ${SITE_BRAND} platform.`,
            url: `${origin}/terms`,
            mainEntity: {
              "@type": "Organization",
              name: SITE_BRAND,
              url: origin
            }
          })
        }}
      />

      <DynamicLegalPage
        title={legalPage.title}
        content={legalPage.content}
        lastUpdated={legalPage.updatedAt}
      />
    </>
  );
} 