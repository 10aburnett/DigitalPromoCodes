import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

export async function GET() {
  try {
    // Check if CommunityPromoSection exists
    const componentPath = path.join(process.cwd(), 'src/components/CommunityPromoSection.tsx');
    const componentExists = fs.existsSync(componentPath);
    
    // Check if whop page imports CommunityPromoSection
    const whopPagePath = path.join(process.cwd(), 'src/app/whop/[slug]/page.tsx');
    const whopPageExists = fs.existsSync(whopPagePath);
    
    let whopPageContent = '';
    let hasCommunityImport = false;
    let hasCommunityUsage = false;
    
    if (whopPageExists) {
      whopPageContent = fs.readFileSync(whopPagePath, 'utf8');
      hasCommunityImport = whopPageContent.includes('CommunityPromoSection');
      hasCommunityUsage = whopPageContent.includes('<CommunityPromoSection');
    }
    
    // Get git commit info if available
    let gitCommit = 'unknown';
    try {
      const gitPath = path.join(process.cwd(), '.git/HEAD');
      if (fs.existsSync(gitPath)) {
        const headContent = fs.readFileSync(gitPath, 'utf8').trim();
        if (headContent.startsWith('ref: ')) {
          const refPath = path.join(process.cwd(), '.git', headContent.substring(5));
          if (fs.existsSync(refPath)) {
            gitCommit = fs.readFileSync(refPath, 'utf8').trim().substring(0, 8);
          }
        } else {
          gitCommit = headContent.substring(0, 8);
        }
      }
    } catch (e) {
      // Ignore git errors
    }
    
    return NextResponse.json({
      version: {
        gitCommit,
        buildTime: new Date().toISOString(),
        nodeEnv: process.env.NODE_ENV,
        vercelEnv: process.env.VERCEL_ENV
      },
      files: {
        componentExists,
        whopPageExists,
        hasCommunityImport,
        hasCommunityUsage
      },
      deployment: {
        vercelUrl: process.env.VERCEL_URL,
        vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
        vercelGitCommitRef: process.env.VERCEL_GIT_COMMIT_REF
      }
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}