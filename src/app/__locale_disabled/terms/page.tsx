import React from 'react';
import { prisma } from '@/lib/prisma';
import DynamicLegalPage from '@/components/DynamicLegalPage';

// Default content if not found in database
const defaultTermsContent = `
<div class="section">
  <h2>Agreement to Terms</h2>
  <p>By accessing and using DigitalPromoCodes ("we," "our," or "us"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.</p>
</div>

<div class="section">
  <h2>Use License</h2>
  <p>Permission is granted to temporarily download one copy of the materials on DigitalPromoCodes for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:</p>
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
    <li><strong>Information Accuracy:</strong> The materials on DigitalPromoCodes are provided on an 'as is' basis. We make no warranties, expressed or implied.</li>
    <li><strong>Third-Party Services:</strong> We are not responsible for the content, policies, or practices of third-party websites that we link to.</li>
    <li><strong>Promotion Availability:</strong> Promotions and discounts are subject to change without notice. We do not guarantee the availability or terms of any promotional offers.</li>
  </ul>
</div>

<div class="section">
  <h2>Responsible Use</h2>
  <p>DigitalPromoCodes promotes responsible use of digital products and services. We encourage users to:</p>
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
  <p>Email: <a href="mailto:digitalpromocodescontact@gmail.com">digitalpromocodescontact@gmail.com</a></p>
  <p>Website: <a href="../contact">Contact Form</a></p>
</div>
`;

interface TermsOfServiceProps {
  params: { locale: string };
}

export default async function TermsOfService({ params }: TermsOfServiceProps) {
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

  return (
    <DynamicLegalPage
      title={legalPage.title}
      content={legalPage.content}
      lastUpdated={legalPage.updatedAt}
    />
  );
} 