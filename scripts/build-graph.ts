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

// Constants matching current API behavior
const MAX_RECOMMENDATIONS = 4;
const MAX_ALTERNATIVES = 6;
const MIN_INBOUND_LINKS = 3; // Guarantee minimum inbound links per whop
const RECOMMENDATION_THRESHOLD = 20; // Same as current API
const ALTERNATIVES_THRESHOLD = 0.1; // Same as current API

async function buildSiteGraph(): Promise<void> {
  console.log('🔍 Loading all whops from database...');

  // Load all whops from database
  const allWhops = await prisma.whop.findMany({
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

  // Build neighbors for each whop
  console.log('🔗 Computing similarity scores and building neighbor lists...');

  for (let i = 0; i < activeWhops.length; i++) {
    const currentWhop = activeWhops[i];
    const candidates = activeWhops.filter(w => w.id !== currentWhop.id);

    if (i % 50 === 0) {
      console.log(`  Progress: ${i}/${activeWhops.length} (${Math.round(i/activeWhops.length*100)}%)`);
    }

    // Calculate recommendations (using same algorithm as current API)
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

    // Calculate alternatives (using same algorithm as current API)
    const alternativeScores = candidates.map(candidate => {
      const topicSimilarity = jaccard(currentWhop.topics, candidate.topics);
      const priceSimilarity = priceAffinity(currentWhop.price, candidate.price);
      const combinedScore = (topicSimilarity * 0.8) + (priceSimilarity * 0.2);

      return { candidate, score: combinedScore };
    });

    // Select top recommendations and alternatives
    const recommendations = recommendationScores
      .filter(item => item.score >= RECOMMENDATION_THRESHOLD)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.candidate.rating ?? 0) !== (a.candidate.rating ?? 0)) {
          return (b.candidate.rating ?? 0) - (a.candidate.rating ?? 0);
        }
        return a.candidate.slug.localeCompare(b.candidate.slug); // Deterministic fallback
      })
      .slice(0, MAX_RECOMMENDATIONS)
      .map(item => item.candidate.slug);

    const alternatives = alternativeScores
      .filter(item => item.score > ALTERNATIVES_THRESHOLD)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if ((b.candidate.rating ?? 0) !== (a.candidate.rating ?? 0)) {
          return (b.candidate.rating ?? 0) - (a.candidate.rating ?? 0);
        }
        return a.candidate.slug.localeCompare(b.candidate.slug); // Deterministic fallback
      })
      .slice(0, MAX_ALTERNATIVES)
      .map(item => item.candidate.slug);

    siteGraph.neighbors[currentWhop.slug] = {
      recommendations,
      alternatives,
    };
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

  // Guarantee minimum inbound links (eliminate orphans)
  console.log(`🔒 Ensuring minimum ${MIN_INBOUND_LINKS} inbound links per whop...`);

  let orphansFixed = 0;
  for (const whop of activeWhops) {
    const currentCount = siteGraph.inboundCounts[whop.slug] || 0;

    if (currentCount < MIN_INBOUND_LINKS) {
      const needed = MIN_INBOUND_LINKS - currentCount;

      // Find closest peers not already linking to this whop
      const potentialLinkers = activeWhops
        .filter(other => other.slug !== whop.slug)
        .filter(other => {
          const neighbors = siteGraph.neighbors[other.slug];
          return !neighbors.alternatives.includes(whop.slug) &&
                 !neighbors.recommendations.includes(whop.slug);
        })
        .map(other => ({
          slug: other.slug,
          similarity: jaccard(whop.topics, other.topics),
        }))
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, needed);

      // Add this whop to their alternatives lists
      for (const linker of potentialLinkers) {
        const neighbors = siteGraph.neighbors[linker.slug];
        if (neighbors.alternatives.length < MAX_ALTERNATIVES) {
          neighbors.alternatives.push(whop.slug);
          siteGraph.inboundCounts[whop.slug]++;
        }
      }

      if (potentialLinkers.length > 0) {
        orphansFixed++;
        console.log(`  Fixed orphan: ${whop.slug} (was ${currentCount}, now ${siteGraph.inboundCounts[whop.slug]} inbound)`);
      }
    }
  }

  console.log(`✅ Fixed ${orphansFixed} orphan pages`);

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
    orphansEliminated: orphansFixed,
    guaranteedMinimum: MIN_INBOUND_LINKS,
  };

  await fs.writeFile(
    path.join(outputDir, 'stats.json'),
    JSON.stringify(stats, null, 2)
  );

  console.log('\n📈 Site Graph Statistics:');
  console.log(`  Total active whops: ${stats.totalWhops}`);
  console.log(`  Total topics: ${stats.totalTopics}`);
  console.log(`  Inbound links - Min: ${stats.inboundStats.min}, Max: ${stats.inboundStats.max}, Avg: ${stats.inboundStats.avg}`);
  console.log(`  Orphans eliminated: ${stats.orphansEliminated}`);
  console.log(`  Guaranteed minimum links per whop: ${stats.guaranteedMinimum}`);

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