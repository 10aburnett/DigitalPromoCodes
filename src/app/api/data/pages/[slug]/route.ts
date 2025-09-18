import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: { slug: string } }
) {
  try {
    // Decode URL-encoded slug (e.g., %3A becomes :)
    const decodedSlug = decodeURIComponent(params.slug);

    // Security check: only allow .json files and valid slug characters (including colons)
    if (!decodedSlug.match(/^[a-zA-Z0-9-:]+\.json$/)) {
      return NextResponse.json({ error: 'Invalid file name' }, { status: 400 });
    }

    const filePath = join(process.cwd(), 'data', 'pages', decodedSlug);
    const fileContent = await readFile(filePath, 'utf8');
    const data = JSON.parse(fileContent);

    return NextResponse.json(data, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    if ((error as any)?.code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 });
    }

    console.error('Error serving freshness data:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}