import { notFound } from 'next/navigation';
import Link from 'next/link';
import { Metadata } from 'next';
import { normalizeImagePath } from '@/lib/image-utils';
import InitialsAvatar from '@/components/InitialsAvatar';
import WhopLogo from '@/components/WhopLogo';
import WhopReviewSection from '@/components/WhopReviewSection';
import RecommendedWhops from '@/components/RecommendedWhops';
import FAQSection from '@/components/FAQSection';
import WhopPageInteractive, { WhopPageCompactStats } from '@/components/WhopPageInteractive';
import PromoCodeSubmissionButton from '@/components/PromoCodeSubmissionButton';

interface PromoCode {
  id: string;
  title: string;
  description: string;
  code: string | null;
  type: string;
  value: string;
}

interface Review {
  id: string;
  author: string;
  content: string;
  rating: number;
  createdAt: string;
  verified: boolean;
}

interface Whop {
  id: string;
  name: string;
  whopName?: string;
  slug: string;
  logo: string | null;
  description: string;
  rating: number;
  affiliateLink: string | null;
  website: string | null;
  price: string | null;
  category: string | null;
  promoCodes: PromoCode[];
  reviews?: Review[];
}

async function getWhop(slug: string) {
  try {
    const response = await fetch(`${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/api/whops?slug=${slug}`, {
      cache: 'no-store'
    });
    
    if (!response.ok) {
      return null;
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching whop:', error);
    return null;
  }
}

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const whopData = await getWhop(params.slug);
  
  if (!whopData) {
    return {
      title: 'Whop Not Found',
      description: 'The requested whop could not be found.'
    };
  }

  // Determine indexing status based on database field
  let shouldIndex = true; // Default to index
  
  if (whopData.indexing === 'INDEX') {
    shouldIndex = true; // Force index
  } else if (whopData.indexing === 'NOINDEX') {
    shouldIndex = false; // Force noindex
  } else if (whopData.indexing === 'AUTO') {
    // Use automatic logic (fallback for existing system)
    const highTrafficCourses = [
      'Brez marketing ERT',
      'Remakeit.io creator', 
      'Interbank Trading Room',
      'Josh Exclusive VIP Access',
      'EquiFix',
      'LinkedIn Client Lab',
      'Lowkey Discord Membership',
      'Risen Consulting',
      'Learn to Trade Academy',
      'Royalty Hero Premium',
      'The Blue Vortex',
      'ThinkorSwim Blessing',
      'ThinkorSwim Master Scalper',
      'Korvato Gold Rush'
    ];

    const hasPromoCode = whopData.promoCodes && whopData.promoCodes.length > 0;
    const isHighTraffic = highTrafficCourses.some(course => 
      whopData.whopName.toLowerCase().includes(course.toLowerCase()) ||
      course.toLowerCase().includes(whopData.whopName.toLowerCase())
    );
    
    shouldIndex = hasPromoCode || isHighTraffic;
  }

  // Get current month and year for SEO
  const currentDate = new Date();
  const currentMonth = currentDate.toLocaleDateString('en-US', { month: 'long' });
  const currentYear = currentDate.getFullYear();
  const monthYear = `(${currentMonth} ${currentYear})`;

  const title = `${whopData.whopName} Promo Code ${monthYear}`;
  
  // Build dynamic meta description
  let description = '';
  const whopName = whopData.whopName;
  const promoCodes = whopData.promoCodes || [];
  const firstPromo = promoCodes[0];
  const price = whopData.price;
  const category = whopData.category;

  // Start with base call-to-action
  if (firstPromo && firstPromo.code) {
    // Has a promo code
    if (firstPromo.value && firstPromo.value !== '0' && firstPromo.value !== '') {
      // Has specific discount value
      const promoValueText = firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off') 
        ? firstPromo.value 
        : `${firstPromo.value}% off`;
      description = `Get ${promoValueText} ${whopName} with our exclusive promo code.`;
    } else {
      // Has promo code but no specific discount value
      description = `Claim your exclusive discount on ${whopName} with our special promo code.`;
    }
  } else {
    // No promo code, just exclusive access
    description = `Get exclusive access to ${whopName} through our special link.`;
  }

  // Add pricing information if available
  if (price) {
    if (price === 'Free') {
      description += ` Access this free ${category ? category.toLowerCase() : 'content'}.`;
    } else if (price !== 'N/A') {
      description += ` Starting at ${price}.`;
    }
  }

  // Add category/type information
  if (category) {
    const categoryLower = category.toLowerCase();
    if (!description.includes(categoryLower)) {
      description += ` Premium ${categoryLower} content.`;
    }
  }

  // Add urgency and freshness
  description += ` Limited time offer - verified ${currentMonth} ${currentYear}.`;

  // Add final call-to-action
  if (firstPromo && firstPromo.code) {
    description += ' Copy code & save now!';
  } else {
    description += ' Join today!';
  }

  // Ensure description is within optimal length (150-160 characters)
  if (description.length > 160) {
    // Trim and add ellipsis, but try to keep complete sentences
    const sentences = description.split('. ');
    let shortDescription = '';
    for (const sentence of sentences) {
      const testLength = shortDescription + sentence + '. ';
      if (testLength.length <= 157) { // Leave room for ellipsis
        shortDescription = testLength;
      } else {
        break;
      }
    }
    
    if (shortDescription.length > 0) {
      description = shortDescription.trim();
      if (!description.endsWith('.')) {
        description += '...';
      }
    } else {
      // Fallback: hard truncate
      description = description.substring(0, 157) + '...';
    }
  }

  return {
    title,
    description,
    keywords: [
      `${whopData.whopName} promo code`,
      `${whopData.whopName} discount`,
      `${whopData.whopName} coupon`,
      firstPromo?.value ? 
        (firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off') 
          ? firstPromo.value 
          : `${firstPromo.value}% off`)
        : 'exclusive access',
      whopData.category,
      price === 'Free' ? 'free' : 'premium',
      currentMonth,
      currentYear.toString()
    ].filter(Boolean).join(', '),
    robots: shouldIndex ? {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    } : {
      index: false,
      follow: true,
      googleBot: {
        index: false,
        follow: true,
        'max-image-preview': 'large',
        'max-snippet': -1,
        'max-video-preview': -1,
      },
    },
    openGraph: {
      title,
      description,
      type: 'website',
      images: whopData.logo ? [
        {
          url: whopData.logo,
          alt: `${whopData.whopName} Logo`,
          width: 1200,
          height: 630,
        }
      ] : []
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: whopData.logo ? [whopData.logo] : []
    }
  };
}

export default async function WhopPage({ params }: { params: { slug: string } }) {
  const whopData = await getWhop(params.slug);
  
  if (!whopData) {
    notFound();
  }

  // Use the processed data from the API which includes smart promoText logic
  const whop = {
    id: whopData.whopId,
    name: whopData.whopName,
    description: whopData.description,
    logo: whopData.logo,
    affiliateLink: whopData.affiliateLink,
    website: whopData.website || null,
    price: whopData.price,
    category: whopData.category || null,
    promoCodes: whopData.promoCodes || [],
    reviews: whopData.reviews || []
  };
  
  const firstPromo = whop.promoCodes[0] || null;
  const promoCode = firstPromo?.code || null;
  const promoTitle = "Exclusive Access"; // Always show "Exclusive Access" on detail pages

  // Helper function to check if whop has a promo code
  const hasPromoCode = (whopName: string): boolean => {
    // Now all promo codes are in database - if promoCode exists, we have a promo
    return promoCode !== null;
  };

  // Helper function to get discount percentage
  const getDiscountPercentage = (whopName: string): string => {
    // Now all promo codes are in database - use firstPromo.value directly
    return firstPromo?.value || '0';
  };

  // Create unique key for remounting when slug changes
  const pageKey = `whop-${params.slug}`;

  // Prepare FAQ data for the collapsible component
  const faqData = [
    {
      question: `How do I use the ${whop.name} promo code?`,
      answer: `To use the ${promoTitle} for ${whop.name}, simply click "Reveal Code" above to visit their website.${hasPromoCode(whop.name) ? ' Copy the promo code and enter it during checkout.' : ' The discount will be automatically applied when you purchase through our link.'}`
    },
    {
      question: `What type of product is ${whop.name}?`,
      answer: `${whop.name} is ${whop.category ? `in the ${whop.category.toLowerCase()} category and provides` : 'an exclusive platform that provides'} premium content and resources for its members. It's designed to help users achieve their goals through expert guidance and community support.`
    },
    {
      question: 'How long is this offer valid?',
      answer: `This exclusive offer for ${whop.name} is available for a limited time. We recommend claiming it as soon as possible as these deals can expire or change without notice.`
    }
  ];

  return (
    <main key={pageKey} className="min-h-screen py-12 pt-24 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-6xl">
        {/* Main Content Container */}
        <div className="max-w-2xl mx-auto space-y-6 mb-8">
          {/* Hero Section */}
          <div className="rounded-xl px-7 py-6 sm:p-8 shadow-lg border transition-theme" style={{ background: 'linear-gradient(to bottom right, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col gap-4">
              {/* Whop Info */}
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="relative w-16 sm:w-20 h-16 sm:h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--background-color)' }}>
                  <WhopLogo whop={whop} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">{whop.name} Promo Code</h1>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--accent-color)' }}>
                    {promoTitle}
                  </p>
                  {whop.price && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>Price:</span>
                      <span className="text-lg font-bold px-3 py-1 rounded-full" style={{ 
                        backgroundColor: whop.price === 'Free' ? 'var(--success-color)' : 
                                        whop.price === 'N/A' ? 'var(--text-secondary)' : 'var(--success-color)', 
                        color: 'white' 
                      }}>
                        {whop.price}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Interactive Components */}
              <WhopPageInteractive 
                key={`interactive-${pageKey}`}
                whop={{
                  id: whop.id,
                  name: whop.name,
                  affiliateLink: whop.affiliateLink
                }}
                firstPromo={firstPromo}
                promoCode={promoCode}
                promoTitle={promoTitle}
              />

              {/* Promo Code Submission Button */}
              <div className="mt-6">
                <PromoCodeSubmissionButton 
                  whopId={whop.id}
                  whopName={whop.name}
                />
              </div>
            </div>
          </div>

          {/* How to Redeem Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">How to Redeem</h2>
            <ol className="space-y-2 text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">1.</span>
                <span>Click "Reveal Code" above to visit {whop.name} and get your exclusive offer</span>
              </li>
              {hasPromoCode(whop.name) ? (
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">2.</span>
                  <span>Copy the revealed promo code and enter it during checkout</span>
                </li>
              ) : (
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">2.</span>
                  <span>No code needed - the discount will be automatically applied</span>
                </li>
              )}
              <li className="flex items-start">
                <span className="mr-2 font-semibold">3.</span>
                <span>Complete your purchase to access the exclusive content</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">4.</span>
                <span>Enjoy your {promoTitle} and start learning!</span>
              </li>
            </ol>
          </section>

          {/* Product Info Table */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Product Details</h2>
            <div className="overflow-hidden rounded-lg">
              <table className="min-w-full">
                <tbody>
                  {hasPromoCode(whop.name) ? (
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>Discount Value</td>
                      <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        {(() => {
                          const discount = getDiscountPercentage(whop.name);
                          // If discount already contains $, %, or 'off', return as-is
                          if (discount.includes('$') || discount.includes('%') || discount.includes('off')) {
                            return discount;
                          }
                          // Otherwise add % symbol for percentage discounts
                          return `${discount}%`;
                        })()}
                      </td>
                    </tr>
                  ) : null}
                  {whop.price && (
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>Price</td>
                      <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        <span style={{ 
                          color: whop.price === 'Free' ? 'var(--success-color)' : 
                                 whop.price === 'N/A' ? 'var(--text-secondary)' : 'var(--text-color)',
                          fontWeight: whop.price === 'Free' ? 'bold' : 'normal'
                        }}>
                          {whop.price}
                        </span>
                      </td>
                    </tr>
                  )}
                  {whop.category && (
                    <tr>
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>Category</td>
                      <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>{whop.category}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* About Product Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">About {whop.name}</h2>
            <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <p>{whop.description}</p>
            </div>
          </section>

          {/* Promo Details Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Promo Details</h2>
            <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'var(--background-color)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--accent-color)' }}>{promoTitle}</h3>
              <p className="text-base sm:text-lg leading-relaxed mb-3" style={{ color: 'var(--text-secondary)' }}>
                Get exclusive access and special discounts with our promo code.
              </p>
              
              {/* Compact usage stats */}
              {firstPromo && (
                <div className="mt-3 pt-3 border-t" style={{ borderColor: 'var(--border-color)' }}>
                  <WhopPageCompactStats 
                    whopId={whop.id}
                    promoCodeId={firstPromo.id}
                  />
                </div>
              )}
            </div>
            
            {/* Promo Type Badge */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--background-color)', color: 'var(--accent-color)' }}>
                {firstPromo?.type?.replace('_', ' ').toUpperCase() || 'DISCOUNT'} OFFER
              </span>
            </div>
          </section>

          {/* Terms & Conditions */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">Terms & Conditions</h2>
            <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              This exclusive offer for {whop.name} is available through our partnership.
              {hasPromoCode(whop.name) ? ' Use the promo code during checkout to get your discount.' : ' The discount will be automatically applied when you click through our link.'}
              {' '}Terms and conditions apply as set by {whop.name}. Offer subject to availability and may be modified or discontinued at any time.
            </p>
          </section>

          {/* FAQ Section */}
          <FAQSection faqs={faqData} />
        </div>

        {/* Full-width sections for better layout */}
        <div className="w-full space-y-8">
          {/* Recommended Whops Section - Align with content above */}
          <div className="max-w-2xl mx-auto">
            <RecommendedWhops currentWhopId={whop.id} />
          </div>

          {/* Reviews Section */}
          <div className="max-w-2xl mx-auto">
            <WhopReviewSection 
              whopId={whop.id}
              whopName={whop.name}
              reviews={whop.reviews || []}
            />
          </div>

          {/* Back Link */}
          <div className="max-w-2xl mx-auto">
            <Link href="/" className="hover:opacity-80 flex items-center gap-2 px-1 transition-colors" style={{ color: 'var(--text-secondary)' }}>
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to All Offers
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
} 