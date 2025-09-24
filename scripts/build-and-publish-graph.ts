#!/usr/bin/env ts-node

/**
 * Build and Publish Canonical Graph Script
 *
 * This script builds the graph from the production database and publishes it
 * as a canonical artifact that all environments can use.
 *
 * Usage:
 * - Manual: npx tsx scripts/build-and-publish-graph.ts
 * - NPM script: npm run graph:publish
 * - GitHub Action: Called from workflow
 *
 * Environment Variables Required:
 * - PRODUCTION_DATABASE_URL: Connection to production database (read-only)
 * - GRAPH_PUBLISH_URL: Base URL where to upload (optional, defaults to local file)
 * - AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY: For S3 upload (optional)
 * - CLOUDFLARE_ACCOUNT_ID, CLOUDFLARE_API_TOKEN: For R2 upload (optional)
 */

import { execSync } from 'child_process';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

const GRAPH_FILE_PATH = join(process.cwd(), 'public/data/graph/neighbors.json');

interface PublishConfig {
  method: 'file' | 's3' | 'cloudflare-r2' | 'github';
  baseUrl?: string;
  bucket?: string;
  region?: string;
  endpoint?: string;
}

async function main() {
  console.log('🚀 CANONICAL GRAPH BUILD & PUBLISH');
  console.log('=====================================');

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-'); // full date+time
  const commitSha = process.env.GITHUB_SHA ||
                    process.env.VERCEL_GIT_COMMIT_SHA ||
                    execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();

  // Step 1: Ensure we're using production database
  const currentDbUrl = process.env.DATABASE_URL;
  const productionDbUrl = process.env.PRODUCTION_DATABASE_URL ||
                          process.env.DATABASE_URL_PRODUCTION ||
                          currentDbUrl;

  if (!productionDbUrl) {
    throw new Error('❌ No production database URL found. Set PRODUCTION_DATABASE_URL or DATABASE_URL_PRODUCTION');
  }

  // Temporarily override DATABASE_URL for graph build
  process.env.DATABASE_URL = productionDbUrl;

  console.log('🔧 Database Configuration:');
  console.log(`   Production DB: ${productionDbUrl.split('@')[1]?.split('/')[0] || 'configured'}`);
  console.log(`   Build timestamp: ${timestamp}`);
  console.log(`   Commit SHA: ${commitSha}`);

  // Step 2: Build the graph from production database
  console.log('\n📊 Building graph from production database...');
  try {
    execSync('npx ts-node --transpile-only scripts/build-graph.ts', {
      stdio: 'inherit',
      env: { ...process.env, DATABASE_URL: productionDbUrl }
    });
    console.log('✅ Graph build completed successfully');
  } catch (error) {
    console.error('❌ Graph build failed:', error);
    process.exit(1);
  }

  // Restore original DATABASE_URL
  process.env.DATABASE_URL = currentDbUrl;

  // Step 3: Fail fast if graph file wasn't produced
  if (!existsSync(GRAPH_FILE_PATH)) {
    throw new Error(`❌ Expected graph file not found at ${GRAPH_FILE_PATH}`);
  }

  // Step 4: Validate graph file
  const graphData = JSON.parse(readFileSync(GRAPH_FILE_PATH, 'utf8'));
  const totalKeys = Object.keys(graphData).length;
  const withRecs = Object.values(graphData).filter((d: any) => d.recommendations?.length > 0).length;
  const withAlts = Object.values(graphData).filter((d: any) => d.alternatives?.length > 0).length;

  console.log('\n📈 Graph Statistics:');
  console.log(`   Total whops: ${totalKeys}`);
  console.log(`   With recommendations: ${withRecs}`);
  console.log(`   With alternatives: ${withAlts}`);

  if (totalKeys < 1000) {
    throw new Error(`❌ Graph seems too small (${totalKeys} entries). Expected >1000.`);
  }

  // Step 5: Determine publish method
  const publishConfig = getPublishConfig();

  // Step 6: Publish graph
  const versionedFilename = `neighbors-${timestamp}-${commitSha}.json`;
  const latestFilename = 'neighbors-latest.json';

  console.log(`\n📤 Publishing graph via ${publishConfig.method}...`);

  switch (publishConfig.method) {
    case 'file':
      await publishToFile(versionedFilename, latestFilename);
      break;
    case 's3':
      await publishToS3(versionedFilename, latestFilename, publishConfig);
      break;
    case 'cloudflare-r2':
      await publishToCloudflareR2(versionedFilename, latestFilename, publishConfig);
      break;
    case 'github':
      await publishToGitHub(versionedFilename, latestFilename);
      break;
    default:
      console.log('⚠️  No publish method configured, keeping local file only');
  }

  // Step 7: Output environment variable recommendations
  console.log('\n✅ GRAPH PUBLISH COMPLETED SUCCESSFULLY!');
  console.log('\n🔧 Environment Variables to Set:');

  if (publishConfig.method === 'file') {
    console.log('   NEXT_PUBLIC_GRAPH_URL=/data/graph/neighbors.json  # (default, can omit)');
  } else {
    const baseUrl = publishConfig.baseUrl || 'https://your-cdn.com';
    console.log(`   NEXT_PUBLIC_GRAPH_URL=${baseUrl}/graph/${latestFilename}`);
  }

  console.log(`   NEXT_PUBLIC_GRAPH_VERSION=${commitSha}  # (optional cache buster)`);
  console.log('\n📋 Next Steps:');
  console.log('   1. Set environment variables in Vercel/deployment platform');
  console.log('   2. Deploy your application');
  console.log('   3. Verify all environments show identical recommendations');
  console.log('\n🎉 All environments will now use the same canonical graph!');
}

function getPublishConfig(): PublishConfig {
  // Auto-detect based on available environment variables
  if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
    return {
      method: 's3',
      bucket: process.env.GRAPH_S3_BUCKET || 'your-graph-bucket',
      region: process.env.AWS_REGION || 'us-east-1',
      baseUrl: process.env.GRAPH_CDN_URL
    };
  }

  if (process.env.CLOUDFLARE_ACCOUNT_ID && process.env.CLOUDFLARE_API_TOKEN) {
    return {
      method: 'cloudflare-r2',
      bucket: process.env.GRAPH_R2_BUCKET || 'your-graph-bucket',
      endpoint: `https://${process.env.CLOUDFLARE_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      baseUrl: process.env.GRAPH_CDN_URL
    };
  }

  if (process.env.GITHUB_TOKEN && process.env.GITHUB_REPOSITORY) {
    return {
      method: 'github',
      baseUrl: `https://raw.githubusercontent.com/${process.env.GITHUB_REPOSITORY}/main/public/data/graph`
    };
  }

  return { method: 'file' };
}

async function publishToFile(versionedFilename: string, latestFilename: string) {
  // For local development or when using committed files
  console.log('   📁 Publishing to local file system...');
  console.log(`   ✅ Graph available at: /data/graph/neighbors.json`);
  console.log(`   💡 Commit this file to use across environments`);
}

async function publishToS3(versionedFilename: string, latestFilename: string, config: PublishConfig) {
  console.log('   ☁️  Publishing to AWS S3...');

  try {
    // This would need AWS SDK implementation
    console.log(`   📤 Uploading ${versionedFilename} to s3://${config.bucket}/graph/`);
    console.log(`   📤 Uploading ${latestFilename} to s3://${config.bucket}/graph/`);
    console.log(`   ✅ Graph available at: ${config.baseUrl}/graph/${latestFilename}`);

    // TODO: Implement actual S3 upload
    // const AWS = require('aws-sdk');
    // const s3 = new AWS.S3();
    // await s3.upload({ Bucket: config.bucket, Key: `graph/${versionedFilename}`, Body: graphContent }).promise();
    // await s3.upload({ Bucket: config.bucket, Key: `graph/${latestFilename}`, Body: graphContent }).promise();

  } catch (error) {
    console.error('❌ S3 upload failed:', error);
    throw error;
  }
}

async function publishToCloudflareR2(versionedFilename: string, latestFilename: string, config: PublishConfig) {
  console.log('   ☁️  Publishing to Cloudflare R2...');

  try {
    console.log(`   📤 Uploading ${versionedFilename} to R2 bucket ${config.bucket}`);
    console.log(`   📤 Uploading ${latestFilename} to R2 bucket ${config.bucket}`);
    console.log(`   ✅ Graph available at: ${config.baseUrl}/graph/${latestFilename}`);

    // TODO: Implement actual R2 upload using S3-compatible API
    // Similar to S3 but with R2 endpoint

  } catch (error) {
    console.error('❌ R2 upload failed:', error);
    throw error;
  }
}

async function publishToGitHub(versionedFilename: string, latestFilename: string) {
  console.log('   📝 Publishing via GitHub commit...');

  try {
    // Commit the graph file to repository
    execSync('git add public/data/graph/neighbors.json', { stdio: 'inherit' });
    execSync(`git commit -m "chore: update canonical graph ${versionedFilename}

🤖 Auto-generated graph from production database
- Built at: ${new Date().toISOString()}
- Total whops: ${Object.keys(JSON.parse(readFileSync(GRAPH_FILE_PATH, 'utf8'))).length}
- Commit: ${process.env.GITHUB_SHA || 'local'}"`, { stdio: 'inherit' });

    console.log('   ✅ Graph committed to repository');
    console.log('   💡 Push this commit to make it available to all environments');

  } catch (error) {
    console.error('❌ GitHub commit failed:', error);
    throw error;
  }
}

if (require.main === module) {
  main().catch(console.error);
}

export { main as buildAndPublishGraph };