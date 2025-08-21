#!/usr/bin/env node

/**
 * 🛡️ DATABASE SAFETY GUARD 🛡️
 * 
 * This script prevents destructive database operations.
 * It will block any command containing dangerous flags.
 */

const FORBIDDEN_PATTERNS = [
  '--force-reset',
  '--force',
  'reset',
  'db:reset',
  'migrate:reset'
];

const FORBIDDEN_COMMANDS = [
  'npx prisma db push --force-reset',
  'prisma db push --force-reset',
  'npx prisma migrate reset',
  'prisma migrate reset',
  'npx prisma db reset',
  'prisma db reset'
];

function checkCommand(command) {
  const lowerCommand = command.toLowerCase();
  
  // Check for forbidden patterns
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      console.error('🚨 BLOCKED: FORBIDDEN DATABASE COMMAND DETECTED! 🚨');
      console.error(`Command: ${command}`);
      console.error(`Reason: Contains forbidden pattern "${pattern}"`);
      console.error('\n❌ THIS COMMAND HAS CAUSED DATA LOSS 4+ TIMES');
      console.error('❌ USE SAFE ALTERNATIVES ONLY');
      console.error('\n✅ Safe alternatives:');
      console.error('  npx prisma db push           (for schema updates)');
      console.error('  npx prisma migrate dev       (for new migrations)');
      console.error('  npx prisma migrate deploy    (for production)');
      console.error('\nSee NEVER-FORCE-RESET.md for full safety guidelines.');
      return false;
    }
  }
  
  // Check for exact forbidden commands
  for (const forbidden of FORBIDDEN_COMMANDS) {
    if (lowerCommand.includes(forbidden.toLowerCase())) {
      console.error('🚨 BLOCKED: EXACT FORBIDDEN COMMAND MATCH! 🚨');
      console.error(`Command: ${command}`);
      console.error(`Forbidden: ${forbidden}`);
      console.error('\n❌ THIS EXACT COMMAND HAS DESTROYED DATA BEFORE');
      return false;
    }
  }
  
  return true;
}

// If run as a script, check the provided command
if (require.main === module) {
  const command = process.argv.slice(2).join(' ');
  if (command) {
    if (!checkCommand(command)) {
      process.exit(1);
    } else {
      console.log('✅ Command appears safe');
    }
  }
}

module.exports = { checkCommand, FORBIDDEN_PATTERNS, FORBIDDEN_COMMANDS };