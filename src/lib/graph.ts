// src/lib/graph.ts
import { normalizeSlug } from './slug-normalize';

export type NeighborData = { recommendations: string[]; alternatives: string[] };
export type NeighborsMap = Record<string, NeighborData>;

let cache: { neighbors?: NeighborsMap } = {};

const GRAPH_VERSION =
  process.env.NEXT_PUBLIC_GRAPH_VERSION ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  '';

export async function loadNeighbors(): Promise<NeighborsMap> {
  const url = `/data/graph/neighbors.json${GRAPH_VERSION ? `?v=${GRAPH_VERSION}` : ''}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`neighbors.json ${res.status}`);
  const data = await res.json();  // flat: { [slug]: { recommendations, alternatives } }
  if (process.env.NEXT_PUBLIC_DEBUG === 'true') {
    console.log('[graph] keys:', Object.keys(data).length, 'version:', GRAPH_VERSION);
  }
  return data;
}

export function getNeighborSlugsFor(
  neighbors: Record<string, { recommendations?: string[]; alternatives?: string[] }>,
  slug: string,
  kind: 'recommendations'|'alternatives'
): string[] {
  const s = normalizeSlug(slug);
  const entry = neighbors[s] || neighbors[decodeURIComponent(s)] || neighbors[s.replace(/\s+/g,'-')];
  if (!entry) return [];
  const arr = (entry[kind] || []).filter(Boolean);
  return Array.from(new Set(arr)); // de-dup
}