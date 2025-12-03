import { Prisma } from '@prisma/client';

/**
 * Centralized filter for indexable whops.
 * Works with both production and backup database schemas:
 * - Production: indexingStatus='INDEXED', retirement!='GONE'
 * - Backup: indexingStatus='INDEX', retired=false
 *
 * This prevents "empty pages" when switching between databases.
 */

// Accept both prod and backup conventions
const INDEX_OK = ['INDEXED', 'INDEX'] as const;

export function whereIndexable(): Prisma.DealWhereInput {
  return {
    // indexing allowed
    OR: [
      { indexingStatus: { in: INDEX_OK as any } },
      { indexingStatus: null }, // tolerate nulls in backup data
    ],
    // not retired by either flag
    AND: [
      { NOT: { retired: true } },
      { OR: [{ retirement: { not: 'GONE' } }, { retirement: null }] },
    ],
  };
}
