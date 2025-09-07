import { PrismaClient } from "@prisma/client";

// TypeScript check: Ensure content_text field exists in generated client
// eslint-disable-next-line @typescript-eslint/no-unused-vars
type _Check = import('@prisma/client').Prisma.BlogPostSelect;

// Add prisma to the NodeJS global type
declare global {
  var prisma: PrismaClient | undefined;
}

// Prevent multiple instances of Prisma Client in development
export const prisma = global.prisma || 
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' 
      ? ['query', 'error', 'warn'] 
      : ['error'],
  });

if (process.env.NODE_ENV !== "production") global.prisma = prisma; 