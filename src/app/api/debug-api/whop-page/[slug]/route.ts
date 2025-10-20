import { NextResponse } from 'next/server';
import { getWhopBySlugCached } from '@/data/whops';
import { prisma } from '@/lib/prisma';
import { canonicalSlugForDB } from '@/lib/slug-utils';

function maskDbUrl(u?: string) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return { protocol: url.protocol.replace(/:.*/, ''), host: url.host, pathname: url.pathname };
  } catch { return 'unparseable'; }
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const raw = params.slug || '';
  const decoded = decodeURIComponent(raw);
  // Use lowercase decoded slug for DB lookup (DB stores literal colons, not %3a)
  const canonical = decoded.toLowerCase();

  const direct = await prisma.whop.findFirst({
    where: { slug: canonical },
    select: { id: true, slug: true, name: true, indexingStatus: true, retirement: true }
  });

  // replicate cached path
  let cached: any = null;
  let cacheError: string | null = null;
  try {
    cached = await getWhopBySlugCached(canonical);
  } catch (e: any) {
    cacheError = String(e?.message || e);
  }

  // apply the same "should render?" guard your page uses
  let shouldRender: boolean | null = null;
  const reasons: string[] = [];

  if (!direct) {
    shouldRender = false;
    reasons.push('no_record_in_db');
  } else {
    // Mirror page.tsx logic (lines 460-477)
    const indexingStatus = String(direct.indexingStatus || '').toUpperCase();
    const isIndexable = ['INDEXED', 'INDEX'].includes(indexingStatus);
    const isGone = direct.retirement === 'GONE';

    if (isGone) {
      shouldRender = false;
      reasons.push('retirement=GONE');
    } else {
      shouldRender = true;
      if (!isIndexable) {
        reasons.push(`indexingStatus=${direct.indexingStatus} (not INDEX/INDEXED, but still rendering per relaxed gate)`);
      }
    }
  }

  const payload = {
    db: maskDbUrl(process.env.DATABASE_URL),
    slug: { raw, canonical },
    direct: direct ? {
      id: direct.id,
      slug: direct.slug,
      name: direct.name,
      indexingStatus: direct.indexingStatus,
      retirement: direct.retirement
    } : null,
    cached: cacheError ? { error: cacheError } : (cached ? { id: cached.id, slug: cached.slug, name: cached.name } : null),
    decision: { shouldRender, reasons }
  };

  console.log('[DBG:reasons]', new Date().toISOString(), payload);
  return NextResponse.json(payload);
}
