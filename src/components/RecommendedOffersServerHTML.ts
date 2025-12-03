// src/components/RecommendedWhopsServerHTML.ts
import 'server-only';

type Whop = {
  slug: string;
  name: string;
  description?: string | null;
  logo?: string | null;
  category?: string | null;
  rating?: number | null;
};

function esc(s: string) {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderRecommendedHTML(items: Whop[]) {
  if (!items?.length) return '';

  const lis = items.map((w) => {
    const href = `/whop/${encodeURIComponent(w.slug)}`;
    const logo = w.logo || '/logo.png';
    const desc = w.description || '&nbsp;';
    const cat  = w.category || '&nbsp;';
    const rating = typeof w.rating === 'number' ? `★ ${w.rating.toFixed(1)}` : '&nbsp;';

    return `
<li class="block">
  <a href="${esc(href)}" class="block rounded-xl border p-4 hover:shadow-sm hover:bg-gray-50 transition-all duration-200 overflow-hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[var(--accent-color)]" style="border-color:var(--border-color);background-color:var(--background-color)" aria-label="View ${esc(w.name)}">
    <div class="flex gap-3 items-center">
      <div class="w-12 h-12 rounded-md overflow-hidden bg-[var(--background-secondary)] shrink-0">
        <img src="${esc(logo)}" alt="${esc(w.name)}" width="48" height="48" loading="lazy" decoding="async"
             class="w-full h-full object-contain rounded" />
      </div>
      <div class="min-w-0 flex-1 overflow-hidden">
        <div class="font-semibold text-base line-clamp-2 break-words mb-1" style="color:var(--text-color)">${esc(w.name)}</div>
        <div class="text-sm line-clamp-2 break-words" style="color:var(--text-secondary)">${desc === '&nbsp;' ? '&nbsp;' : esc(desc)}</div>
        <div class="mt-2 text-xs flex items-center gap-2" style="color:var(--text-secondary)">
          <span class="px-2 py-0.5 rounded-full border" style="border-color:var(--border-color)">Exclusive Access</span>
          <span>${cat === '&nbsp;' ? '&nbsp;' : esc(cat)}</span>
          <span>${rating}</span>
        </div>
      </div>
    </div>
  </a>
</li>`;
  });

  return `
<section class="mt-8" data-recs data-recs-count="${items.length}">
  <h2 class="text-xl sm:text-2xl font-bold mb-2">Recommended for You</h2>
  <p class="text-sm mb-4" style="color:var(--text-secondary)">Similar offers based on your current selection</p>
  <ul class="flex flex-col gap-3">
    ${lis.join('\n')}
  </ul>
</section>`;
}