// src/lib/graph.ts
import { normalizeSlug } from './slug-normalize';

export type NeighborData = { recommendations: string[]; alternatives: string[]; explore?: string };
export type NeighborsMap = Record<string, NeighborData>;

let cache: { neighbors?: NeighborsMap } = {};

const GRAPH_URL =
  process.env.NEXT_PUBLIC_GRAPH_URL || '/data/graph/neighbors.json';

const GRAPH_VERSION =
  process.env.NEXT_PUBLIC_GRAPH_VERSION ||
  process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA ||
  'v0';

export async function loadNeighbors(): Promise<NeighborsMap> {
  // Always build versioned URL to bust caches
  const url = `${GRAPH_URL}${GRAPH_URL.includes('?') ? '&' : '?'}v=${GRAPH_VERSION}`;

  // Force fresh fetch to avoid cache issues
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache'
    }
  });

  if (!res.ok) {
    throw new Error(`Failed to load graph: ${res.status} from ${url}`);
  }

  const data = await res.json();
  const keys = Object.keys(data).length;

  // Enhanced debugging for prod/dev consistency
  const isDev = process.env.NODE_ENV === 'development';
  const isDebug = process.env.NEXT_PUBLIC_DEBUG === 'true';

  if (isDev || isDebug) {
    console.log('[graph] Loaded:', {
      url,
      keys,
      version: GRAPH_VERSION,
      sampleKeys: Object.keys(data).slice(0, 3),
      env: process.env.NODE_ENV
    });
  }

  // Production guard for debugging inconsistencies
  if (typeof window !== 'undefined') {
    (window as any).__graphDebug = {
      url,
      keys,
      version: GRAPH_VERSION,
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