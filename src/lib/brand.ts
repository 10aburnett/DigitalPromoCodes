// src/lib/brand.ts
// Centralised brand configuration for SEO metadata and JSON-LD
// TODO: Update these values once the new brand/domain is finalised

/**
 * Site brand name - used in titles, metadata, and JSON-LD
 * Neutral placeholder until new brand is confirmed
 */
export const SITE_BRAND = process.env.NEXT_PUBLIC_SITE_BRAND ?? 'OfferHub';

/**
 * Short tagline for the site - used in descriptions
 * Keep it neutral and offer-centric
 */
export const SITE_TAGLINE = 'Discover exclusive deals, discounts & offers for premium digital products';

/**
 * Longer description for home/about pages
 */
export const SITE_DESCRIPTION = 'Your trusted source for verified deals, discount codes & exclusive offers on premium digital products, courses, and communities.';

/**
 * Default author/publisher name for content
 */
export const SITE_AUTHOR = process.env.NEXT_PUBLIC_SITE_AUTHOR ?? 'OfferHub Team';

/**
 * Social media handles (without @)
 * TODO: Update once new social accounts are created
 */
export const SOCIAL_HANDLES = {
  twitter: '', // Leave empty until new accounts exist
  facebook: '',
};

/**
 * Contact email placeholder
 * TODO: Update once new email is configured
 */
export const CONTACT_EMAIL = process.env.NEXT_PUBLIC_CONTACT_EMAIL ?? 'contact@example.com';
