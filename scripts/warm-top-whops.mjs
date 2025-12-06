#!/usr/bin/env node

const origin = process.env.SITE_ORIGIN || 'https://digitalpromocodes.com';

// Top whop slugs to warm after deploy (update this list with your most-visited pages)
const topSlugs = [
  'ayecon-academy-lifetime-membership',
  'best-of-both-worlds',
  'dodgys-dungeon',
  'dodgys-ultimate-course',
  'flipalert-membership-usa',
  'goat-ecom-growth',
  'goat-sports-bets-membership',
  'jdub-trades-premium',
  'josh-exclusive-vip-access',
  'larrys-lounge-premium',
  'momentum-monthly',
  'owls-full-access',
  'parlayscience-discord-access',
  'propfellas-vip',
  'scarface-trades-premium',
  'supercar-income',
  'the-yard-dropship-mastermind',
  'tms-exclusive-vip-chat',
  'trade-with-insight-pro',
  'zwm-gold',
  'zwm-lifetime-access',
];

(async () => {
  console.log(`🔥 Warming ISR cache for top ${topSlugs.length} whop pages...`);
  console.log(`📍 Origin: ${origin}\n`);

  for (const slug of topSlugs) {
    const url = `${origin}/whop/${encodeURIComponent(slug)}`;
    const t0 = Date.now();

    try {
      const res = await fetch(url, {
        headers: {
          'user-agent': 'WarmBot/1.0 (ISR Cache Warmer)',
          'accept': 'text/html'
        }
      });

      const duration = Date.now() - t0;
      const status = res.ok ? '✅' : '❌';
      const cacheStatus = res.headers.get('x-vercel-cache') || 'N/A';

      console.log(`${status} ${slug.padEnd(40)} ${res.status} ${duration}ms (cache: ${cacheStatus})`);
    } catch (error) {
      const duration = Date.now() - t0;
      console.log(`❌ ${slug.padEnd(40)} ERROR ${duration}ms (${error.message})`);
    }

    // Rate-limit friendliness: tiny delay between requests
    await new Promise(r => setTimeout(r, 150));
  }

  console.log(`\n✅ Cache warming complete!`);
})();
