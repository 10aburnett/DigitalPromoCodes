import { PrismaClient } from '@prisma/client';
import * as dotenv from 'dotenv';

// Load environment variables from .env.local
dotenv.config({ path: '.env.local' });

const prisma = new PrismaClient();

async function investigateUnpublishing() {
  try {
    console.log('🔍 Investigating the unpublishing incident...\n');

    // Check when whops were last updated
    console.log('📅 Checking recent database activity:');
    const recentUpdates = await prisma.deal.findMany({
      where: {
        updatedAt: {
          gte: new Date(Date.now() - 24 * 60 * 60 * 1000) // Last 24 hours
        }
      },
      select: {
        id: true,
        name: true,
        publishedAt: true,
        updatedAt: true,
        createdAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 20
    });

    console.log(`Found ${recentUpdates.length} whops updated in the last 24 hours:`);
    recentUpdates.slice(0, 10).forEach((whop, i) => {
      const status = whop.publishedAt ? '✅ Published' : '❌ Unpublished';
      console.log(`  ${i + 1}. ${whop.name} - ${status} - Updated: ${whop.updatedAt.toISOString()}`);
    });

    // Check for patterns in unpublished whops
    console.log('\n🕵️ Analyzing unpublished whops patterns:');
    const unpublishedWhops = await prisma.deal.findMany({
      where: { publishedAt: null },
      select: {
        id: true,
        name: true,
        updatedAt: true,
        createdAt: true
      },
      orderBy: {
        updatedAt: 'desc'
      },
      take: 10
    });

    console.log('Most recently updated unpublished whops:');
    unpublishedWhops.forEach((whop, i) => {
      const timeSinceUpdate = Date.now() - whop.updatedAt.getTime();
      const hoursAgo = Math.round(timeSinceUpdate / (1000 * 60 * 60));
      console.log(`  ${i + 1}. ${whop.name} - Updated ${hoursAgo}h ago`);
    });

    // Check if all unpublished whops have the same updatedAt pattern
    const unpublishedUpdateTimes = await prisma.deal.groupBy({
      by: ['updatedAt'],
      where: { publishedAt: null },
      _count: { id: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5
    });

    console.log('\n⏰ Update time patterns for unpublished whops:');
    unpublishedUpdateTimes.forEach((group, i) => {
      console.log(`  ${i + 1}. ${group._count.id} whops updated at: ${group.updatedAt.toISOString()}`);
    });

    // Check if there's a mass update event
    const massUpdateThreshold = 1000;
    const suspiciousUpdate = unpublishedUpdateTimes.find(group => group._count.id >= massUpdateThreshold);
    
    if (suspiciousUpdate) {
      console.log(`\n🚨 SUSPICIOUS ACTIVITY DETECTED:`);
      console.log(`   ${suspiciousUpdate._count.id} whops were unpublished at the same time!`);
      console.log(`   Time: ${suspiciousUpdate.updatedAt.toISOString()}`);
      console.log(`   This suggests a mass unpublishing operation occurred.`);
    }

    // Check current status
    console.log('\n📊 Current publication status:');
    const [publishedCount, unpublishedCount] = await Promise.all([
      prisma.deal.count({ where: { publishedAt: { not: null } } }),
      prisma.deal.count({ where: { publishedAt: null } })
    ]);

    console.log(`  Published: ${publishedCount}`);
    console.log(`  Unpublished: ${unpublishedCount}`);
    console.log(`  Total: ${publishedCount + unpublishedCount}`);

    // Create a summary report
    console.log('\n📝 INVESTIGATION SUMMARY:');
    console.log('=====================================');
    
    if (suspiciousUpdate) {
      console.log('🔴 LIKELY CAUSE: Mass unpublishing operation');
      console.log(`   - ${suspiciousUpdate._count.id} whops unpublished simultaneously`);
      console.log(`   - Occurred at: ${suspiciousUpdate.updatedAt.toISOString()}`);
      console.log('   - Possible sources:');
      console.log('     1. Disabled reset-whops API route was somehow triggered');
      console.log('     2. Admin panel unpublish action with high count');
      console.log('     3. Database migration or manual SQL operation');
      console.log('     4. Import script that overwrote publishedAt values');
    } else {
      console.log('🟡 NO MASS OPERATION DETECTED');
      console.log('   - Whops were unpublished at different times');
      console.log('   - Investigate individual update patterns');
    }

    console.log('\n🛡️ RECOMMENDED ACTIONS:');
    console.log('1. Check Vercel function logs for the incident time');
    console.log('2. Review admin panel access logs');
    console.log('3. Implement publishing change monitoring');
    console.log('4. Add safeguards to prevent mass unpublishing');

  } catch (error) {
    console.error('❌ Investigation error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the investigation
investigateUnpublishing();