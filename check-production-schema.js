const { PrismaClient } = require('@prisma/client');

// Production database connection
const productionDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

// Backup database connection
const backupDb = new PrismaClient({
  datasources: {
    db: {
      url: "postgresql://neondb_owner:npg_TKWsI2cv3zki@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require"
    }
  }
});

async function checkSchemas() {
  try {
    console.log('🔍 CHECKING DATABASE SCHEMAS\n');

    // Check production schema
    console.log('📊 PRODUCTION DATABASE:');
    try {
      const prodColumns = await productionDb.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Whop' 
        ORDER BY ordinal_position;
      `;
      
      console.log('   Whop table columns:');
      prodColumns.forEach(col => {
        if (col.column_name === 'indexing') {
          console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
        } else {
          console.log(`   • ${col.column_name}: ${col.data_type}`);
        }
      });
      
      // Check if indexing column exists
      const hasIndexing = prodColumns.some(col => col.column_name === 'indexing');
      console.log(`   📍 Has 'indexing' field: ${hasIndexing ? '✅ YES' : '❌ NO'}`);
      
    } catch (error) {
      console.log(`   ❌ Error checking production: ${error.message}`);
    }

    console.log('\n📊 BACKUP DATABASE:');
    try {
      const backupColumns = await backupDb.$queryRaw`
        SELECT column_name, data_type, is_nullable, column_default
        FROM information_schema.columns 
        WHERE table_name = 'Whop' 
        ORDER BY ordinal_position;
      `;
      
      console.log('   Whop table columns:');
      backupColumns.forEach(col => {
        if (col.column_name === 'indexing') {
          console.log(`   ✅ ${col.column_name}: ${col.data_type}`);
        } else {
          console.log(`   • ${col.column_name}: ${col.data_type}`);
        }
      });
      
      // Check if indexing column exists
      const hasIndexing = backupColumns.some(col => col.column_name === 'indexing');
      console.log(`   📍 Has 'indexing' field: ${hasIndexing ? '✅ YES' : '❌ NO'}`);
      
    } catch (error) {
      console.log(`   ❌ Error checking backup: ${error.message}`);
    }

    // Check if IndexingStatus enum exists
    console.log('\n🔍 CHECKING ENUMS:');
    
    try {
      const prodEnums = await productionDb.$queryRaw`
        SELECT t.typname as enum_name
        FROM pg_type t 
        WHERE t.typtype = 'e'
        ORDER BY t.typname;
      `;
      console.log('   Production enums:', prodEnums.map(e => e.enum_name).join(', '));
      
      const backupEnums = await backupDb.$queryRaw`
        SELECT t.typname as enum_name
        FROM pg_type t 
        WHERE t.typtype = 'e'
        ORDER BY t.typname;
      `;
      console.log('   Backup enums:', backupEnums.map(e => e.enum_name).join(', '));
      
    } catch (error) {
      console.log(`   ❌ Error checking enums: ${error.message}`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await productionDb.$disconnect();
    await backupDb.$disconnect();
  }
}

checkSchemas();