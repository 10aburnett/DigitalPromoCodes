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
  title: `Privacy Policy - ${SITE_BRAND}`,
  description: `Learn how ${SITE_BRAND} collects, uses, and protects your information when you use our deals platform.`,
  alternates: {
// PHASE1-DEINDEX:     canonical: `${siteOrigin()}/privacy`,
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
    title: `Privacy Policy - ${SITE_BRAND}`,
    description: `Learn how ${SITE_BRAND} collects, uses, and protects your information when you use our deals platform.`,
    url: `${siteOrigin()}/privacy`,
    type: 'website',
    siteName: SITE_BRAND,
  },
  twitter: {
    card: 'summary_large_image',
    title: `Privacy Policy - ${SITE_BRAND}`,
    description: `Learn how ${SITE_BRAND} collects, uses, and protects your information when you use our deals platform.`,
  },
};

// Default content if not found in database
const defaultPrivacyContent = `
<div class="section">
  <h2>Introduction</h2>
          <p>We are committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website and use our services.</p>
</div>

<div class="section">
  <h2>Information We Collect</h2>
  
  <h3>Information You Provide</h3>
  <ul>
    <li>Contact information when you reach out to us</li>
    <li>Feedback and comments you submit</li>
    <li>Newsletter subscription information</li>
  </ul>

  <h3>Information Automatically Collected</h3>
  <ul>
    <li>Browser type and version</li>
    <li>Device information</li>
    <li>Pages visited and time spent on our site</li>
    <li>Referring website information</li>
    <li>Cookies and similar tracking technologies</li>
  </ul>
</div>

<div class="section">
  <h2>How We Use Your Information</h2>
  <ul>
    <li><strong>Provide Services:</strong> To operate and maintain our website and provide product information</li>
    <li><strong>Improve Experience:</strong> To analyze usage patterns and improve our content and user experience</li>
    <li><strong>Communication:</strong> To respond to your inquiries and send important updates</li>
    <li><strong>Analytics:</strong> To track website performance and user engagement</li>
    <li><strong>Legal Compliance:</strong> To comply with applicable laws and regulations</li>
  </ul>
</div>

<div class="section">
  <h2>Information Sharing</h2>
  <p>We do not sell, trade, or rent your personal information. We may share information in the following circumstances:</p>
  <ul>
    <li><strong>Affiliate Partners:</strong> When you click on offer links, you may be redirected to our affiliate partners</li>
    <li><strong>Service Providers:</strong> With trusted third-party services that help us operate our website</li>
    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
    <li><strong>Business Transfers:</strong> In connection with a merger, sale, or transfer of assets</li>
  </ul>
</div>

<div class="section">
  <h2>Contact Us</h2>
  <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
  <p>Website: <a href="/contact">Contact Form</a></p>
</div>
`;

export default async function PrivacyPolicy() {
  let legalPage;

  try {
    legalPage = await prisma.legalPage.findUnique({
      where: { slug: 'privacy' }
    });
  } catch (error) {
    console.error('Error fetching privacy policy:', error);
  }

  // If no page found in database, use default content
  if (!legalPage) {
    legalPage = {
      title: 'Privacy Policy',
      content: defaultPrivacyContent,
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
            name: "Privacy Policy",
            description: `Learn how ${SITE_BRAND} collects, uses, and protects your information.`,
            url: `${origin}/privacy`,
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