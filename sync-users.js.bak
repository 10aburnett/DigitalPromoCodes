#!/usr/bin/env node

const { PrismaClient } = require('@prisma/client')

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
      url: process.env.DATABASE_URL
    }
  }
})

async function syncUsers() {
  try {
    console.log('🔄 SYNCING USERS FIRST TO FIX FOREIGN KEY CONSTRAINTS...')
    
    // Get users from both databases
    const prodUsers = await productionPrisma.user.findMany()
    const backupUsers = await backupPrisma.user.findMany()
    
    console.log('Production Users:', prodUsers.length)
    console.log('Backup Users:', backupUsers.length)
    
    // Sync users from production to backup
    const backupUserIds = new Set(backupUsers.map(u => u.id))
    const missingFromBackup = prodUsers.filter(u => !backupUserIds.has(u.id))
    
    console.log('Missing from backup:', missingFromBackup.length)
    
    for (const user of missingFromBackup) {
      try {
        await backupPrisma.user.create({ data: user })
        console.log('✅ Added user to backup:', user.email)
      } catch (error) {
        console.log('❌ Error adding user:', user.email, error.message)
      }
    }
    
    // Sync users from backup to production  
    const prodUserIds = new Set(prodUsers.map(u => u.id))
    const missingFromProd = backupUsers.filter(u => !prodUserIds.has(u.id))
    
    console.log('Missing from production:', missingFromProd.length)
    
    for (const user of missingFromProd) {
      try {
        await productionPrisma.user.create({ data: user })
        console.log('✅ Added user to production:', user.email)
      } catch (error) {
        console.log('❌ Error adding user:', user.email, error.message)
      }
    }
    
    console.log('✅ User sync completed - now foreign key constraints should work')
    
  } catch (error) {
    console.error('❌ Error syncing users:', error)
    throw error
  } finally {
    await backupPrisma.$disconnect()
    await productionPrisma.$disconnect()
  }
}

syncUsers()
  .then(() => {
    console.log('🎉 User sync successful!')
    process.exit(0)
  })
  .catch((error) => {
    console.error('💥 User sync failed:', error)
    process.exit(1)
  })