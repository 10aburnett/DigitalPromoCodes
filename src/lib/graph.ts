// src/lib/graph.ts
export type NeighborData = { recommendations: string[]; alternatives: string[] };
export type NeighborsMap = Record<string, NeighborData>;

let cache: { neighbors?: NeighborsMap } = {};

export async function loadNeighbors(): Promise<NeighborsMap> {
  if (cache.neighbors) return cache.neighbors;
  const res = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL ?? ''}/data/graph/neighbors.json`, {
    cache: 'force-cache',
  });
  if (!res.ok) throw new Error(`neighbors.json HTTP ${res.status}`);
  const json = (await res.json()) as NeighborsMap;
  cache.neighbors = json;
  return json;
}

export function getNeighborSlugsFor(
  map: NeighborsMap,
  slug: string,
  kind: 'recommendations' | 'alternatives'
): string[] {
  const entry = map[slug.toLowerCase()];
  return entry?.[kind] ?? [];
}