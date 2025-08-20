import { NextRequest, NextResponse } from 'next/server';
import { RETIRED_PATHS, NOINDEX_PATHS } from '../../_generated/seo-indexes';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const path = searchParams.get('path');
  
  if (!path) {
    return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
  }
  
  return NextResponse.json({
    inRetired: RETIRED_PATHS.has(path),
    inNoindex: NOINDEX_PATHS.has(path)
  });
}