import { PrismaClient } from '@prisma/client'

// TypeScript check: Ensure content_text field exists in generated client
// eslint-disable-next-line no-unused-vars
type _Check = import('@prisma/client').Prisma.BlogPostSelect;

declare global {
  // eslint-disable-next-line no-var
  var prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const databaseUrl = process.env.DATABASE_URL

  if (!databaseUrl) {
    throw new Error(
      '❌ DATABASE_URL is missing. Run `npm run dev` to auto-configure from git branch, ' +
      'or set DATABASE_URL manually in .env.local'
    )
  }

  // Extract and mask host for logging
  const hostMatch = databaseUrl.match(/@([^/]+)\//)
  const host = hostMatch ? hostMatch[1].split('-pooler')[0] + '-pooler...' : 'unknown'
  const runtime = process.env.NEXT_RUNTIME_DATABASE || 'unknown'

  console.log(`🔗 Prisma client initialized → ${runtime} (${host})`)

  // Debug: Show full host for troubleshooting
  if (process.env.NODE_ENV !== 'production') {
    const url = process.env.DATABASE_URL || '';
    const host = url.split('@')[1]?.split('/')[0] ?? '(no host)';
    console.log(`[prisma] DATABASE_URL host → ${host}`);
  }

  return new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    datasources: {
      db: {
        url: databaseUrl,
      },
    },
  })
}

// Use global singleton pattern for Next.js development
// This prevents multiple Prisma clients during HMR
const prisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV === 'development') {
  globalThis.prisma = prisma
}

export { prisma }
export default prisma 