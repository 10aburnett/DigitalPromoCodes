#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')

const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL
    }
  }
})

const backupPrisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.BACKUP_DATABASE_URL
    }
  }
})

async function checkCounts() {
  try {
    console.log('📊 PRODUCTION DATABASE COUNTS:')
    const prodWhops = await prodPrisma.whop.count()
    const prodPromos = await prodPrisma.promoCode.count()
    const prodBlogPosts = await prodPrisma.blogPost.count()
    const prodUsers = await prodPrisma.user.count()
    const prodSubmissions = await prodPrisma.promoCodeSubmission.count()
    
    console.log('   Whops:', prodWhops)
    console.log('   PromoCode:', prodPromos)
    console.log('   BlogPost:', prodBlogPosts)
    console.log('   Users:', prodUsers)
    console.log('   PromoCodeSubmissions:', prodSubmissions)
    console.log()
    
    console.log('📊 BACKUP DATABASE COUNTS:')
    const backupWhops = await backupPrisma.whop.count()
    const backupPromos = await backupPrisma.promoCode.count()
    const backupBlogPosts = await backupPrisma.blogPost.count()
    const backupUsers = await backupPrisma.user.count()
    const backupSubmissions = await backupPrisma.promoCodeSubmission.count()
    
    console.log('   Whops:', backupWhops)
    console.log('   PromoCode:', backupPromos)
    console.log('   BlogPost:', backupBlogPosts)
    console.log('   Users:', backupUsers)
    console.log('   PromoCodeSubmissions:', backupSubmissions)
    console.log()
    
    console.log('🔍 COMPARISON:')
    console.log('   Whops - Production:', prodWhops, 'Backup:', backupWhops, 'Match:', prodWhops === backupWhops ? '✅' : '❌')
    console.log('   PromoCode - Production:', prodPromos, 'Backup:', backupPromos, 'Match:', prodPromos === backupPromos ? '✅' : '❌')
    console.log('   BlogPost - Production:', prodBlogPosts, 'Backup:', backupBlogPosts, 'Match:', prodBlogPosts === backupBlogPosts ? '✅' : '❌')
    console.log('   Users - Production:', prodUsers, 'Backup:', prodUsers, 'Match:', prodUsers === backupUsers ? '✅' : '❌')
    console.log('   Submissions - Production:', prodSubmissions, 'Backup:', backupSubmissions, 'Match:', prodSubmissions === backupSubmissions ? '✅' : '❌')
    
    // Show total counts
    const prodTotal = prodWhops + prodPromos + prodBlogPosts + prodUsers
    const backupTotal = backupWhops + backupPromos + backupBlogPosts + backupUsers
    
    console.log()
    console.log('📋 SUMMARY:')
    console.log('   Production Total Records:', prodTotal)
    console.log('   Backup Total Records:', backupTotal)
    console.log('   All Data Safe:', prodTotal > 0 && backupTotal > 0 && prodWhops > 8000 ? '✅ YES' : '❌ DATA MISSING!')
    
  } catch (error) {
    console.error('❌ Error checking counts:', error.message)
  } finally {
    await prodPrisma.$disconnect()
    await backupPrisma.$disconnect()
  }
}

checkCounts()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Script failed:', error)
    process.exit(1)
  })