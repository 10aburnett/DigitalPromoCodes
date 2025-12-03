// scripts/build-graph.ts
// Builds deterministic site graph to eliminate orphan pages
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
  price: string | null;
  rating: number | null;
  topics: string[];
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

// Constants for ChatGPT 5-pass SEO graph optimization
const MAX_RECOMMENDATIONS = 4; // RECS_PER_PAGE
const MAX_ALTERNATIVES = 5; // ALTS_PER_PAGE
const K_MAX_INBOUND = 200; // Global hub cap - hard limit
const M_MIN_INBOUND = 3; // Minimum to avoid orphans
const MIN_RECOMMENDATIONS = 3; // Ensure sections always show
const RECOMMENDATION_THRESHOLD = 20; // Same as current API
const ALTERNATIVES_THRESHOLD = 0.1; // Same as current API

// Validation function to filter out invalid slugs
function isValidSlug(slug: string): boolean {
  return slug &&
         typeof slug === 'string' &&
         slug.length >= 2 &&
         slug.trim() !== '' &&
         slug !== '-' &&
         !slug.startsWith('-') &&
         slug.match(/^[a-z0-9-]+$/i);
}

async function buildSiteGraph(): Promise<void> {
  console.log('🔍 Loading all whops from database...');

  // Load all whops from database
  const allWhops = await prisma.deal.findMany({
    select: {
      id: true,
      slug: true,
      name: true,
      description: true,
      category: true,
      price: true,
      rating: true,
    },
  });

  console.log(`📊 Found ${allWhops.length} total whops`);

  // Load gone slugs to exclude them
  const goneSet = await getGoneWhopSlugs();
  console.log(`🚫 Excluding ${goneSet.size} gone slugs`);

  // Filter out gone whops and prepare data
  const activeWhops: WhopData[] = allWhops
    .filter(whop => !goneSet.has(whop.slug.toLowerCase()))
    .map(whop => ({
      ...whop,
      topics: extractTopics(whop.name, whop.description || ''),
    }));

  console.log(`✅ Processing ${activeWhops.length} active whops`);

  const siteGraph: SiteGraph = {
    neighbors: {},
    topics: {},
    inboundCounts: {},
  };

  // ChatGPT 5-Pass SEO Graph Optimization Algorithm
  console.log('🚀 Starting ChatGPT 5-Pass SEO Graph Optimization...');

  // Initialize tracking maps
  const inboundCounts = new Map<string, number>();
  for (const whop of activeWhops) {
    inboundCounts.set(whop.slug, 0);
  }

  // PASS A: Build Candidate Pools
  console.log('📋 Pass A: Building candidate pools...');
  const candidatePools = new Map<string, { recommendations: any[], alternatives: any[] }>();

  for (let i = 0; i < activeWhops.length; i++) {
    const currentWhop = activeWhops[i];
    const candidates = activeWhops.filter(w => w.id !== currentWhop.id);

    if (i % 50 === 0) {
      console.log(`  Progress: ${i}/${activeWhops.length} (${Math.round(i/activeWhops.length*100)}%)`);
    }

    // Calculate recommendation scores
    const recommendationScores = candidates.map(candidate => {
      let score = 0;

      // Exact category match
      if (currentWhop.category && candidate.category) {
        if (currentWhop.category.toLowerCase() === candidate.category.toLowerCase()) {
          score += 100;
        }
      }

      // Topic similarity
      const currentTopics = currentWhop.topics;
      const candidateTopics = candidate.topics;

      if (currentTopics.length > 0 && candidateTopics.length > 0) {
        const commonTopics = currentTopics.filter(topic => candidateTopics.includes(topic));

        if (commonTopics.length > 0) {
          // Primary topic match
          if (currentTopics[0] === candidateTopics[0]) {
            score += 80;
          }
          // Secondary topic matches
          score += commonTopics.length * 25;
        }
      }

      // Price similarity
      if (currentWhop.price && candidate.price && currentWhop.price === candidate.price) {
        score += 10;
      }

      // Quality bonus
      const r = candidate.rating ?? 0;
      if (r > 4.0) {
        score += r * 2;
      }

      return { candidate, score };
    });

    // Calculate alternative scores
    const alternativeScores = candidates.map(candidate => {
      const topicSimilarity = jaccard(currentWhop.topics, candidate.topics);
      const priceSimilarity = priceAffinity(currentWhop.price, candidate.price);
      const combinedScore = (topicSimilarity * 0.8) + (priceSimilarity * 0.2);

      return { candidate, score: combinedScore };
    });

    // Build candidate pools (larger than final selection for diversity)
    const recCandidates = recommendationScores
      .filter(item => item.score >= RECOMMENDATION_THRESHOLD)
      .filter(item => isValidSlug(item.candidate.slug))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.candidate.rating ?? 0) !== (a.candidate.rating ?? 0)) {
          return (b.candidate.rating ?? 0) - (a.candidate.rating ?? 0);
        }
        return a.candidate.slug.localeCompare(b.candidate.slug);
      })
      .slice(0, MAX_RECOMMENDATIONS * 3); // 3x pool size for diversity

    const altCandidates = alternativeScores
      .filter(item => item.score > ALTERNATIVES_THRESHOLD)
      .filter(item => isValidSlug(item.candidate.slug))
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.candidate.rating ?? 0) !== (a.candidate.rating ?? 0)) {
          return (b.candidate.rating ?? 0) - (a.candidate.rating ?? 0);
        }
        return a.candidate.slug.localeCompare(b.candidate.slug);
      })
      .slice(0, MAX_ALTERNATIVES * 3); // 3x pool size for diversity

    candidatePools.set(currentWhop.slug, {
      recommendations: recCandidates,
      alternatives: altCandidates
    });
  }

  // PASS B: Re-rank Recommendations with Diversity and Hub Cap Enforcement
  console.log('🎯 Pass B: Re-ranking with diversity and hub cap enforcement...');

  for (const whop of activeWhops) {
    const pool = candidatePools.get(whop.slug)!;
    const recommendations: string[] = [];

    for (const candidate of pool.recommendations) {
      if (recommendations.length >= MAX_RECOMMENDATIONS) break;

      // Hub cap check - skip if target already at cap
      if ((inboundCounts.get(candidate.candidate.slug) || 0) >= K_MAX_INBOUND) {
        continue;
      }

      recommendations.push(candidate.candidate.slug);
      inboundCounts.set(candidate.candidate.slug, (inboundCounts.get(candidate.candidate.slug) || 0) + 1);
    }

    siteGraph.neighbors[whop.slug] = {
      recommendations,
      alternatives: [] // Will be filled in Pass E
    };
  }

  console.log(`  Pass B complete: ${Object.keys(siteGraph.neighbors).length} whops have recommendations`);

  // PASS D: Rotation to Avoid Duplicates (ensure disjoint sets)
  console.log('🔄 Pass D: Rotating to avoid recommendation/alternative duplicates...');
  // This is implemented inherently by building alternatives separately from recommendations

  // PASS E: Build Alternatives with Hub Cap Enforcement
  console.log('🔗 Pass E: Building alternatives with hub cap enforcement...');

  const currentInbound = new Map(inboundCounts); // Copy for alternatives tracking

  for (const whop of activeWhops) {
    const pool = candidatePools.get(whop.slug)!;
    const existingRecs = new Set(siteGraph.neighbors[whop.slug].recommendations);
    const alternatives: string[] = [];

    for (const candidate of pool.alternatives) {
      if (alternatives.length >= MAX_ALTERNATIVES) break;

      // Skip if already in recommendations (maintain disjoint sets)
      if (existingRecs.has(candidate.candidate.slug)) continue;

      // Hub cap check - skip if target already at cap
      if ((currentInbound.get(candidate.candidate.slug) || 0) >= K_MAX_INBOUND) {
        continue;
      }

      alternatives.push(candidate.candidate.slug);
      currentInbound.set(candidate.candidate.slug, (currentInbound.get(candidate.candidate.slug) || 0) + 1);
    }

    siteGraph.neighbors[whop.slug].alternatives = alternatives;
  }

  console.log(`  Pass E complete: alternatives added with hub cap enforcement`);

  // Update inbound counts with alternatives
  for (const [slug, count] of currentInbound) {
    inboundCounts.set(slug, count);
  }

  // PASS C: Orphan Rescue with Strict Hub Cap Enforcement
  console.log('🚑 Pass C: Orphan rescue with strict hub cap enforcement...');

  let round = 1;
  let totalOrphansRescued = 0;

  while (round <= 5) { // Max 5 rounds to prevent infinite loops
    const orphans = activeWhops.filter(whop =>
      (inboundCounts.get(whop.slug) || 0) < M_MIN_INBOUND
    );

    if (orphans.length === 0) {
      console.log(`  All orphans rescued after ${round - 1} rounds!`);
      break;
    }

    console.log(`  Round ${round}: Rescuing ${orphans.length} orphans...`);
    let rescuedThisRound = 0;

    for (const orphan of orphans) {
      const needed = M_MIN_INBOUND - (inboundCounts.get(orphan.slug) || 0);
      if (needed <= 0) continue;

      // Skip if orphan itself is at hub cap (shouldn't happen but safety check)
      if ((inboundCounts.get(orphan.slug) || 0) >= K_MAX_INBOUND) {
        console.log(`  Warning: Orphan ${orphan.slug} is at hub cap - skipping`);
        continue;
      }

      // Find potential linkers sorted by similarity
      const potentialLinkers = activeWhops
        .filter(other => other.slug !== orphan.slug)
        .filter(other => isValidSlug(other.slug))
        .filter(other => {
          const neighbors = siteGraph.neighbors[other.slug];
          return !neighbors.alternatives.includes(orphan.slug) &&
                 !neighbors.recommendations.includes(orphan.slug);
        })
        .filter(other => {
          // Only use linkers that have room in their alternatives
          return siteGraph.neighbors[other.slug].alternatives.length < MAX_ALTERNATIVES;
        })
        .map(other => ({
          slug: other.slug,
          similarity: jaccard(orphan.topics, other.topics),
        }))
        .sort((a, b) => {
          if (b.similarity !== a.similarity) return b.similarity - a.similarity;
          return a.slug.localeCompare(b.slug); // Deterministic
        });

      let linksAdded = 0;
      for (const linker of potentialLinkers) {
        if (linksAdded >= needed) break;

        // Final hub cap check before adding link
        if ((inboundCounts.get(orphan.slug) || 0) >= K_MAX_INBOUND) {
          console.log(`  Orphan ${orphan.slug} reached hub cap during rescue`);
          break;
        }

        // Add to alternatives
        siteGraph.neighbors[linker.slug].alternatives.push(orphan.slug);
        inboundCounts.set(orphan.slug, (inboundCounts.get(orphan.slug) || 0) + 1);
        linksAdded++;
        rescuedThisRound++;
      }

      // If we're in a desperate round (3+), try adding to recommendations too
      if (round >= 3 && linksAdded < needed) {
        const desperateLinkers = activeWhops
          .filter(other => other.slug !== orphan.slug)
          .filter(other => isValidSlug(other.slug))
          .filter(other => {
            const neighbors = siteGraph.neighbors[other.slug];
            return !neighbors.alternatives.includes(orphan.slug) &&
                   !neighbors.recommendations.includes(orphan.slug);
          })
          .filter(other => {
            return siteGraph.neighbors[other.slug].recommendations.length < MAX_RECOMMENDATIONS;
          })
          .map(other => ({
            slug: other.slug,
            similarity: jaccard(orphan.topics, other.topics),
          }))
          .sort((a, b) => {
            if (b.similarity !== a.similarity) return b.similarity - a.similarity;
            return a.slug.localeCompare(b.slug);
          });

        for (const linker of desperateLinkers) {
          if (linksAdded >= needed) break;

          // Final hub cap check
          if ((inboundCounts.get(orphan.slug) || 0) >= K_MAX_INBOUND) {
            break;
          }

          siteGraph.neighbors[linker.slug].recommendations.push(orphan.slug);
          inboundCounts.set(orphan.slug, (inboundCounts.get(orphan.slug) || 0) + 1);
          linksAdded++;
          rescuedThisRound++;
        }
      }
    }

    console.log(`  Round ${round} rescued ${rescuedThisRound} orphan links`);
    totalOrphansRescued += rescuedThisRound;

    if (rescuedThisRound === 0) {
      console.log(`  No progress in round ${round} - stopping orphan rescue`);
      break;
    }

    round++;
  }

  console.log(`✅ Orphan rescue complete: ${totalOrphansRescued} links added`);

  // Convert inboundCounts Map to siteGraph object
  for (const [slug, count] of inboundCounts) {
    siteGraph.inboundCounts[slug] = count;
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

  // Sort topic arrays deterministically
  for (const topic in siteGraph.topics) {
    siteGraph.topics[topic].sort();
  }

  // Calculate initial inbound counts
  console.log('📊 Calculating inbound link counts...');
  for (const slug of activeWhops.map(w => w.slug)) {
    siteGraph.inboundCounts[slug] = 0;
  }

  for (const neighbors of Object.values(siteGraph.neighbors)) {
    for (const slug of [...neighbors.recommendations, ...neighbors.alternatives]) {
      if (siteGraph.inboundCounts[slug] !== undefined) {
        siteGraph.inboundCounts[slug]++;
      }
    }
  }

  // Orphan fixing is now handled by Pass C above

  // Guarantee minimum recommendations (ensure sections always show)
  console.log(`🔒 Ensuring minimum ${MIN_RECOMMENDATIONS} recommendations per whop...`);

  let recsFixed = 0;
  for (const whop of activeWhops) {
    const currentRecs = siteGraph.neighbors[whop.slug]?.recommendations || [];

    if (currentRecs.length < MIN_RECOMMENDATIONS) {
      const needed = MIN_RECOMMENDATIONS - currentRecs.length;

      // Find closest peers not already in recommendations or alternatives
      const usedSet = new Set([
        ...currentRecs,
        ...(siteGraph.neighbors[whop.slug]?.alternatives || []),
        whop.slug
      ]);

      const potentialRecs = activeWhops
        .filter(other => !usedSet.has(other.slug))
        .filter(other => isValidSlug(other.slug)) // Filter out invalid slugs
        .map(other => ({
          slug: other.slug,
          similarity: jaccard(whop.topics, other.topics),
          rating: other.rating ?? 0,
        }))
        .sort((a, b) => {
          if (b.similarity !== a.similarity) return b.similarity - a.similarity;
          if (b.rating !== a.rating) return b.rating - a.rating;
          return a.slug.localeCompare(b.slug); // Deterministic fallback
        })
        .slice(0, needed)
        .map(item => item.slug);

      // Add to recommendations list
      if (potentialRecs.length > 0) {
        const newRecs = [...currentRecs, ...potentialRecs];
        siteGraph.neighbors[whop.slug] = {
          ...siteGraph.neighbors[whop.slug],
          recommendations: newRecs
        };
        recsFixed++;
        console.log(`  Fixed recommendations: ${whop.slug} (was ${currentRecs.length}, now ${newRecs.length})`);
      }
    }
  }

  console.log(`✅ Fixed ${recsFixed} whops with insufficient recommendations`);

  // Validate recommendations and alternatives are disjoint
  console.log('🔍 Validating disjoint recommendations and alternatives...');
  let duplicates = 0;
  let totalWhops = 0;
  for (const [slug, neighbors] of Object.entries(siteGraph.neighbors)) {
    totalWhops++;
    const recSet = new Set(neighbors.recommendations);
    const overlaps = neighbors.alternatives.filter(altSlug => recSet.has(altSlug));
    if (overlaps.length > 0) {
      duplicates += overlaps.length;
      console.error(`❌ ${slug}: overlaps found -`, overlaps);
    }
  }

  if (duplicates > 0) {
    console.error(`❌ Found ${duplicates} recommendation/alternative overlaps across ${totalWhops} whops`);
    console.error('Graph validation failed - recommendations and alternatives must be disjoint');
    process.exit(1);
  }

  console.log(`✅ Validated ${totalWhops} whops - no overlaps between recommendations and alternatives`);

  // Write output files
  console.log('💾 Writing graph files...');

  const outputDir = path.join(process.cwd(), 'public', 'data', 'graph');
  await fs.mkdir(outputDir, { recursive: true });

  await fs.writeFile(
    path.join(outputDir, 'neighbors.json'),
    JSON.stringify(siteGraph.neighbors, null, 2)
  );

  await fs.writeFile(
    path.join(outputDir, 'topics.json'),
    JSON.stringify(siteGraph.topics, null, 2)
  );

  await fs.writeFile(
    path.join(outputDir, 'inbound-counts.json'),
    JSON.stringify(siteGraph.inboundCounts, null, 2)
  );

  // Generate summary statistics
  const stats = {
    totalWhops: activeWhops.length,
    totalGoneWhops: goneSet.size,
    totalTopics: Object.keys(siteGraph.topics).length,
    inboundStats: {
      min: Math.min(...Object.values(siteGraph.inboundCounts)),
      max: Math.max(...Object.values(siteGraph.inboundCounts)),
      avg: Math.round(Object.values(siteGraph.inboundCounts).reduce((a, b) => a + b, 0) / activeWhops.length * 100) / 100,
    },
    orphansEliminated: totalOrphansRescued,
    guaranteedMinimum: M_MIN_INBOUND,
    hubCapLimit: K_MAX_INBOUND,
  };

  await fs.writeFile(
    path.join(outputDir, 'stats.json'),
    JSON.stringify(stats, null, 2)
  );

  console.log('\n📈 Site Graph Statistics:');
  console.log(`  Total active whops: ${stats.totalWhops}`);
  console.log(`  Total topics: ${stats.totalTopics}`);
  console.log(`  Inbound links - Min: ${stats.inboundStats.min}, Max: ${stats.inboundStats.max}, Avg: ${stats.inboundStats.avg}`);
  console.log(`  Orphan links added: ${stats.orphansEliminated}`);
  console.log(`  Guaranteed minimum links per whop: ${stats.guaranteedMinimum}`);
  console.log(`  Hub cap limit: ${stats.hubCapLimit}`);

  // QA Gates: Validate hub cap compliance
  const finalOrphans = Object.values(siteGraph.inboundCounts).filter(count => count < M_MIN_INBOUND).length;
  const maxInbound = Math.max(...Object.values(siteGraph.inboundCounts));
  const hubCapViolations = Object.values(siteGraph.inboundCounts).filter(count => count > K_MAX_INBOUND).length;

  console.log('\n🔍 QA Gates:');
  console.log(`  Orphans remaining: ${finalOrphans}`);
  console.log(`  Max inbound links: ${maxInbound}`);
  console.log(`  Hub cap violations: ${hubCapViolations}`);

  if (finalOrphans > 0) {
    console.warn(`⚠️  Warning: ${finalOrphans} orphans remain`);
  }

  if (maxInbound > K_MAX_INBOUND) {
    console.warn(`⚠️  Warning: Max inbound (${maxInbound}) exceeds hub cap limit (${K_MAX_INBOUND})`);
  }

  if (hubCapViolations > 0) {
    console.warn(`⚠️  Warning: ${hubCapViolations} pages exceed hub cap limit`);
  }

  if (finalOrphans === 0 && hubCapViolations === 0) {
    console.log('✅ All QA gates passed!');
  }

  console.log('\n✅ Site graph generation complete!');
  console.log('📁 Generated files:');
  console.log('  - public/data/graph/neighbors.json');
  console.log('  - public/data/graph/topics.json');
  console.log('  - public/data/graph/inbound-counts.json');
  console.log('  - public/data/graph/stats.json');
}

// Run the build
buildSiteGraph()
  .catch(error => {
    console.error('❌ Error building site graph:', error);
    process.exit(1);
  })
  .finally(() => {
    prisma.$disconnect();
  });