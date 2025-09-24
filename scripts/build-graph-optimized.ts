// scripts/build-graph-optimized.ts
// SEO-Optimized site graph with diversity constraints and in-degree caps
// Generates: neighbors.json, topics.json, inbound-counts.json

import { PrismaClient } from '@prisma/client';
import fs from 'node:fs/promises';
import path from 'node:path';
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
}

interface CandidateScore {
  target: string;
  score: number;
  category?: string | null;
  brand?: string | null;
  price?: number | null;
  rating?: number | null;
}

interface NeighborData {
  recommendations: string[];
  alternatives: string[];
}

interface SiteGraph {
  neighbors: { [slug: string]: NeighborData };
  topics: { [topic: string]: string[] };
  inboundCounts: { [slug: string]: number };
}

const prisma = new PrismaClient();

// SEO-Optimized Constants (ChatGPT's Multi-Pass Algorithm)
const RECS_PER_PAGE = 4;
const ALTS_PER_PAGE = 5;            // Reduced from 6 for better focus
const M_MIN_INBOUND = 3;            // Minimum inbound per whop (no orphans)
const K_MAX_INBOUND = 200;          // Global hard cap (prevents mega-hubs)
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

// Validation function
function isValidSlug(slug: string): boolean {
  return slug &&
         typeof slug === 'string' &&
         slug.length >= 2 &&
         slug.trim() !== '' &&
         slug !== '-' &&
         !slug.startsWith('-') &&
         slug.match(/^[a-z0-9-]+$/i);
}

function extractBrand(name: string): string | null {
  // Extract brand/creator from whop name (first word or phrase before common separators)
  const brandMatch = name.match(/^([^-:|]+)(?:\s*[-:|]\s*|$)/);
  return brandMatch ? brandMatch[1].trim().toLowerCase() : null;
}

function parsePriceValue(price: string | null): number | null {
  if (!price) return null;
  const match = price.match(/[\d.,]+/);
  if (!match) return null;
  return parseFloat(match[0].replace(',', ''));
}

// ChatGPT's helper functions for multi-pass algorithm
function priceBand(p?: number): string {
  return p == null ? 'unknown' : p < 50 ? 'low' : p < 200 ? 'mid' : 'high';
}

function popPenalty(inbound: number): number {
  return W_POP * Math.log(1 + inbound);
}

// Deterministic "salt" so we can rotate tie-breakers without randomness
function hash(s: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  }
  return h >>> 0;
}

async function buildOptimizedSiteGraph(): Promise<void> {
  console.log('🔍 Loading all whops from database...');

  // Load all whops
  const allWhops = await prisma.whop.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      price: true,
      rating: true,
      createdAt: true,
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
  const whopMeta = new Map<string, WhopData>();
  activeWhops.forEach(whop => whopMeta.set(whop.slug, whop));

  const siteGraph: SiteGraph = {
    neighbors: {},
    topics: {},
    inboundCounts: {},
  };

  // Phase 1: Compute raw candidate scores
  console.log('🔗 Computing similarity scores...');
  const rawCandidates = new Map<string, CandidateScore[]>();

  for (let i = 0; i < activeWhops.length; i++) {
    const currentWhop = activeWhops[i];
    const otherWhops = activeWhops.filter(w => w.id !== currentWhop.id);

    if (i % 50 === 0) {
      console.log(`  Progress: ${i}/${activeWhops.length} (${Math.round(i/activeWhops.length*100)}%)`);
    }

    // Compute recommendation scores
    const recScores = otherWhops.map(candidate => {
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

      return {
        target: candidate.slug,
        score,
        category: candidate.category,
        brand: candidate.brand,
        price: parsePriceValue(candidate.price),
        rating: candidate.rating,
      };
    });

    // Compute alternative scores
    const altScores = otherWhops.map(candidate => {
      const topicSimilarity = jaccard(currentWhop.topics, candidate.topics);
      const priceSimilarity = priceAffinity(currentWhop.price, candidate.price);
      const combinedScore = (topicSimilarity * 0.8) + (priceSimilarity * 0.2);

      return {
        target: candidate.slug,
        score: combinedScore,
        category: candidate.category,
        brand: candidate.brand,
        price: parsePriceValue(candidate.price),
        rating: candidate.rating,
      };
    });

    rawCandidates.set(currentWhop.slug, [
      ...recScores.filter(s => s.score >= RECOMMENDATION_THRESHOLD),
      ...altScores.filter(s => s.score > ALTERNATIVES_THRESHOLD)
    ]);
  }

  // Phase 2: Compute initial in-degree counts
  console.log('📊 Computing global in-degree distribution...');
  const globalInbound = new Map<string, number>();
  activeWhops.forEach(whop => globalInbound.set(whop.slug, 0));

  // Count from top-N raw candidates
  rawCandidates.forEach(candidates => {
    candidates
      .sort((a, b) => b.score - a.score)
      .slice(0, 20) // Consider top 20 for counting
      .forEach(cand => {
        globalInbound.set(cand.target, (globalInbound.get(cand.target) || 0) + 1);
      });
  });

  // Phase 3: Re-rank with diversity constraints and popularity penalties
  console.log('🎯 Applying SEO optimization with diversity constraints...');

  for (const [slug, rawCands] of rawCandidates) {
    const currentWhop = whopMeta.get(slug)!;
    const seen = new Set<string>();

    // Re-score candidates with penalties
    const rescored = rawCands
      .filter(cand => isValidSlug(cand.target))
      .map(cand => {
        let adjustedScore = cand.score;

        // Apply popularity penalty (anti-hub)
        adjustedScore -= computePopularityPenalty(cand.target, globalInbound);

        // Apply diversity penalties
        if (currentWhop.category && cand.category &&
            currentWhop.category.toLowerCase() === cand.category.toLowerCase()) {
          adjustedScore -= W_CATEGORY * 100; // Reduce same-category dominance
        }

        if (currentWhop.brand && cand.brand &&
            currentWhop.brand === cand.brand) {
          adjustedScore -= W_BRAND * 100; // Reduce same-brand clustering
        }

        const currentPriceBand = getPriceBand(parsePriceValue(currentWhop.price));
        const candPriceBand = getPriceBand(cand.price);
        if (currentPriceBand === candPriceBand) {
          adjustedScore -= W_PRICE * 50; // Encourage price diversity
        }

        return { ...cand, score: adjustedScore };
      })
      .sort((a, b) => b.score - a.score);

    // Phase 4: Greedy selection with constraints
    const recommendations: string[] = [];
    const alternatives: string[] = [];
    const usedCategories = new Set<string>();
    const usedBrands = new Set<string>();
    const usedPriceBands = new Set<string>();

    // Select recommendations with diversity
    for (const cand of rescored) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;
      if (seen.has(cand.target)) continue;
      if ((globalInbound.get(cand.target) || 0) >= MAX_GLOBAL_INBOUND) continue;

      const candPriceBand = getPriceBand(cand.price);

      // Diversity checks (soft constraints - allow repeats after first few picks)
      const categoryOK = !usedCategories.has(cand.category || '') || recommendations.length >= 2;
      const brandOK = !usedBrands.has(cand.brand || '') || recommendations.length >= 2;
      const priceOK = !usedPriceBands.has(candPriceBand) || recommendations.length >= 2;

      if (categoryOK && brandOK && priceOK) {
        recommendations.push(cand.target);
        seen.add(cand.target);
        usedCategories.add(cand.category || '');
        usedBrands.add(cand.brand || '');
        usedPriceBands.add(candPriceBand);

        // Update global inbound count
        globalInbound.set(cand.target, (globalInbound.get(cand.target) || 0) + 1);
      }
    }

    // Exploration slot - add a long-tail item occasionally
    if (Math.random() < P_EXPLORATION && recommendations.length < MAX_RECOMMENDATIONS) {
      const longTailCand = rescored.find(cand =>
        !seen.has(cand.target) &&
        (globalInbound.get(cand.target) || 0) < MAX_GLOBAL_INBOUND / 4 &&
        (globalInbound.get(cand.target) || 0) < 10 // Prefer rarely-recommended items
      );
      if (longTailCand) {
        recommendations.push(longTailCand.target);
        seen.add(longTailCand.target);
      }
    }

    // Select alternatives (disjoint from recommendations)
    for (const cand of rescored) {
      if (alternatives.length >= MAX_ALTERNATIVES) break;
      if (seen.has(cand.target)) continue;
      if ((globalInbound.get(cand.target) || 0) >= MAX_GLOBAL_INBOUND) continue;

      alternatives.push(cand.target);
      seen.add(cand.target);
      globalInbound.set(cand.target, (globalInbound.get(cand.target) || 0) + 1);
    }

    siteGraph.neighbors[slug] = { recommendations, alternatives };
  }

  // Build topics map
  console.log('🏷️ Building topics map...');
  for (const whop of activeWhops) {
    for (const topic of whop.topics) {
      if (!siteGraph.topics[topic]) {
        siteGraph.topics[topic] = [];
      }
      siteGraph.topics[topic].push(whop.slug);
    }
  }

  for (const topic in siteGraph.topics) {
    siteGraph.topics[topic].sort();
  }

  // Calculate final inbound counts
  console.log('📊 Calculating final inbound link counts...');
  activeWhops.forEach(whop => siteGraph.inboundCounts[whop.slug] = 0);

  for (const neighbors of Object.values(siteGraph.neighbors)) {
    for (const slug of [...neighbors.recommendations, ...neighbors.alternatives]) {
      if (siteGraph.inboundCounts[slug] !== undefined) {
        siteGraph.inboundCounts[slug]++;
      }
    }
  }

  // Aggressive orphan handling - ZERO orphans allowed
  console.log(`🔒 Ensuring minimum ${MIN_INBOUND_LINKS} inbound links per whop...`);
  let orphanWhops = activeWhops.filter(whop =>
    (siteGraph.inboundCounts[whop.slug] || 0) < MIN_INBOUND_LINKS
  );

  let rounds = 0;
  while (orphanWhops.length > 0 && rounds < 5) {
    rounds++;
    console.log(`  Round ${rounds}: Processing ${orphanWhops.length} orphans`);

    for (const orphan of orphanWhops) {
      const currentCount = siteGraph.inboundCounts[orphan.slug] || 0;
      const needed = MIN_INBOUND_LINKS - currentCount;
      let added = 0;

      // Find potential sources - be more flexible about space requirements
      const potentialSources = activeWhops
        .filter(whop => whop.slug !== orphan.slug)
        .filter(whop => {
          const current = siteGraph.neighbors[whop.slug];
          // Allow expanding alternatives even if at max, for orphan rescue
          return current.alternatives.length < MAX_ALTERNATIVES + 2; // Extra capacity for orphans
        })
        .sort(() => Math.random() - 0.5) // Randomize to spread orphans around
        .slice(0, needed * 3); // Get more potential sources

      for (const source of potentialSources) {
        if (added >= needed) break;

        const neighbors = siteGraph.neighbors[source.slug];
        if (!neighbors.recommendations.includes(orphan.slug) &&
            !neighbors.alternatives.includes(orphan.slug)) {

          // Add to alternatives (expand beyond normal max if needed for orphans)
          neighbors.alternatives.push(orphan.slug);
          siteGraph.inboundCounts[orphan.slug]++;
          added++;
        }
      }
    }

    // Check remaining orphans
    orphanWhops = activeWhops.filter(whop =>
      (siteGraph.inboundCounts[whop.slug] || 0) < MIN_INBOUND_LINKS
    );
  }

  // Final report
  const finalOrphans = activeWhops.filter(whop =>
    (siteGraph.inboundCounts[whop.slug] || 0) === 0
  );

  if (finalOrphans.length > 0) {
    console.log(`  ❌ CRITICAL: ${finalOrphans.length} pages still have 0 inbound links after ${rounds} rounds`);
    finalOrphans.slice(0, 10).forEach(orphan => {
      console.log(`    • ${orphan.slug}: ${siteGraph.inboundCounts[orphan.slug] || 0} inbound links`);
    });
  } else {
    console.log(`  ✅ SUCCESS: All pages have at least 1 inbound link after ${rounds} rounds`);
  }

  // Output files
  const outputDir = path.join(process.cwd(), 'public', 'data', 'graph');
  await fs.mkdir(outputDir, { recursive: true });

  console.log('💾 Writing graph files...');

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

  // Generate stats
  const totalRecs = Object.values(siteGraph.neighbors)
    .reduce((sum, n) => sum + n.recommendations.length, 0);
  const totalAlts = Object.values(siteGraph.neighbors)
    .reduce((sum, n) => sum + n.alternatives.length, 0);

  const inboundStats = Object.values(siteGraph.inboundCounts);
  const maxInbound = Math.max(...inboundStats);
  const avgInbound = inboundStats.reduce((sum, count) => sum + count, 0) / inboundStats.length;

  const hubWhops = Object.entries(siteGraph.inboundCounts)
    .filter(([_, count]) => count > 100)
    .sort(([,a], [,b]) => b - a);

  console.log('\n📈 SEO-Optimized Graph Statistics:');
  console.log(`   Total whops: ${activeWhops.length}`);
  console.log(`   Total recommendations: ${totalRecs}`);
  console.log(`   Total alternatives: ${totalAlts}`);
  console.log(`   Max inbound links: ${maxInbound}`);
  console.log(`   Average inbound links: ${avgInbound.toFixed(1)}`);
  console.log(`   High-traffic hubs (>100 links): ${hubWhops.length}`);

  if (hubWhops.length > 0) {
    console.log('   Top hubs:');
    hubWhops.slice(0, 5).forEach(([slug, count]) => {
      console.log(`     ${slug}: ${count} inbound links`);
    });
  }

  console.log(`\n✅ SEO-optimized graph saved to ${outputDir}`);
}

async function main(): Promise<void> {
  try {
    await buildOptimizedSiteGraph();
  } catch (error) {
    console.error('❌ Error building optimized graph:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main();
}

export { buildOptimizedSiteGraph };