import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // Get ALL environment variables related to database
    const allEnvVars = {
      DATABASE_URL: process.env.DATABASE_URL,
      POSTGRES_URL: process.env.POSTGRES_URL,
      POSTGRES_PRISMA_URL: process.env.POSTGRES_PRISMA_URL,
      POSTGRES_URL_NON_POOLING: process.env.POSTGRES_URL_NON_POOLING,
      NODE_ENV: process.env.NODE_ENV,
      VERCEL_ENV: process.env.VERCEL_ENV,
    };
    
    // Test actual database connection
    const dbTest = await prisma.$queryRaw`SELECT current_database(), current_user, inet_server_addr(), inet_server_port()`;
    
    // Get latest promo submission
    const latestSubmission = await prisma.promoCodeSubmission.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { 
        id: true, 
        title: true, 
        createdAt: true, 
        status: true,
        Deal: { select: { name: true, slug: true } }
      }
    });
    
    // Get latest community promo code
    const latestCommunityPromo = await prisma.promoCode.findFirst({
      where: { id: { startsWith: 'community_' } },
      orderBy: { createdAt: 'desc' },
      select: { 
        id: true, 
        title: true, 
        createdAt: true,
        Deal: { select: { name: true, slug: true } }
      }
    });
    
    return NextResponse.json({
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        VERCEL_ENV: process.env.VERCEL_ENV,
        isLocalhost: process.env.NODE_ENV === 'development'
      },
      databaseConfig: {
        hasMainUrl: !!allEnvVars.DATABASE_URL,
        hasPostgresUrl: !!allEnvVars.POSTGRES_URL,
        hasPrismaUrl: !!allEnvVars.POSTGRES_PRISMA_URL,
        mainUrlEndpoint: allEnvVars.DATABASE_URL?.includes('rough-rain') ? 'rough-rain' : 
                        allEnvVars.DATABASE_URL?.includes('noisy-hat') ? 'noisy-hat' : 'unknown',
        postgresUrlEndpoint: allEnvVars.POSTGRES_URL?.includes('rough-rain') ? 'rough-rain' : 
                            allEnvVars.POSTGRES_URL?.includes('noisy-hat') ? 'noisy-hat' : 'unknown'
      },
      actualConnection: dbTest,
      latestData: {
        submission: latestSubmission,
        communityPromo: latestCommunityPromo
      },
      timestamp: new Date().toISOString()
    });
    
  } catch (error: any) {
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
}