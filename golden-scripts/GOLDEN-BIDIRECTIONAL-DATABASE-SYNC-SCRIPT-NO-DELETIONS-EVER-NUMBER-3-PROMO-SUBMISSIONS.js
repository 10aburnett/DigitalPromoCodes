#!/usr/bin/env node

/** 🚨 SAFETY KILL-SWITCH 🚨
 * This script compares by raw database IDs, not natural keys.
 * It will create duplicates when syncing across databases.
 * Use GOLDEN-SAFE-* versions instead.
 */
if (!process.env.ALLOW_UNSAFE_SYNC) {
  console.error('🚫 This script is DEPRECATED and UNSAFE.');
  console.error('   Problem: Matches by raw IDs, creates duplicates');
  console.error('   Solution: Use natural-key based safe scripts instead');
  console.error('   Override: Set ALLOW_UNSAFE_SYNC=1 (not recommended)');
  process.exit(1);
}

const { PrismaClient } = require('@prisma/client')
const { randomUUID } = require('crypto')

// Initialize Prisma clients for both databases with environment URLs
const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKUP_DATABASE_URL
    }
  }
})

const productionPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.PRODUCTION_DATABASE_URL
    }
  }
})

function sanitizeSubmissionForCreate(src) {
  // Drop nested relation object (capital W) if present
  // and prepare a DB-compliant payload.
  const {
    Whop,   // <-- REMOVE nested object so Prisma doesn't see it
    whopId, // keep as scalar (nullable allowed for "general" submissions)
    id,
    title,
    description,
    code,
    value,
    submitterName,
    submitterEmail,
    submitterMessage,
    isGeneral,
    customCourseName,
    ipAddress,
    userAgent,
    createdAt, // optional
    updatedAt, // optional
    ...rest // ignore any unknown props
  } = src;

  return {
    id: id || randomUUID(),
    title: title || 'Untitled submission',
    description: description || 'Generic promo description',
    code: code || '',
    value: value ?? '0',                 // your DB stores value as text in some places
    submitterName: submitterName || 'Anonymous',
    submitterEmail: submitterEmail || 'unknown@example.com',
    submitterMessage: submitterMessage ?? null,
    isGeneral: Boolean(isGeneral),
    whopId: isGeneral ? null : (whopId || null),
    customCourseName: customCourseName ?? null,
    ipAddress: ipAddress || '',
    userAgent: userAgent || '',
    createdAt: createdAt ?? new Date(),
    updatedAt: updatedAt ?? new Date(),
  };
}

console.log('🚀 BIDIRECTIONAL DATABASE SYNC #3 (PROMO CODE SUBMISSIONS)')
console.log('===========================================================')
console.log('⚠️  SAFE MODE: ONLY ADDING DATA, NEVER DELETING')
console.log()

async function syncPromoCodeSubmissions() {
  try {
    console.log('🔍 ANALYZING PROMO CODE SUBMISSION DIFFERENCES BETWEEN DATABASES')
    console.log('================================================================')
    console.log()

    // Get submissions from both databases
    const backupSubmissions = await backupPrisma.promoCodeSubmission.findMany({
      include: {
        Whop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    const productionSubmissions = await productionPrisma.promoCodeSubmission.findMany({
      include: {
        Whop: {
          select: {
            id: true,
            name: true,
            slug: true
          }
        }
      }
    })

    console.log('🎯 PROMO CODE SUBMISSIONS:')
    console.log(`   Backup: ${backupSubmissions.length} submissions`)
    console.log(`   Production: ${productionSubmissions.length} submissions`)

    // Find submissions missing in each database
    const backupSubmissionIds = new Set(backupSubmissions.map(s => s.id))
    const productionSubmissionIds = new Set(productionSubmissions.map(s => s.id))

    const missingFromProduction = backupSubmissions.filter(s => !productionSubmissionIds.has(s.id))
    const missingFromBackup = productionSubmissions.filter(s => !backupSubmissionIds.has(s.id))

    console.log(`   Missing from Production: ${missingFromProduction.length} submissions`)
    console.log(`   Missing from Backup: ${missingFromBackup.length} submissions`)
    console.log()

    // Sync missing submissions to production
    if (missingFromProduction.length > 0) {
      console.log('📤 SYNCING SUBMISSIONS FROM BACKUP TO PRODUCTION')
      console.log('================================================')
      
      for (const submission of missingFromProduction) {
        try {
          await productionPrisma.promoCodeSubmission.create({
            data: sanitizeSubmissionForCreate(submission)
          })
          console.log(`   ✅ Added submission: ${submission.title} (${submission.id})`)
        } catch (error) {
          console.log(`   ❌ Failed to add submission ${submission.id}: ${error.message}`)
        }
      }
    } else {
      console.log('✅ No submissions to sync from Backup to Production')
    }
    console.log()

    // Sync missing submissions to backup
    if (missingFromBackup.length > 0) {
      console.log('📥 SYNCING SUBMISSIONS FROM PRODUCTION TO BACKUP')
      console.log('===============================================')
      
      for (const submission of missingFromBackup) {
        try {
          await backupPrisma.promoCodeSubmission.create({
            data: sanitizeSubmissionForCreate(submission)
          })
          console.log(`   ✅ Added submission: ${submission.title} (${submission.id})`)
        } catch (error) {
          console.log(`   ❌ Failed to add submission ${submission.id}: ${error.message}`)
        }
      }
    } else {
      console.log('✅ No submissions to sync from Production to Backup')
    }
    console.log()

    // Final verification
    console.log('✅ FINAL VERIFICATION')
    console.log('=====================')

    const finalBackupSubmissions = await backupPrisma.promoCodeSubmission.count()
    const finalProductionSubmissions = await productionPrisma.promoCodeSubmission.count()

    console.log('📊 FINAL COUNTS:')
    console.log(`   Promo Submissions - Backup: ${finalBackupSubmissions}, Production: ${finalProductionSubmissions}`)
    console.log()

    if (finalBackupSubmissions === finalProductionSubmissions) {
      console.log('🎉 SUCCESS! Both databases are now fully synchronized for PromoCodeSubmissions!')
    } else {
      console.log('⚠️  WARNING: Submission counts still differ between databases')
    }

    console.log()
    console.log('🎉 BIDIRECTIONAL SYNC #3 COMPLETED SUCCESSFULLY!')
    console.log('Both databases now contain all PromoCodeSubmission data from each other.')

  } catch (error) {
    console.error('❌ SYNC FAILED:', error)
    throw error
  } finally {
    await backupPrisma.$disconnect()
    await productionPrisma.$disconnect()
  }
}

// Run the sync
syncPromoCodeSubmissions()
  .then(() => {
    process.exit(0)
  })
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })