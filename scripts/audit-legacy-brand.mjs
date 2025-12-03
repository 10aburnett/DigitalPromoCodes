#!/usr/bin/env node
/**
 * Legacy Brand Audit Script
 *
 * Scans the repository for forbidden legacy brand strings and produces a report.
 * Run with: npm run audit:legacy-brand
 *
 * This is a guardrail script to ensure no old brand references leak into the new site.
 */

import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, extname, basename } from 'path';

// ============================================================================
// CONFIGURATION - Add patterns here as needed
// ============================================================================

const FORBIDDEN_PATTERNS = [
  // Old domain
  { pattern: /whpcodes\.com/gi, label: 'Old domain (whpcodes.com)', suggestion: 'Replace with new domain' },

  // Old brand names
  { pattern: /WHPCodes/g, label: 'Old brand name (WHPCodes)', suggestion: 'Replace with new brand name' },
  { pattern: /WHP Codes/gi, label: 'Old brand name (WHP Codes)', suggestion: 'Replace with new brand name' },

  // Route patterns that will need renaming
  { pattern: /\/whop\//g, label: 'Old route segment (/whop/)', suggestion: 'Phase 2: Rename to new route structure (e.g., /offer/)' },

  // Component naming patterns
  { pattern: /WhopCard/g, label: 'Component name (WhopCard)', suggestion: 'Phase 2: Rename to new component name (e.g., OfferCard)' },
  { pattern: /RecommendedWhops/g, label: 'Component name (RecommendedWhops)', suggestion: 'Phase 2: Rename component' },
  { pattern: /whopId/g, label: 'Variable name (whopId)', suggestion: 'Phase 2: Consider renaming in data layer' },

  // Old taglines/phrases that should be rewritten
  { pattern: /Whop Promo Codes/gi, label: 'Old tagline pattern', suggestion: 'Rewrite with new brand messaging' },
];

// Directories to completely skip (case-sensitive exact matches)
const IGNORE_DIRS = new Set([
  'node_modules',
  '.next',
  '.git',
  'dist',
  'build',
  '.vercel',
  'uploads',
  'favicon_io',
  // Data export directories with huge JSON files
  'data',
  'exports',
  'golden-scripts',
  // Cache directories
  'cache',
  '.cache',
]);

// Specific files to ignore
const IGNORE_FILES = new Set([
  'package-lock.json',
  'pnpm-lock.yaml',
  'yarn.lock',
  'audit-legacy-brand.mjs',
  'SEO-REBRAND-MASTER-CONTEXT.md',
  'rebrand-phase-1-legacy-audit.md',
]);

// Extensions to skip (binary and large data files)
const IGNORE_EXTENSIONS = new Set([
  '.log',
  '.ico',
  '.png',
  '.jpg',
  '.jpeg',
  '.gif',
  '.webp',
  '.svg',
  '.woff',
  '.woff2',
  '.ttf',
  '.eot',
  '.mp4',
  '.mp3',
  '.pdf',
  '.zip',
  '.tar',
  '.gz',
  '.json',      // Skip large JSON data files
  '.jsonl',     // Skip JSONL data files
  '.csv',       // Skip CSV data files
  '.sql',       // Skip SQL dumps
  '.numbers',   // Skip Numbers files
]);

// Only scan these extensions (allowlist approach for performance)
const SCAN_EXTENSIONS = new Set([
  '.ts',
  '.tsx',
  '.js',
  '.mjs',
  '.cjs',
  '.jsx',
  '.md',
  '.html',
  '.xml',
  '.css',
  '.scss',
  '.env',
  '.example',
]);

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function shouldIgnoreDir(dirName) {
  return IGNORE_DIRS.has(dirName) || dirName.startsWith('.');
}

function shouldIgnoreFile(fileName, ext) {
  if (IGNORE_FILES.has(fileName)) return true;
  if (IGNORE_EXTENSIONS.has(ext)) return true;
  // Use allowlist: only scan known source/config extensions
  if (!SCAN_EXTENSIONS.has(ext) && ext !== '') return true;
  return false;
}

function walkDirectory(dir, baseDir, files = [], depth = 0) {
  // Prevent infinite recursion
  if (depth > 20) return files;

  try {
    const entries = readdirSync(dir);

    for (const entry of entries) {
      // Skip ignored directories immediately
      if (shouldIgnoreDir(entry)) continue;

      const fullPath = join(dir, entry);

      try {
        const stat = statSync(fullPath);

        if (stat.isDirectory()) {
          walkDirectory(fullPath, baseDir, files, depth + 1);
        } else if (stat.isFile()) {
          const ext = extname(entry).toLowerCase();
          if (!shouldIgnoreFile(entry, ext)) {
            // Only add files under 1MB
            if (stat.size < 1024 * 1024) {
              files.push(fullPath);
            }
          }
        }
      } catch (e) {
        // Skip files we can't stat
      }
    }
  } catch (e) {
    // Skip directories we can't read
  }

  return files;
}

function searchFile(filePath, patterns) {
  try {
    const content = readFileSync(filePath, 'utf-8');
    const lines = content.split('\n');
    const results = new Map();

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      for (const { pattern, label } of patterns) {
        // Reset lastIndex for global patterns
        pattern.lastIndex = 0;
        if (pattern.test(line)) {
          if (!results.has(label)) {
            results.set(label, []);
          }
          results.get(label).push({
            line: i + 1,
            content: line.trim().substring(0, 100)
          });
        }
      }
    }

    return results;
  } catch (e) {
    return new Map();
  }
}

// ============================================================================
// MAIN EXECUTION
// ============================================================================

console.log('');
console.log('='.repeat(70));
console.log('  LEGACY BRAND AUDIT REPORT');
console.log('='.repeat(70));
console.log('');
console.log(`Scan started: ${new Date().toISOString()}`);
console.log(`Working directory: ${process.cwd()}`);
console.log('');

const baseDir = process.cwd();
console.log('Collecting source files (excluding data/json/binary files)...');
const files = walkDirectory(baseDir, baseDir);
console.log(`Found ${files.length} source files to scan\n`);

// Aggregate results
const findings = new Map();
for (const { label, suggestion } of FORBIDDEN_PATTERNS) {
  findings.set(label, { label, suggestion, matches: [] });
}

// Process files
let filesProcessed = 0;
for (const filePath of files) {
  const relativePath = relative(baseDir, filePath);
  const results = searchFile(filePath, FORBIDDEN_PATTERNS);

  for (const [label, matches] of results) {
    const finding = findings.get(label);
    for (const match of matches) {
      finding.matches.push({
        file: relativePath,
        line: match.line,
        content: match.content
      });
    }
  }

  filesProcessed++;
  if (filesProcessed % 100 === 0) {
    process.stdout.write(`\rProcessed ${filesProcessed}/${files.length} files...`);
  }
}
console.log(`\rProcessed ${filesProcessed}/${files.length} files.   \n`);

// Output summary
console.log('-'.repeat(70));
console.log('  SUMMARY');
console.log('-'.repeat(70));
console.log('');

let totalMatches = 0;
let patternsWithMatches = 0;

for (const { label, matches } of findings.values()) {
  if (matches.length > 0) {
    patternsWithMatches++;
    totalMatches += matches.length;
    console.log(`  ${label}: ${matches.length} matches`);
  }
}

console.log('');
console.log(`Total patterns checked: ${FORBIDDEN_PATTERNS.length}`);
console.log(`Patterns with matches: ${patternsWithMatches}`);
console.log(`Total matches found: ${totalMatches}`);
console.log('');

if (totalMatches === 0) {
  console.log('SUCCESS: No legacy brand references found in source files.');
  console.log('');
  process.exit(0);
}

console.log('-'.repeat(70));
console.log('  DETAILED FINDINGS');
console.log('-'.repeat(70));

for (const { label, suggestion, matches } of findings.values()) {
  if (matches.length === 0) continue;

  console.log(`\n[${label}] - ${matches.length} match(es)`);
  console.log(`Suggestion: ${suggestion}`);
  console.log('');

  // Group by file
  const byFile = new Map();
  for (const m of matches) {
    if (!byFile.has(m.file)) byFile.set(m.file, []);
    byFile.get(m.file).push(m);
  }

  let shown = 0;
  for (const [file, fileMatches] of byFile) {
    if (shown >= 15) {
      console.log(`  ... and ${matches.length - shown} more matches in other files`);
      break;
    }
    console.log(`  ${file}`);
    for (const m of fileMatches.slice(0, 3)) {
      console.log(`    L${m.line}: ${m.content.substring(0, 70)}${m.content.length > 70 ? '...' : ''}`);
      shown++;
    }
    if (fileMatches.length > 3) {
      console.log(`    ... and ${fileMatches.length - 3} more in this file`);
    }
  }
}

console.log('');
console.log('='.repeat(70));
console.log('  ACTION REQUIRED');
console.log('='.repeat(70));
console.log('');
console.log('The above references need to be addressed before launch.');
console.log('See notes/rebrand-phase-1-legacy-audit.md for the full checklist.');
console.log('');
console.log('Note: This scan excludes data/, exports/, and JSON/CSV files.');
console.log('Those will need separate review during content migration.');
console.log('');

process.exit(1);
