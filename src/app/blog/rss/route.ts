import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { siteOrigin } from '@/lib/site-origin';

export async function GET() {
  const origin = siteOrigin();
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { publishedAt: 'desc' },
    take: 50,
    select: { title: true, slug: true, excerpt: true, publishedAt: true },
  });

  const items = posts.map(p => `
    <item>
      <title><![CDATA[${p.title}]]></title>
      <link>${origin}/blog/${p.slug}</link>
      <guid>${origin}/blog/${p.slug}</guid>
      <pubDate>${(p.publishedAt ?? new Date()).toUTCString()}</pubDate>
      <description><![CDATA[${p.excerpt ?? ''}]]></description>
    </item>`).join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
  <rss version="2.0"><channel>
    <title>WHPCodes Blog</title>
    <link>${origin}/blog</link>
    <description>Latest posts from WHPCodes</description>
    ${items}
  </channel></rss>`;

  return new NextResponse(xml, {
    headers: { 'Content-Type': 'application/rss+xml; charset=utf-8' },
  });
}
