const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

const legalPages = [
  {
    slug: 'privacy',
    title: 'Privacy Policy',
    content: `
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
    <li><strong>Provide Services:</strong> To operate and maintain our website and provide whop product information</li>
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
    <li><strong>Affiliate Partners:</strong> When you click on whop links, you may be redirected to our affiliate partners</li>
    <li><strong>Service Providers:</strong> With trusted third-party services that help us operate our website</li>
    <li><strong>Legal Requirements:</strong> When required by law or to protect our rights</li>
    <li><strong>Business Transfers:</strong> In connection with a merger, sale, or transfer of assets</li>
  </ul>
</div>

<div class="section">
  <h2>Cookies and Tracking</h2>
  <p>We use cookies and similar technologies to:</p>
  <ul>
    <li>Remember your preferences</li>
    <li>Analyze website traffic and usage</li>
    <li>Provide personalized content</li>
    <li>Track affiliate referrals</li>
  </ul>
  <p>You can control cookies through your browser settings, but disabling them may affect website functionality.</p>
</div>

<div class="section">
  <h2>Data Security</h2>
  <p>We implement appropriate security measures to protect your information, including:</p>
  <ul>
    <li>SSL encryption for data transmission</li>
    <li>Secure hosting infrastructure</li>
    <li>Regular security updates and monitoring</li>
    <li>Limited access to personal information</li>
  </ul>
</div>

<div class="section">
  <h2>Your Rights</h2>
  <p>You have the right to:</p>
  <ul>
    <li>Access your personal information</li>
    <li>Correct inaccurate information</li>
    <li>Request deletion of your information</li>
    <li>Opt-out of marketing communications</li>
    <li>Object to processing of your information</li>
  </ul>
</div>

<div class="section">
  <h2>Contact Us</h2>
  <p>If you have any questions about this Privacy Policy or our data practices, please contact us:</p>
  <p>Email: <a href="mailto:digitalpromocodescontact@gmail.com">digitalpromocodescontact@gmail.com</a></p>
  <p>Website: <a href="../contact">Contact Form</a></p>
</div>
`
  },
  {
    slug: 'terms',
    title: 'Terms of Service',
    content: `
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
    <li><strong>Third-Party Services:</strong> We are not responsible for the content, policies, or practices of third-party whop websites that we link to.</li>
    <li><strong>Promotion Availability:</strong> Whop promotions and discounts are subject to change without notice. We do not guarantee the availability or terms of any promotional offers.</li>
  </ul>
</div>

<div class="section">
  <h2>Responsible Use</h2>
  <p>DigitalPromoCodes promotes responsible use of digital products and services. We encourage users to:</p>
  <ul>
    <li>Only purchase products and services you can afford</li>
    <li>Research products thoroughly before purchasing</li>
    <li>Read terms and conditions of whop products carefully</li>
    <li>Contact whop providers directly for product support</li>
  </ul>
  <p>If you have concerns about any whop product or service, please contact the provider directly or reach out to us through our contact form.</p>
</div>

<div class="section">
  <h2>Contact Information</h2>
  <p>If you have any questions about these Terms of Service, please contact us:</p>
  <p>Email: <a href="mailto:digitalpromocodescontact@gmail.com">digitalpromocodescontact@gmail.com</a></p>
  <p>Website: <a href="../contact">Contact Form</a></p>
</div>
`
  }
];

async function main() {
  console.log('Seeding pages...');
  
  for (const page of legalPages) {
    const result = await prisma.legalPage.upsert({
      where: { slug: page.slug },
      update: {
        title: page.title,
        content: page.content
      },
      create: {
        slug: page.slug,
        title: page.title,
        content: page.content
      }
    });
    
    console.log(`✓ ${result.title} (${result.slug})`);
  }
  
  console.log('Pages seeded successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 