import { siteOrigin } from '@/lib/site-origin';

export default function robots() {
  const origin = siteOrigin();
  return {
    rules: [
      { userAgent: '*', allow: '/', disallow: ['/admin'] },
    ],
    sitemap: `${origin}/sitemap.xml`,
    host: origin,
  };
}
