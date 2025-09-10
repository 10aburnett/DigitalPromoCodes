/**
 * 🛡️ SCHEMA GUARD UTILITY FOR GOLDEN SCRIPTS
 * ==========================================
 * 
 * Validates that databases have required schema columns before syncing.
 * Fails fast with clear instructions instead of attempting runtime DDL.
 * 
 * Usage:
 *   await validateSchema(prismaClient, 'database-name');
 */

/**
 * @typedef {Object} ColumnRequirement
 * @property {string} table - Table name
 * @property {string} column - Column name
 */

/**
 * Required columns for golden scripts to function
 * @type {ColumnRequirement[]}
 */
const REQUIRED_COLUMNS = [
  { table: 'BlogPost', column: 'content_text' },
  { table: 'MailingList', column: 'statusChangedAt' },
  { table: 'MailingList', column: 'reoptinToken' }
];

/**
 * Validates that a database has all required schema columns
 * @param {import('@prisma/client').PrismaClient} prisma - Prisma client
 * @param {string} dbName - Database name for error messages
 * @throws {Error} If any required columns are missing
 */
async function validateSchema(prisma, dbName) {
  console.log(`🔍 Validating schema for ${dbName} database...`);
  
  const missing = [];
  
  for (const requirement of REQUIRED_COLUMNS) {
    try {
      const result = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = ${requirement.table} 
            AND column_name = ${requirement.column}
        ) as exists;
      `;
      
      const exists = result[0]?.exists;
      if (!exists) {
        missing.push(`${requirement.table}.${requirement.column}`);
      }
    } catch (error) {
      console.error(`❌ Error checking ${requirement.table}.${requirement.column}:`, error.message);
      missing.push(`${requirement.table}.${requirement.column} (check failed)`);
    }
  }
  
  if (missing.length > 0) {
    const errorMessage = `
🚨 SCHEMA DRIFT DETECTED in ${dbName} database!

Missing columns:
${missing.map(col => `  - ${col}`).join('\n')}

To fix this issue:
1. Ensure your Prisma schema is up to date
2. Run: npx prisma db push
3. Or for production: DATABASE_URL="production-url" npx prisma db push
4. Then rerun this sync script

❌ SYNC ABORTED - Please fix schema and try again.
    `.trim();
    
    throw new Error(errorMessage);
  }
  
  console.log(`✅ ${dbName} database schema validation passed`);
}

/**
 * Validates schema for both backup and production databases
 * @param {import('@prisma/client').PrismaClient} backupDb 
 * @param {import('@prisma/client').PrismaClient} productionDb 
 */
async function validateBothDatabases(backupDb, productionDb) {
  console.log('\n🛡️ PREFLIGHT SCHEMA VALIDATION');
  console.log('==============================');
  
  await validateSchema(backupDb, 'BACKUP');
  await validateSchema(productionDb, 'PRODUCTION');
  
  console.log('✅ All databases have required schema columns');
}

module.exports = {
  validateSchema,
  validateBothDatabases,
  REQUIRED_COLUMNS
};