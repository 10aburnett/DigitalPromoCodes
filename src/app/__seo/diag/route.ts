import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { RETIRED_PATHS, NOINDEX_PATHS } from '@/app/_generated/seo-indexes'; // NOTE: because this file is under src/app, alias '@/app/...' resolves to src/app

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const locale = searchParams.get('locale');

  if (!slug || !locale) {
    return NextResponse.json({ error: 'Provide slug & locale' }, { status: 400 });
  }
  const path = `/whop/${slug}`;
  const whop = await prisma.whop.findFirst({
    where: { slug },
    select: { indexingStatus: true, retirement: true, redirectToPath: true },
  });

  return NextResponse.json({
    input: { slug, locale, path },
    db: whop,
    middleware: {
      retiredMatch: RETIRED_PATHS.has(path),
      noindexMatch: NOINDEX_PATHS.has(path),
    }
  });
}