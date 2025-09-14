import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Basic environment check
    const hasDbUrl = !!process.env.DATABASE_URL;
    const nodeEnv = process.env.NODE_ENV;
    const vercelEnv = process.env.VERCEL_ENV;

    // Try a simple database query
    let dbStatus = 'disconnected';
    let dbError = null;
    let tableCount = 0;

    try {
      // Test basic connection
      await prisma.$queryRaw`SELECT 1 as test`;
      dbStatus = 'connected';

      // Try to count a table
      tableCount = await prisma.mailingList.count();
    } catch (error: any) {
      dbError = {
        message: error.message,
        code: error.code,
        name: error.name
      };
    }

    return NextResponse.json({
      environment: {
        NODE_ENV: nodeEnv,
        VERCEL_ENV: vercelEnv,
        hasDbUrl
      },
      database: {
        status: dbStatus,
        error: dbError,
        mailingListCount: tableCount
      },
      timestamp: new Date().toISOString()
    });

  } catch (error: any) {
    return NextResponse.json({
      error: 'Debug endpoint failed',
      details: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}