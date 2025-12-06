// src/components/AlternativesServerHTML.ts
import 'server-only';

type Alternative = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  category?: string | null;
  rating?: number | null;
  promoCodes?: Array<{
    id: string;
    code: string | null;
    value: string;
    title?: string;
  }>;
};

type Explore = {
  slug: string;
  name: string;
  category?: string | null;
};

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getPromoText(whop: Alternative): string {
  const firstPromo = whop.promoCodes?.[0];
  if (!firstPromo) return 'Exclusive Access';

  // If there's a promo code and a value > 0, show the discount
  if (firstPromo.code && firstPromo.value && firstPromo.value !== '0') {
    // Check if value already contains currency or percentage symbol
    if (firstPromo.value.includes('$') || firstPromo.value.includes('%') || firstPromo.value.includes('off')) {
      return firstPromo.value;
    }
    return `${firstPromo.value}% Off`;
  }

  return firstPromo.title || 'Exclusive Access';
}

function resolveLogoUrl(logo: string | null | undefined): string {
  if (!logo) return '/logo.png';

  // If it's already a full URL, return as-is
  if (logo.startsWith('http://') || logo.startsWith('https://')) {
    return logo;
  }

  // If it starts with /, it's already absolute
  if (logo.startsWith('/')) {
    return logo;
  }

  // Otherwise, make it absolute
  return `/${logo}`;
}

export function renderAlternativesHTML(alternatives: Alternative[], explore: Explore | null = null): string {
  if (!alternatives?.length) return '';

  const alternativeItems = alternatives.map((whop, index) => {
    const href = `/offer/${encodeURIComponent(whop.slug)}`;
    const logoUrl = resolveLogoUrl(whop.logo);
    const loading = index < 2 ? 'eager' : 'lazy';
    const promoText = getPromoText(whop);

    return `
<a href="${esc(href)}" class="block rounded-lg border p-4 hover:opacity-90 transition group" style="border-color:var(--border-color);background-color:var(--background-color)">
  <div class="flex gap-3 items-center">
    <div class="w-12 h-12 rounded-md overflow-hidden bg-[var(--background-secondary)] shrink-0">
      <img src="${esc(logoUrl)}" alt="${esc(whop.name)}" width="48" height="48" loading="${loading}" decoding="async" class="w-full h-full object-cover rounded" />
    </div>
    <div class="min-w-0 flex-1">
      <div class="font-semibold truncate" style="color:var(--text-color)">${esc(whop.name)}</div>
      ${whop.description ? `<div class="text-sm truncate" style="color:var(--text-secondary)">${esc(whop.description)}</div>` : ''}
      <div class="mt-1 text-xs flex gap-2" style="color:var(--text-secondary)">
        <span class="px-2 py-0.5 rounded-full border" style="border-color:var(--border-color)">${esc(promoText)}</span>
        ${whop.category ? `<span>${esc(whop.category)}</span>` : ''}
        ${typeof whop.rating === 'number' ? `<span>★ ${whop.rating.toFixed(1)}</span>` : ''}
      </div>
    </div>
  </div>
</a>`;
  }).join('\n');

  const exploreSection = explore ? `
<div class="mt-6 rounded-lg border p-4" style="border-color:var(--border-color);background-color:var(--background-color)">
  <div class="flex flex-wrap items-center gap-2 text-sm">
    <span style="color:var(--text-secondary)">
      Explore another${explore.category ? ` in ${esc(explore.category)}` : ''}:
    </span>
    <a href="/offer/${encodeURIComponent(explore.slug)}" class="font-medium hover:opacity-80 transition-opacity" style="color:var(--accent-color)">
      ${esc(explore.name)}
    </a>
  </div>
</div>` : '';

  return `
<section class="mt-8">
  <h2 class="text-xl sm:text-2xl font-bold mb-1">You might also consider…</h2>
  <p class="text-sm mb-4" style="color:var(--text-secondary)">
    Alternative offers that might interest you
  </p>
  <div class="space-y-4">
    ${alternativeItems}
  </div>
  ${exploreSection}
</section>`;
}