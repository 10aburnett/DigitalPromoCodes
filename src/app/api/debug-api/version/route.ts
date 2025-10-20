// src/app/api/debug-api/version/route.ts
import { NextResponse } from 'next/server';

function maskDbUrl(u?: string) {
  if (!u) return null;
  try {
    const url = new URL(u);
    return {
      protocol: url.protocol.replace(/:.*/, ''),
      host: url.host,
      pathname: url.pathname
    };
  } catch {
    return 'unparseable';
  }
}

export async function GET() {
  const payload = {
    env: process.env.VERCEL_ENV || process.env.NODE_ENV || 'unknown',
    db: maskDbUrl(process.env.DATABASE_URL),
    commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
    branch: process.env.VERCEL_GIT_COMMIT_REF || 'unknown',
    deployment: process.env.VERCEL_URL || 'localhost',
    region: process.env.VERCEL_REGION || 'local',
    timestamp: new Date().toISOString()
  };

  console.log('[DBG:version]', payload);
  return NextResponse.json(payload);
}
