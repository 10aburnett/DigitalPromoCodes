// scripts/build-graph-chatgpt.ts
// ChatGPT's Multi-Pass SEO-Optimized Graph Algorithm
// Eliminates orphans, prevents mega-hubs, forces diversity, keeps deterministic

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
import seedrandom from 'seedrandom';
import { extractTopics, jaccard } from '../src/lib/topics';
import { priceAffinity } from '../src/lib/price';
import { getGoneWhopSlugs } from '../src/lib/gone';

interface WhopData {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  category: string | null;
  brand: string | null;
  price: string | null;
  rating: number | null;
  topics: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface Edge {
  target: string;
  score: number;
}

interface RawGraph {
  [slug: string]: {
    recCandidates: Edge[];
    altCandidates: Edge[];
  };
}

interface SiteGraph {
  neighbors: { [slug: string]: { recommendations: string[]; alternatives: string[]; explore?: string } };
  topics: { [topic: string]: string[] };
  inboundCounts: { [slug: string]: number };
}

// New utility types and functions for graph fixes
type Neighbors = Record<string, {
  recommendations?: string[];
  alternatives?: string[];
  explore?: string | null; // single explore target or null
  category?: string;       // if you have it
}>;

const HUB_CAP = 250;

function buildInboundCounts(data: Neighbors) {
  const inbound = new Map<string, number>();
  for (const [s, v] of Object.entries(data)) {
    const all = new Set([
      ...(v.recommendations ?? []),
      ...(v.alternatives ?? []),
      ...(v.explore ? [v.explore] : []),
    ]);
    for (const t of all) inbound.set(t, (inbound.get(t) ?? 0) + 1);
  }
  return inbound;
}

function outSet(v: Neighbors[string]) {
  return new Set([
    ...(v.recommendations ?? []),
    ...(v.alternatives ?? []),
    ...(v.explore ? [v.explore] : []),
  ]);
}

function hasCapacityInbound(inbound: Map<string, number>, target: string) {
  return (inbound.get(target) ?? 0) < HUB_CAP;
}

function addExploreLink(
  graph: Neighbors,
  inbound: Map<string, number>,
  source: string,
  target: string
) {
  if (source === target) return false;
  if (!hasCapacityInbound(inbound, target)) return false;

  const v = graph[source] ?? (graph[source] = {});
  const outs = outSet(v);
  if (outs.has(target)) return false; // avoid duplicates vs rec/alt/explore

  // set explore (single-slot); if already set, we can overwrite if the new target is better.
  v.explore = target;

  inbound.set(target, (inbound.get(target) ?? 0) + 1);
  return true;
}

function pickAlternatives(
  slug: string,
  candidates: Edge[],
  meta: Map<string, WhopData>,
  globalAltUsage: Map<string, number>,
  recSet: Set<string>,
  currentInbound: Map<string, number>,
  k = 4,
  seed = 'alts-'
) {
  const rng = seedrandom(seed + slug);
  // Fix C: Widen pool from ~8-10 to 16 candidates
  const pool = candidates.slice(0, 16);
  const myCat = meta.get(slug)?.category;

  return pool
    .map((e) => {
      const t = meta.get(e.target);
      if (!t) return null;

      const sameCat = myCat && t.category && t.category === myCat;
      const freq = globalAltUsage.get(e.target) ?? 0;
      const jitter = rng(); // stable randomness for tie-breaking

      // Lower score is better for sorting
      const score =
        (sameCat ? 0 : 0.2) +        // prefer same category a bit
        freq * 0.05 +                // avoid over-used targets
        jitter * 0.01;               // stable randomness

      return { target: e.target, score, originalScore: e.score };
    })
    .filter(Boolean)
    .sort((a, b) => a!.score - b!.score)
    .slice(0, k * 2) // Get extra candidates for diversity filtering
    .map((item) => ({ target: item!.target, score: item!.originalScore }))
    .filter(e => e.target !== slug && !recSet.has(e.target))
    .filter(e => (currentInbound.get(e.target) || 0) < HUB_CAP)
    .slice(0, k);
}

function topUpInboundToTwo(graph: Neighbors, meta: Map<string, WhopData>) {
  const inbound = buildInboundCounts(graph);

  // Build donor pool: sources that can spare an explore outlink
  const sources = Object.keys(graph);

  // Precompute capacity and out sets for speed
  const outsMap = new Map<string, Set<string>>();
  for (const s of sources) outsMap.set(s, outSet(graph[s] ?? {}));

  // Gather targets that need help
  const needs = sources.filter((t) => (inbound.get(t) ?? 0) < 2);

  for (const t of needs) {
    // We need to add explore links **from donors** to t until inbound(t) >= 2
    let need = 2 - (inbound.get(t) ?? 0);
    if (need <= 0) continue;

    // simple donor ordering: prefer donors in same category, then by smallest out degree
    const myCat = meta.get(t)?.category;
    const donors = sources
      .filter((s) => s !== t)
      .filter((s) => {
        // donor must not already point to t and must be allowed to add explore
        const outs = outsMap.get(s)!;
        if (outs.has(t)) return false;
        return true;
      })
      .sort((a, b) => {
        const aSame = myCat && meta.get(a)?.category === myCat ? 0 : 1;
        const bSame = myCat && meta.get(b)?.category === myCat ? 0 : 1;
        if (aSame !== bSame) return aSame - bSame;
        // fewer outs first
        return (outsMap.get(a)!.size) - (outsMap.get(b)!.size);
      });

    for (const s of donors) {
      if (need <= 0) break;
      if (!hasCapacityInbound(inbound, t)) break; // protect hub cap on target

      // add explore s -> t
      const ok = addExploreLink(graph, inbound, s, t);
      if (ok) {
        // keep outsMap in sync
        outsMap.get(s)!.add(t);
        need -= 1;
      }
    }
  }
}

const prisma = new PrismaClient();

// SEO-Optimized Constants (ChatGPT's Multi-Pass Algorithm + Explore Slots)
const RECS = 4;                     // Recommendations per page
const ALTS = 4;                     // Alternatives per page (reduced from 5 to make room for explore)
const RECS_PER_PAGE = RECS;         // Backwards compatibility
const ALTS_PER_PAGE = ALTS;         // Backwards compatibility
const K_MAX_INBOUND = 250;          // Global hard cap (increased for explore capacity)
const MIN_WHOP_INBOUND = 2;         // Minimum whop→whop inbound (explore slots will fix this)
const M_MIN_INBOUND = 3;            // Legacy - now handled by explore system
const RECOMMENDATION_THRESHOLD = 20;
const ALTERNATIVES_THRESHOLD = 0.1;

// Diversity and Quality Weights
const W_POP = 0.35;                 // Popularity penalty weight
const W_SAME_CAT = 0.15;            // Penalize same category crowding
const W_SAME_BAND = 0.10;           // Penalize same price band crowding
const W_SAME_BR = 0.25;             // Penalize same brand/org
const P_EXPL = 0.15;                // Chance to add one exploration pick

// Diversity limits per block
const MAX_SAME_CAT = 2;
const MAX_SAME_BAND = 2;
const MAX_SAME_BR = 1;

// Helper functions
function isValidSlug(slug: string): boolean {
  return slug &&
         typeof slug === 'string' &&
         slug.length >= 2 &&
         slug.trim() !== '' &&
         slug !== '-' &&
         !slug.startsWith('-') &&
         !!slug.match(/^[a-z0-9-]+$/i);
}

function extractBrand(name: string): string | null {
  const brandMatch = name.match(/^([^-:|]+)(?:\s*[-:|]\s*|$)/);
  return brandMatch ? brandMatch[1].trim().toLowerCase() : null;
}

function parsePriceValue(price: string | null): number | null {
  if (!price) return null;
  const match = price.match(/[\d.,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', ''));
}

function priceBand(p?: number): string {
  return p == null ? 'unknown' : p < 50 ? 'low' : p < 200 ? 'mid' : 'high';
}

function popPenalty(inbound: number): number {
  return W_POP * Math.log(1 + inbound);
}

// Deterministic hash function for rotation
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

function diversityOk(list: string[], add: string, srcSlug: string, meta: Map<string, WhopData>): boolean {
  const t = meta.get(add) || {} as WhopData;
  const cat  = (t.category || 'unknown');
  const band = priceBand(parsePriceValue(t.price));
  const br   = (t.brand || 'unknown');

  let cCat = 0, cBand = 0, cBr = 0;
  for (const x of list) {
    const m = meta.get(x) || {} as WhopData;
    if ((m.category || 'unknown') === cat) cCat++;
    if (priceBand(parsePriceValue(m.price)) === band) cBand++;
    if ((m.brand || 'unknown') === br) cBr++;
  }
  if (cCat >= MAX_SAME_CAT)  return false;
  if (cBand >= MAX_SAME_BAND) return false;
  if (cBr >= MAX_SAME_BR)     return false;
  return true;
}

async function buildChatGPTSiteGraph(): Promise<void> {
  console.log('🚀 ChatGPT Multi-Pass SEO Graph Algorithm');
  console.log('🔍 Loading all whops from database...');

  // Load all whops
  const allWhops = await prisma.deal.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      price: true,
      rating: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  console.log(`📊 Found ${allWhops.length} total whops`);

  // Load gone slugs
  const goneSet = await getGoneWhopSlugs();
  console.log(`🚫 Excluding ${goneSet.size} gone slugs`);

  // Prepare whop data with metadata
  const activeWhops: WhopData[] = allWhops
    .filter(whop => !goneSet.has(whop.slug.toLowerCase()))
    .map(whop => ({
      ...whop,
      brand: extractBrand(whop.name),
      topics: extractTopics(whop.name, whop.description || ''),
    }));

  console.log(`✅ Processing ${activeWhops.length} active whops`);

  // Create metadata lookup
  const meta = new Map<string, WhopData>();
  activeWhops.forEach(whop => meta.set(whop.slug, whop));

  // ====================
  // PASS A: Build raw candidate pools
  // ====================
  console.log('🔗 Pass A: Building raw candidate pools...');
  const rawGraph: RawGraph = {};

  for (let i = 0; i < activeWhops.length; i++) {
    const currentWhop = activeWhops[i];
    const otherWhops = activeWhops.filter(w => w.id !== currentWhop.id);

    if (i % 100 === 0) {
      console.log(`  Progress: ${i}/${activeWhops.length} (${Math.round(i/activeWhops.length*100)}%)`);
    }

    // Compute recommendation candidates
    const recCandidates = otherWhops
      .map(candidate => {
        let score = 0;

        // Category match
        if (currentWhop.category && candidate.category) {
          if (currentWhop.category.toLowerCase() === candidate.category.toLowerCase()) {
            score += 100;
          }
        }

        // Topic similarity
        if (currentWhop.topics.length > 0 && candidate.topics.length > 0) {
          const commonTopics = currentWhop.topics.filter(topic =>
            candidate.topics.includes(topic)
          );
          if (commonTopics.length > 0) {
            if (currentWhop.topics[0] === candidate.topics[0]) {
              score += 80;
            }
            score += commonTopics.length * 25;
          }
        }

        // Price similarity
        if (currentWhop.price && candidate.price && currentWhop.price === candidate.price) {
          score += 10;
        }

        // Quality bonus
        const rating = candidate.rating ?? 0;
        if (rating > 4.0) {
          score += rating * 2;
        }

        return { target: candidate.slug, score };
      })
      .filter(item => item.score >= RECOMMENDATION_THRESHOLD && isValidSlug(item.target))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Keep top 50 candidates

    // Compute alternative candidates
    const altCandidates = otherWhops
      .map(candidate => {
        const topicSimilarity = jaccard(currentWhop.topics, candidate.topics);
        const priceSimilarity = priceAffinity(currentWhop.price, candidate.price);
        const combinedScore = (topicSimilarity * 0.8) + (priceSimilarity * 0.2);
        return { target: candidate.slug, score: combinedScore };
      })
      .filter(item => item.score > ALTERNATIVES_THRESHOLD && isValidSlug(item.target))
      .sort((a, b) => b.score - a.score)
      .slice(0, 50); // Keep top 50 candidates

    rawGraph[currentWhop.slug] = {
      recCandidates,
      altCandidates,
    };
  }

  // Compute initial in-degree from raw rec candidates
  console.log('📊 Computing initial in-degree distribution...');
  const indegree = new Map<string, number>();
  activeWhops.forEach(whop => indegree.set(whop.slug, 0));

  for (const slug of Object.keys(rawGraph)) {
    for (const e of rawGraph[slug].recCandidates.slice(0, 20)) {
      indegree.set(e.target, (indegree.get(e.target) || 0) + 1);
    }
  }

  // ====================
  // PASS B: Re-rank & pick per page (diversity + cap)
  // ====================
  console.log('🎯 Pass B: Re-ranking with diversity constraints...');
  const recsOut = new Map<string, string[]>();

  for (const slug of Object.keys(rawGraph)) {
    const src = meta.get(slug) || {} as WhopData;
    const used = new Set<string>();
    const counts = {
      cat: new Map<string, number>(),
      band: new Map<string, number>(),
      br: new Map<string, number>()
    };

    const rescored = rawGraph[slug].recCandidates
      .filter(e => e.target !== slug)
      .map(e => {
        const t = meta.get(e.target) || {} as WhopData;
        let s = e.score;
        s -= popPenalty(indegree.get(e.target) || 0);
        if (src.category && t.category && src.category === t.category) s -= W_SAME_CAT;
        if (priceBand(parsePriceValue(src.price)) === priceBand(parsePriceValue(t.price))) s -= W_SAME_BAND;
        if (src.brand && t.brand && src.brand === t.brand) s -= W_SAME_BR;

        // Quality boosts
        if ((t.rating || 0) >= 4.5) s += 0.05;
        if (t.updatedAt && Date.now() - new Date(t.updatedAt).getTime() < 1000*60*60*24*45) s += 0.03;

        return { ...e, score: s };
      })
      .sort((a, b) => b.score - a.score);

    const picks: string[] = [];
    for (const e of rescored) {
      if (picks.length >= RECS_PER_PAGE) break;
      if (used.has(e.target)) continue;
      if ((indegree.get(e.target) || 0) >= K_MAX_INBOUND) continue;

      const t = meta.get(e.target) || {} as WhopData;
      const cat = t.category || 'unknown';
      const band = priceBand(parsePriceValue(t.price));
      const br = t.brand || 'unknown';

      const cCat = counts.cat.get(cat) || 0;
      const cBand = counts.band.get(band) || 0;
      const cBr = counts.br.get(br) || 0;

      if (cCat >= MAX_SAME_CAT) continue;
      if (cBand >= MAX_SAME_BAND) continue;
      if (cBr >= MAX_SAME_BR) continue;

      picks.push(e.target);
      used.add(e.target);
      indegree.set(e.target, (indegree.get(e.target) || 0) + 1);

      counts.cat.set(cat, cCat + 1);
      counts.band.set(band, cBand + 1);
      counts.br.set(br, cBr + 1);
    }

    // Exploration slot (deterministic)
    if (picks.length < RECS_PER_PAGE) {
      const salt = hash(slug) % 997;
      const extra = rescored.find((e, i) =>
        !used.has(e.target) &&
        (indegree.get(e.target) || 0) < K_MAX_INBOUND / 4 &&
        ((i + salt) % 7 === 0)
      );
      if (extra) picks.push(extra.target);
    }

    recsOut.set(slug, picks.slice(0, RECS_PER_PAGE));
  }

  // Debug: Check max inbound after Pass B
  const debugInbound = new Map<string, number>();
  Object.keys(rawGraph).forEach(s => debugInbound.set(s, 0));
  for (const [s, arr] of recsOut) {
    for (const t of arr) {
      debugInbound.set(t, (debugInbound.get(t) || 0) + 1);
    }
  }
  const maxAfterB = Math.max(...Object.keys(rawGraph).map(s => debugInbound.get(s) || 0));
  console.log(`🔍 Debug: Max inbound after Pass B: ${maxAfterB}`);

  // ====================
  // PASS D: Avoid duplicate combos sitewide
  // ====================
  console.log('🔄 Pass D: Rotating to avoid duplicate combinations...');
  for (const [s, arr] of recsOut) {
    if (arr.length < RECS_PER_PAGE) continue;
    const shift = hash(s) % RECS_PER_PAGE;
    const rotated = arr.slice(shift).concat(arr.slice(0, shift));
    recsOut.set(s, rotated);
  }

  // ====================
  // PASS E: Finalize Alternatives (dedupe vs recs + diversity)
  // ====================
  console.log('📋 Pass E: Finalizing alternatives with deduplication...');

  // Recalculate current inbound counts after recommendations
  const currentInbound = new Map<string, number>();
  Object.keys(rawGraph).forEach(s => currentInbound.set(s, 0));
  for (const [s, arr] of recsOut) {
    for (const t of arr) {
      currentInbound.set(t, (currentInbound.get(t) || 0) + 1);
    }
  }

  const altsOut = new Map<string, string[]>();
  // Fix C: Add global alternative usage tracking
  const globalAltUsage = new Map<string, number>();

  for (const slug of Object.keys(rawGraph)) {
    const recSet = new Set(recsOut.get(slug) || []);
    const src = meta.get(slug) || {} as WhopData;

    // Apply popularity penalties and category/price penalties
    const filtered = rawGraph[slug].altCandidates
      .filter(e => e.target !== slug && !recSet.has(e.target))
      .map(e => {
        const t = meta.get(e.target) || {} as WhopData;
        let s = e.score;
        s -= popPenalty(indegree.get(e.target) || 0);
        if (src.category && t.category && src.category === t.category) s -= 0.05;
        if (priceBand(parsePriceValue(src.price)) === priceBand(parsePriceValue(t.price))) s -= 0.05;
        return { ...e, score: s };
      })
      .sort((a, b) => b.score - a.score);

    // Fix C: Use improved alternative selection with seeded shuffle and wider pool
    const picks = pickAlternatives(
      slug,
      filtered,
      meta,
      globalAltUsage,
      recSet,
      currentInbound,
      ALTS_PER_PAGE
    ).map(e => e.target);

    // Update global usage tracking and inbound counts
    for (const target of picks) {
      globalAltUsage.set(target, (globalAltUsage.get(target) ?? 0) + 1);
      currentInbound.set(target, (currentInbound.get(target) || 0) + 1);
    }

    altsOut.set(slug, picks);
  }

  // Debug: Check max inbound after Pass E (recs + alts)
  const debugInbound2 = new Map<string, number>();
  Object.keys(rawGraph).forEach(s => debugInbound2.set(s, 0));
  for (const [s, arr] of recsOut) {
    for (const t of arr) {
      debugInbound2.set(t, (debugInbound2.get(t) || 0) + 1);
    }
  }
  for (const [s, arr] of altsOut) {
    for (const t of arr) {
      debugInbound2.set(t, (debugInbound2.get(t) || 0) + 1);
    }
  }
  const maxAfterE = Math.max(...Object.keys(rawGraph).map(s => debugInbound2.get(s) || 0));
  console.log(`🔍 Debug: Max inbound after Pass E: ${maxAfterE}`);

  // ====================
  // PASS C: Strict Hub-Cap Orphan Rescue (ChatGPT's Safe Version)
  // ====================
  console.log('🔒 Pass C: Strict hub-cap orphan rescue...');

  // Build reverse index of current inbound links
  const parents = new Map<string, Set<string>>();
  for (const [s, arr] of recsOut) {
    for (const t of arr) {
      if (!parents.has(t)) parents.set(t, new Set());
      parents.get(t)!.add(s);
    }
  }
  for (const [s, arr] of altsOut) {
    for (const t of arr) {
      if (!parents.has(t)) parents.set(t, new Set());
      parents.get(t)!.add(s);
    }
  }

  // Track current inbound counts (will be updated during rescue)
  const inboundCounts = new Map<string, number>();
  for (const slug of Object.keys(rawGraph)) {
    inboundCounts.set(slug, parents.get(slug)?.size || 0);
  }

  const getInbound = (slug: string) => inboundCounts.get(slug) || 0;

  // Helper function to compute under-linked targets
  function computeUnderLinked(): string[] {
    return Object.keys(rawGraph)
      .filter(t => getInbound(t) < M_MIN_INBOUND)
      // rescue worst-off first; tie-break deterministically
      .sort((a, b) => {
        const da = getInbound(a) - getInbound(b);
        if (da !== 0) return da;
        return (hash(a) - hash(b));
      });
  }

  // Helper function to try adding target t to donor s (with optional swap)
  function tryRescueViaDonor(s: string, t: string): boolean {
    if (s === t) return false;
    if ((recsOut.get(s) || []).includes(t)) return false;
    if (getInbound(t) >= K_MAX_INBOUND) return false; // **STRICT HUB CAP**

    const list = recsOut.get(s) || [];

    // Quick diversity check if we can add without swap
    if (list.length < RECS_PER_PAGE) {
      if (!diversityOk(list, t, s, meta)) return false;
      // Safe to add
      list.push(t);
      recsOut.set(s, list);
      inboundCounts.set(t, getInbound(t) + 1);
      if (!parents.has(t)) parents.set(t, new Set());
      parents.get(t)!.add(s);
      return true;
    }

    // Donor full: attempt safe swap
    // Pick a removable target r from donor's current list:
    //  - r != t
    //  - removing r keeps its inbound >= M_MIN_INBOUND - 1
    //  - swapping keeps donor diversity valid with t
    //  - prefer removing an item with very high inbound (least SEO harm)
    let removableIndex = -1;
    let bestScore = -Infinity;

    for (let i = 0; i < list.length; i++) {
      const r = list[i];
      if (r === t) continue;
      const inboundR = getInbound(r);
      // don't remove if it would drop r below minimum inbound
      if (inboundR <= M_MIN_INBOUND) continue;

      // test diversity if r removed then t added
      const hypothetical = list.slice(0, i).concat(list.slice(i + 1));
      if (!diversityOk(hypothetical, t, s, meta)) continue;

      // prefer removing very popular targets (reduce hub pressure)
      const score = inboundR;
      if (score > bestScore) {
        bestScore = score;
        removableIndex = i;
      }
    }

    if (removableIndex >= 0) {
      const r = list[removableIndex];
      // perform swap
      const newList = list.slice();
      newList.splice(removableIndex, 1, t);
      recsOut.set(s, newList);

      // update inbound counts
      inboundCounts.set(t, getInbound(t) + 1);
      inboundCounts.set(r, Math.max(0, getInbound(r) - 1));

      // update parents tracking
      parents.get(r)?.delete(s);
      if (!parents.has(t)) parents.set(t, new Set());
      parents.get(t)!.add(s);

      return true;
    }

    return false;
  }

  // Multi-round rescue with strict cap and deterministic donor ordering
  const MAX_RESCUE_ROUNDS = 4;
  for (let round = 1; round <= MAX_RESCUE_ROUNDS; round++) {
    let progress = 0;

    const under = computeUnderLinked();
    if (under.length === 0) break;

    console.log(`  Rescue round ${round}: ${under.length} orphans remaining`);

    for (const t of under) {
      // Already satisfied?
      const need = M_MIN_INBOUND - getInbound(t);
      if (need <= 0) continue;

      // If target is near/at cap, do NOT accept any more links
      if (getInbound(t) >= K_MAX_INBOUND) continue;

      // Candidate donors: most similar to t, then stable tie-break
      const donorPool = (rawGraph[t]?.recCandidates || [])
        .map(e => e.target)
        .filter(s => s !== t)
        .sort((a, b) => {
          // stable order: by similarity position, then hash
          const ai = rawGraph[t].recCandidates.findIndex(e => e.target === a);
          const bi = rawGraph[t].recCandidates.findIndex(e => e.target === b);
          if (ai !== bi) return ai - bi;
          return hash(a + '→' + t) - hash(b + '→' + t);
        });

      let added = 0;

      for (const s of donorPool) {
        if (added >= need) break;

        if (tryRescueViaDonor(s, t)) {
          added++;
          progress++;
          if (getInbound(t) >= K_MAX_INBOUND) break; // hard stop if target hit cap
        }
      }
    }

    if (progress === 0) break; // no progress this round => stop early
  }

  // Final orphan check
  const finalOrphans = computeUnderLinked();
  console.log(`  Remaining orphans after strict rescue: ${finalOrphans.length}`);
  if (finalOrphans.length > 0) {
    console.log(`  ⚠️  ${finalOrphans.length} orphans could not be rescued without violating hub cap`);
  }

  // ====================
  // EXPLORE SLOT ASSIGNMENT - ChatGPT's Final Solution
  // ====================
  console.log('🔍 Explore Slot Assignment: Eliminating remaining orphans...');

  // A) Compute current whop→whop indegree (exclude taxonomy)
  const inW = new Map<string, number>();
  function bump(t: string) { inW.set(t, (inW.get(t) || 0) + 1); }

  for (const [s, arr] of recsOut) arr.forEach(bump);
  for (const [s, arr] of altsOut) arr.forEach(bump);

  // B) Targets that need help (< MIN_WHOP_INBOUND)
  const targets = Object.keys(rawGraph)
    .filter(slug => (inW.get(slug) || 0) < MIN_WHOP_INBOUND)
    .sort((a, b) => (inW.get(a) || 0) - (inW.get(b) || 0) || hash(a) - hash(b));

  console.log(`  Initial targets needing help: ${targets.length}`);

  // C) Donor slots (where we can place links)
  type Slot = { s: string, type: 'rec' | 'alt' | 'x' }; // x = explore
  const slots: Slot[] = [];

  for (const [s, arr] of recsOut) if (arr.length < RECS) slots.push({ s, type: 'rec' });
  for (const [s, arr] of altsOut) if (arr.length < ALTS) slots.push({ s, type: 'alt' });
  // One explore slot per whop (rendered as tiny text link)
  Object.keys(rawGraph).forEach(s => slots.push({ s, type: 'x' }));

  console.log(`  Available donor slots: ${slots.length} (rec: ${slots.filter(s => s.type === 'rec').length}, alt: ${slots.filter(s => s.type === 'alt').length}, explore: ${slots.filter(s => s.type === 'x').length})`);

  // D) Link feasibility & diversity guards
  const canLink = (s: string, t: string) => {
    if (s === t) return false;
    const ms = meta.get(s) || {} as WhopData;
    const mt = meta.get(t) || {} as WhopData;
    const sameCat = ms.category && mt.category && ms.category === mt.category;
    const sameBrand = ms.brand && mt.brand && ms.brand === mt.brand;
    // Simple similarity - could be enhanced with rawGraph similarity scores
    return sameCat || sameBrand || true; // Allow most links for explore (less restrictive)
  };

  function topicCloseness(s: string, t: string): number {
    // Simple closeness based on metadata similarity (lower is better)
    const ms = meta.get(s) || {} as WhopData;
    const mt = meta.get(t) || {} as WhopData;
    let closeness = 0;
    if (ms.category !== mt.category) closeness += 10;
    if (ms.brand !== mt.brand) closeness += 5;
    return closeness;
  }

  // E) Greedy assignment (no hub violations, fill to floor)
  const exploreOut = new Map<string, string>(); // new light-weight block

  for (const t of targets) {
    while ((inW.get(t) || 0) < MIN_WHOP_INBOUND) {
      if ((inW.get(t) || 0) >= K_MAX_INBOUND) break; // never create mega-hubs

      let pick = -1, bestKey = Infinity;

      for (let i = 0; i < slots.length; i++) {
        const slot = slots[i];
        const s = slot.s;

        if (!canLink(s, t)) continue;

        const list =
          slot.type === 'rec' ? (recsOut.get(s) || []) :
          slot.type === 'alt' ? (altsOut.get(s) || []) : [];

        // For rec/alt enforce diversity; for explore we only check canLink
        if (slot.type !== 'x' && !diversityOk(list, t, s, meta)) continue;

        // Preference: (1) fewer items used in that list, (2) topical closeness, (3) stable hash
        const used = list.length;
        const closeness = topicCloseness(s, t);
        const key = used * 1e6 + closeness * 1e3 + hash(s + '→' + t);
        if (key < bestKey) { bestKey = key; pick = i; }
      }

      if (pick === -1) break; // no safe donor; we'll try swapping next

      const slot = slots.splice(pick, 1)[0];
      let linkAssigned = false;

      if (slot.type === 'rec') {
        const l = recsOut.get(slot.s) || [];
        l.push(t);
        recsOut.set(slot.s, l);
        linkAssigned = true;
      }
      if (slot.type === 'alt') {
        const l = altsOut.get(slot.s) || [];
        l.push(t);
        altsOut.set(slot.s, l);
        linkAssigned = true;
      }
      if (slot.type === 'x') {
        // Fix B: Check for collisions with existing recs/alts before assigning explore
        const outs = new Set([...(recsOut.get(slot.s) || []), ...(altsOut.get(slot.s) || [])]);
        if (!outs.has(t) && (inW.get(t) || 0) < HUB_CAP) {
          exploreOut.set(slot.s, t);
          linkAssigned = true;
        }
      }

      if (linkAssigned) {
        inW.set(t, (inW.get(t) || 0) + 1);
      } else {
        // No link was assigned, break to avoid infinite loop
        break;
      }
    }
  }

  console.log(`  Explore links assigned: ${exploreOut.size}`);

  // Fix A: Hard guarantee ≥2 inbound links (final top-up pass) - RUN BEFORE QA CHECK
  console.log('🔄 Running final inbound top-up to guarantee ≥2 inbound links...');
  const originalExploreSize = exploreOut.size;
  const tempGraph: Neighbors = {};

  // First create temporary graph with current links
  for (const slug of Object.keys(rawGraph)) {
    if (!isValidSlug(slug)) continue; // Skip invalid slugs (empty, etc.)
    tempGraph[slug] = {
      recommendations: recsOut.get(slug) || [],
      alternatives: altsOut.get(slug) || [],
      explore: exploreOut.get(slug) || null,
      category: meta.get(slug)?.category
    };
  }

  // Run top-up function
  topUpInboundToTwo(tempGraph, meta);

  // Update exploreOut with new explore links from top-up
  for (const [slug, data] of Object.entries(tempGraph)) {
    if (data.explore && !exploreOut.has(slug)) {
      exploreOut.set(slug, data.explore);
    }
  }

  console.log(`  Additional explore links added via top-up: ${exploreOut.size - originalExploreSize}`);

  // Final check on remaining targets
  const remainingTargets = Object.keys(rawGraph)
    .filter(slug => (inW.get(slug) || 0) < MIN_WHOP_INBOUND);

  console.log(`  Remaining under-linked pages: ${remainingTargets.length}`);

  // ====================
  // BUILD QA GATES - ChatGPT's New Verification System
  // ====================
  console.log('🔍 Running QA gates with new thresholds...');

  const all = Object.keys(rawGraph);

  // Use inW (whop→whop indegree) for verification including explore links
  for (const [s, t] of exploreOut) {
    inW.set(t, (inW.get(t) || 0) + 1);
  }

  // Check minimum whop→whop inbound requirement (only for valid slugs)
  const underLinkedPages = all.filter(s => isValidSlug(s) && (inW.get(s) || 0) < MIN_WHOP_INBOUND);
  if (underLinkedPages.length > 0) {
    console.log(`❌ QA FAIL: ${underLinkedPages.length} pages below MIN_WHOP_INBOUND (${MIN_WHOP_INBOUND})`);
    underLinkedPages.slice(0, 10).forEach(slug => console.log(`  • ${slug}: ${inW.get(slug) || 0} whop→whop inbound`));
    throw new Error(`QA FAIL: ${underLinkedPages.length} pages below minimum whop→whop inbound threshold`);
  } else {
    console.log(`✅ QA PASS: All pages have ≥${MIN_WHOP_INBOUND} whop→whop inbound links`);
  }

  // Check hub cap enforcement
  const maxInbound = Math.max(...all.map(s => inW.get(s) || 0));
  if (maxInbound > K_MAX_INBOUND) {
    throw new Error(`❌ QA FAIL: Hub cap exceeded: ${maxInbound} > ${K_MAX_INBOUND}`);
  } else {
    console.log(`✅ QA PASS: Hub cap respected - max whop→whop inbound: ${maxInbound}`);
  }

  // Diversity stats
  const totalRecs = Array.from(recsOut.values()).reduce((sum, arr) => sum + arr.length, 0);
  const totalAlts = Array.from(altsOut.values()).reduce((sum, arr) => sum + arr.length, 0);
  const totalExplore = exploreOut.size;
  const avgInbound = Array.from(inW.values()).reduce((sum, count) => sum + count, 0) / all.length;

  console.log(`📊 Final Stats:`);
  console.log(`   Total recommendations: ${totalRecs}`);
  console.log(`   Total alternatives: ${totalAlts}`);
  console.log(`   Total explore links: ${totalExplore}`);
  console.log(`   Max whop→whop inbound: ${maxInbound}`);
  console.log(`   Average whop→whop inbound: ${avgInbound.toFixed(1)}`);
  console.log(`   Under-linked pages: ${underLinkedPages.length}`);

  // Check duplicate combinations
  const sig = (arr: string[]) => arr.join('|');
  const sigCounts = new Map<string, number>();
  for (const s of all) {
    const signature = sig(recsOut.get(s) || []);
    sigCounts.set(signature, (sigCounts.get(signature) || 0) + 1);
  }
  const topDup = Math.max(...Array.from(sigCounts.values()));
  if (topDup > 12) {
    console.log(`⚠️ QA WARN: High duplication cluster: ${topDup} pages share same rec set`);
  } else {
    console.log(`✅ QA PASS: Reasonable duplication - max duplicate set: ${topDup}`);
  }

  // ====================
  // BUILD OUTPUT FILES
  // ====================
  console.log('💾 Building output files...');

  const siteGraph: SiteGraph = {
    neighbors: {},
    topics: {},
    inboundCounts: {}
  };

  // Build neighbors (including explore links)
  for (const slug of all) {
    const neighbor: any = {
      recommendations: recsOut.get(slug) || [],
      alternatives: altsOut.get(slug) || []
    };

    // Add explore link if present
    if (exploreOut.has(slug)) {
      neighbor.explore = exploreOut.get(slug);
    }

    siteGraph.neighbors[slug] = neighbor;
  }

  // Build topics map
  for (const whop of activeWhops) {
    for (const topic of whop.topics) {
      if (!siteGraph.topics[topic]) {
        siteGraph.topics[topic] = [];
      }
      siteGraph.topics[topic].push(whop.slug);
    }
  }

  // Sort topic arrays deterministically
  for (const topic in siteGraph.topics) {
    siteGraph.topics[topic].sort();
  }

  // Build inbound counts using whop→whop indegree (inW)
  siteGraph.inboundCounts = Object.fromEntries(inW);

  // Write files
  const outputDir = path.join(process.cwd(), 'public', 'data', 'graph');
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(
    path.join(outputDir, 'neighbors.json'),
    JSON.stringify(siteGraph.neighbors, null, 0)
  );

  await fs.writeFile(
    path.join(outputDir, 'topics.json'),
    JSON.stringify(siteGraph.topics, null, 0)
  );

  await fs.writeFile(
    path.join(outputDir, 'inbound-counts.json'),
    JSON.stringify(siteGraph.inboundCounts, null, 0)
  );

  console.log('\n🎉 ChatGPT Explore Slot Algorithm Complete!');
  console.log('==========================================');
  console.log(`   Total whops: ${activeWhops.length}`);
  console.log(`   Total recommendations: ${totalRecs}`);
  console.log(`   Total alternatives: ${totalAlts}`);
  console.log(`   Total explore links: ${totalExplore}`);
  console.log(`   Max whop→whop inbound: ${maxInbound} (cap: ${K_MAX_INBOUND})`);
  console.log(`   Average whop→whop inbound: ${avgInbound.toFixed(1)}`);
  console.log(`   Under-linked pages: ${underLinkedPages.length} (target: 0)`);
  console.log(`   Unique rec combinations: ${sigCounts.size}`);
  console.log(`   Recommendation diversity: ${((sigCounts.size / all.length) * 100).toFixed(1)}%`);
  console.log(`\n✅ SEO-optimized graph with explore slots saved to ${outputDir}`);
}

async function main(): Promise<void> {
  try {
    await buildChatGPTSiteGraph();
  } catch (error) {
    console.error('❌ Error building ChatGPT optimized graph:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { buildChatGPTSiteGraph };