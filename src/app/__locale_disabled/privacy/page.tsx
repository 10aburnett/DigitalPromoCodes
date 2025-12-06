import React from 'react';
import { prisma } from '@/lib/prisma';
import DynamicLegalPage from '@/components/DynamicLegalPage';
import { notFound } from 'next/navigation';

// Default content if not found in database
const defaultPrivacyContent = `
<div class="section">
  <h2>Introduction</h2>
  <p>DigitalPromoCodes ("we," "our," or "us") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you visit our website digitalpromocodes.com and use our services.</p>
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
    <li><strong>Affiliate Partners:</strong> When you click on product links, you may be redirected to our affiliate partners</li>
    <li><strong>Service Providers:</strong> With trusted third-party services that help us operate our website</li>
    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
    <li><strong>Business Transfers:</strong> In connection with a merger, sale, or transfer of assets</li>
  </ul>
</div>

<div class="section">
  <h2>Contact Us</h2>
  <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
  <p>Email: <a href="mailto:digitalpromocodescontact@gmail.com">digitalpromocodescontact@gmail.com</a></p>
  <p>Website: <a href="../contact">Contact Form</a></p>
</div>
`;

interface PrivacyPolicyProps {
  params: { locale: string };
}

export default async function PrivacyPolicy({ params }: PrivacyPolicyProps) {
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

  return (
    <DynamicLegalPage
      title={legalPage.title}
      content={legalPage.content}
      lastUpdated={legalPage.updatedAt}
    />
  );
} 