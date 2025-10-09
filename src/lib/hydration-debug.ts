// src/lib/hydration-debug.ts
type Jsonish = string | number | boolean | null | Jsonish[] | { [k: string]: Jsonish };

export function toIso(value: unknown): string | null {
  if (!value) return null;
  const d = new Date(value as any);
  return isNaN(+d) ? null : d.toISOString();
}

// Remove undefined, convert Dates to ISO, sort keys for stability
export function stableNormalize(input: any): Jsonish {
  if (input === undefined) return null;
  if (input === null) return null;

  if (typeof input === 'string' || typeof input === 'number' || typeof input === 'boolean') {
    return input;
  }
  if (input instanceof Date) return toIso(input);

  if (Array.isArray(input)) {
    return input.map((v) => stableNormalize(v)) as Jsonish;
  }

  if (typeof input === 'object') {
    const out: Record<string, Jsonish> = {};
    Object.keys(input).sort().forEach((k) => {
      const v = (input as any)[k];
      if (v === undefined) return;
      const nv = stableNormalize(v);
      out[k] = nv as Jsonish;
    });
    return out as Jsonish;
  }

  return null;
}

// djb2 hash, deterministic & tiny
export function djb2(str: string): string {
  let h = 5381;
  for (let i = 0; i < str.length; i++) h = ((h << 5) + h) ^ str.charCodeAt(i);
  // unsigned 32-bit + base36 to shorten
  return (h >>> 0).toString(36);
}
