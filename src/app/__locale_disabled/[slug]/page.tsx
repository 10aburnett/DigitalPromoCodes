import { notFound } from 'next/navigation';
import Link from 'next/link';
import { normalizeImagePath } from '@/lib/image-utils';
import InitialsAvatar from '@/components/InitialsAvatar';
import WhopPageClient from '@/components/WhopPageClient';
import WhopLogo from '@/components/WhopLogo';
import WhopReviewSection from '@/components/WhopReviewSection';
import RecommendedWhops from '@/components/RecommendedWhops';
import { getTranslation } from '@/lib/i18n';

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

export default async function WhopPage({ params }: { params: { slug: string, locale?: string } }) {
  const locale = params.locale || 'en';
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

  // Create unique key for remounting when locale or slug changes
  const pageKey = `${locale}-${params.slug}`;

  return (
    <main key={pageKey} className="min-h-screen py-12 pt-24 transition-theme" style={{ backgroundColor: 'var(--background-color)', color: 'var(--text-color)' }}>
      <div className="mx-auto w-[90%] md:w-[95%] max-w-4xl">
        <div className="max-w-2xl mx-auto space-y-6">
          {/* Hero Section */}
          <div className="rounded-xl px-7 py-6 sm:p-8 shadow-lg border transition-theme" style={{ background: 'linear-gradient(to bottom right, var(--background-secondary), var(--background-tertiary))', borderColor: 'var(--border-color)' }}>
            <div className="flex flex-col gap-4">
              {/* Whop Info */}
              <div className="flex items-center gap-4 sm:gap-6">
                <div className="relative w-16 sm:w-20 h-16 sm:h-20 rounded-lg overflow-hidden flex-shrink-0" style={{ backgroundColor: 'var(--background-color)' }}>
                  <WhopLogo whop={whop} />
                </div>
                <div className="min-w-0">
                  <h1 className="text-2xl sm:text-3xl font-bold mb-2">{whop.name} {getTranslation('whop.promoCode', locale as any)}</h1>
                  <p className="text-base sm:text-lg" style={{ color: 'var(--accent-color)' }}>
                    {promoTitle}
                  </p>
                  {whop.price && (
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-lg font-medium" style={{ color: 'var(--text-secondary)' }}>{getTranslation('whop.price', locale as any)}:</span>
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

              {/* Interactive Button - Force remount with key */}
              <WhopPageClient 
                key={`client-${pageKey}`}
                whop={{
                  id: whop.id,
                  name: whop.name,
                  affiliateLink: whop.affiliateLink
                }}
                firstPromo={firstPromo}
                promoCode={promoCode}
                promoTitle={promoTitle}
              />
            </div>
          </div>

          {/* How to Redeem Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{getTranslation('whop.howToRedeem', locale as any)}</h2>
            <ol className="space-y-2 text-base sm:text-lg" style={{ color: 'var(--text-secondary)' }}>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">1.</span>
                <span>{getTranslation('whop.step1', locale as any).replace('{button}', getTranslation('whop.revealCode', locale as any)).replace('{name}', whop.name)}</span>
              </li>
              {promoCode ? (
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">2.</span>
                  <span>{getTranslation('whop.step2Code', locale as any)}</span>
                </li>
              ) : (
                <li className="flex items-start">
                  <span className="mr-2 font-semibold">2.</span>
                  <span>{getTranslation('whop.step2NoCode', locale as any)}</span>
                </li>
              )}
              <li className="flex items-start">
                <span className="mr-2 font-semibold">3.</span>
                <span>{getTranslation('whop.step3', locale as any)}</span>
              </li>
              <li className="flex items-start">
                <span className="mr-2 font-semibold">4.</span>
                <span>{getTranslation('whop.step4', locale as any).replace('{promo}', promoTitle)}</span>
              </li>
            </ol>
          </section>

          {/* Product Info Table */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{getTranslation('whop.productDetails', locale as any)}</h2>
            <div className="overflow-hidden rounded-lg">
              <table className="min-w-full">
                <tbody>
                  {whop.website && (
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>{getTranslation('whop.website', locale as any)}</td>
                      <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        <a href={whop.website.startsWith('http') ? whop.website : `https://${whop.website}`} 
                          target="_blank" 
                          rel="nofollow noopener" 
                          className="hover:underline"
                          style={{ color: 'var(--accent-color)' }}>
                          {whop.website.replace(/(https?:\/\/)?(www\.)?/i, '')}
                        </a>
                      </td>
                    </tr>
                  )}
                  {firstPromo?.value && firstPromo.value !== '' && firstPromo.value !== '0' && firstPromo.code && (
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>{getTranslation('whop.discountValue', locale as any)}</td>
                      <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>
                        {firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off') 
                          ? firstPromo.value 
                          : `${firstPromo.value}%`}
                      </td>
                    </tr>
                  )}
                  {whop.price && (
                    <tr className="border-b" style={{ borderColor: 'var(--border-color)' }}>
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>{getTranslation('whop.price', locale as any)}</td>
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
                      <td className="py-3 pl-4 pr-2 font-medium w-1/3" style={{ backgroundColor: 'var(--background-color)' }}>{getTranslation('whop.category', locale as any)}</td>
                      <td className="py-3 px-4" style={{ backgroundColor: 'var(--background-secondary)' }}>{whop.category}</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>

          {/* About Product Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{getTranslation('whop.about', locale as any)} {whop.name}</h2>
            <div className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              <p>{whop.description}</p>
            </div>
          </section>

          {/* Promo Details Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{getTranslation('whop.promoDetails', locale as any)}</h2>
            <div className="p-4 rounded-lg mb-4" style={{ backgroundColor: 'var(--background-color)' }}>
              <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--accent-color)' }}>{promoTitle}</h3>
              <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                Get exclusive access and special discounts with our promo code.
              </p>
            </div>
            
            {/* Promo Type Badge */}
            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1 rounded-full text-sm font-medium" style={{ backgroundColor: 'var(--background-color)', color: 'var(--accent-color)' }}>
                {firstPromo?.type?.replace('_', ' ').toUpperCase() || 'DISCOUNT'} {getTranslation('whop.offer', locale as any).toUpperCase()}
              </span>
            </div>
          </section>

          {/* Terms & Conditions */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{getTranslation('whop.termsConditions', locale as any)}</h2>
            <p className="text-base sm:text-lg leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {getTranslation('whop.termsText', locale as any)
                .replace('{offer}', promoCode ? getTranslation('whop.termsOffer', locale as any).replace('{code}', promoCode) : getTranslation('whop.termsOfferNoCode', locale as any))
                .replace(/{name}/g, whop.name)}
            </p>
          </section>

          {/* FAQ Section */}
          <section className="rounded-xl px-7 py-6 sm:p-8 border transition-theme" style={{ backgroundColor: 'var(--background-secondary)', borderColor: 'var(--border-color)' }}>
            <h2 className="text-xl sm:text-2xl font-bold mb-4">{getTranslation('whop.faq', locale as any)}</h2>
            <div className="space-y-4">
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--background-color)' }}>
                <h3 className="font-semibold text-lg mb-2">{getTranslation('whop.faqQ1', locale as any).replace('{name}', whop.name)}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {getTranslation('whop.faqA1', locale as any)
                    .replace('{promo}', promoTitle)
                    .replace('{name}', whop.name)
                    .replace('{button}', getTranslation('whop.revealCode', locale as any))}
                  {promoCode ? getTranslation('whop.faqA1Code', locale as any) : getTranslation('whop.faqA1NoCode', locale as any)}
                </p>
              </div>
              
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--background-color)' }}>
                <h3 className="font-semibold text-lg mb-2">{getTranslation('whop.faqQ2', locale as any).replace('{name}', whop.name)}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {getTranslation('whop.faqA2', locale as any)
                    .replace('{name}', whop.name)
                    .replace('{category}', whop.category ? getTranslation('whop.faqA2Category', locale as any).replace('{category}', whop.category.toLowerCase()) : getTranslation('whop.faqA2NoCategory', locale as any))}
                </p>
              </div>
              
              <div className="rounded-lg p-4" style={{ backgroundColor: 'var(--background-color)' }}>
                <h3 className="font-semibold text-lg mb-2">{getTranslation('whop.faqQ3', locale as any)}</h3>
                <p style={{ color: 'var(--text-secondary)' }}>
                  {getTranslation('whop.faqA3', locale as any).replace('{name}', whop.name)}
                </p>
              </div>
            </div>
          </section>

          {/* Recommended Whops Section */}
          <RecommendedWhops currentWhopSlug={whop.slug ?? params.slug} />

          {/* Reviews Section */}
          <WhopReviewSection 
            whopId={whop.id}
            whopName={whop.name}
            reviews={whop.reviews || []}
          />

          {/* Back Link */}
          <Link 
            href={locale === 'en' ? '/' : `/${locale}`} 
            className="hover:opacity-80 flex items-center gap-2 px-1 transition-colors" 
            style={{ color: 'var(--text-secondary)' }}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            {getTranslation('nav.home', locale as any)}
          </Link>
        </div>
      </div>
    </main>
  );
}