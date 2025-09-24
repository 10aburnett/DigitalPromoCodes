// src/lib/graph.ts
import { normalizeSlug } from './slug-normalize';

export type NeighborData = { recommendations: string[]; alternatives: string[]; explore?: string };
export type NeighborsMap = Record<string, NeighborData>;

let cache: { neighbors?: NeighborsMap } = {};

const GRAPH_URL =
  (process.env.NEXT_PUBLIC_GRAPH_URL && process.env.NEXT_PUBLIC_GRAPH_URL.trim()) ||
  '/data/graph/neighbors.json';

const GRAPH_VER = process.env.NEXT_PUBLIC_GRAPH_VERSION || '';

export async function loadNeighbors(): Promise<NeighborsMap> {
  const url = GRAPH_VER
    ? `${GRAPH_URL}${GRAPH_URL.includes('?') ? '&' : '?'}v=${encodeURIComponent(GRAPH_VER)}`
    : GRAPH_URL;

  if (typeof window !== 'undefined') {
    console.debug('[graph] url in browser:', url);
    (window as any).__WHOP_GRAPH_URL = url;
  }

  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`Graph fetch failed ${res.status}`);

  const data = await res.json();
  const keys = Object.keys(data).length;

  // Enhanced debugging for prod/dev consistency
  const isDev = process.env.NODE_ENV === 'development';
  const isDebug = process.env.NEXT_PUBLIC_DEBUG === 'true';

  if (isDev || isDebug) {
    console.log('[graph] Loaded:', {
      url,
      keys,
      version: GRAPH_VER,
      sampleKeys: Object.keys(data).slice(0, 3),
      env: process.env.NODE_ENV
    });
  }

  // Production guard for debugging inconsistencies
  if (typeof window !== 'undefined') {
    (window as any).__graphDebug = {
      url,
      keys,
      version: GRAPH_VER,
      timestamp: new Date().toISOString()
    };
  }

  return data;
}

export function getNeighborSlugsFor(
  neighbors: Record<string, { recommendations?: string[]; alternatives?: string[]; explore?: string }>,
  slug: string,
  kind: 'recommendations'|'alternatives'
): string[] {
  const s = normalizeSlug(slug);
  const entry = neighbors[s] || neighbors[decodeURIComponent(s)] || neighbors[s.replace(/\s+/g,'-')];
  if (!entry) return [];
  const arr = (entry[kind] || []).filter(Boolean);
  return Array.from(new Set(arr)); // de-dup
}

export function getExploreFor(
  neighbors: Record<string, { recommendations?: string[]; alternatives?: string[]; explore?: string }>,
  slug: string
): string | null {
  const s = normalizeSlug(slug);
  const entry = neighbors[s] || neighbors[decodeURIComponent(s)] || neighbors[s.replace(/\s+/g,'-')];
  return entry?.explore || null;
}