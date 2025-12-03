// src/app/api/debug-api/whop/[slug]/route.ts
import { NextResponse } from 'next/server';
import { dlog } from '@/lib/debug';
import { prisma } from '@/lib/prisma';
import { canonicalSlugForDB } from '@/lib/slug-utils';

function maskDbUrl(u?: string) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return {
      protocol: url.protocol.replace(/:.*/, ''),
      host: url.host,
      pathname: url.pathname,
    };
  } catch {
    return 'unparseable';
  }
}

export async function GET(_req: Request, { params }: { params: { slug: string } }) {
  const raw = params.slug || '';
  const decoded = decodeURIComponent(raw);
  const canonical = canonicalSlugForDB(decoded);

  const safeDb = maskDbUrl(process.env.DATABASE_URL);

  // Try several keys to *prove* existence vs. mismatch.
  const [byCanonical, byRaw, byDecoded] = await Promise.all([
    prisma.deal.findFirst({ where: { slug: canonical }, select: { id: true, slug: true, name: true } }),
    prisma.deal.findFirst({ where: { slug: raw },       select: { id: true, slug: true, name: true } }),
    prisma.deal.findFirst({ where: { slug: decoded },   select: { id: true, slug: true, name: true } }),
  ]);

  // Raw SQL search to bypass Prisma field mismatch
  const viaSql = await prisma.$queryRawUnsafe<any[]>(
    `SELECT id, slug, name FROM "Whop" WHERE slug IN ($1,$2,$3) LIMIT 5`,
    canonical, raw, decoded
  ).catch(() => []);

  const result = {
    raw,
    decoded,
    canonical,
    db: safeDb,
    hits: {
      byCanonical: byCanonical ? { id: byCanonical.id, slug: byCanonical.slug, name: byCanonical.name } : null,
      byRaw: byRaw ? { id: byRaw.id, slug: byRaw.slug, name: byRaw.name } : null,
      byDecoded: byDecoded ? { id: byDecoded.id, slug: byDecoded.slug, name: byDecoded.name } : null,
      viaSql: viaSql.map(r => ({ id: r.id, slug: r.slug, name: r.name }))
    },
    exists: Boolean(byCanonical || byRaw || byDecoded || (Array.isArray(viaSql) && viaSql.length > 0)),
  };

  dlog('whop', 'API debug-api/whop looked up', result);
  return NextResponse.json(result);
}
