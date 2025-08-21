#!/usr/bin/env node

/**
 * 🚫 COMMAND EXECUTION BLOCKER
 * 
 * This script intercepts and blocks dangerous Prisma commands.
 * It runs as a pre-execution hook to prevent data loss.
 */

const fs = require('fs');
const path = require('path');

// Dangerous patterns that must be blocked
const DANGEROUS_PATTERNS = [
  '--force-reset',
  'migrate reset',
  'db reset',
  'reset',
  '--force'
];

// Get the command from process arguments
const fullCommand = process.argv.slice(2).join(' ');

function blockDangerousCommand(command) {
  const lowerCommand = command.toLowerCase();
  
  // Check for any dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      console.error('🚫 COMMAND EXECUTION BLOCKED!');
      console.error('==========================================');
      console.error(`Attempted command: ${command}`);
      console.error(`Blocked pattern: ${pattern}`);
      console.error('');
      console.error('❌ THIS COMMAND HAS CAUSED DATA LOSS 5+ TIMES');
      console.error('❌ EXECUTION PREVENTED BY SAFETY SYSTEM');
      console.error('');
      console.error('✅ Use safe alternatives:');
      console.error('  npm run db:push');
      console.error('  npm run db:migrate');
      console.error('  npx prisma db push (without --force-reset)');
      console.error('');
      console.error('This protection cannot be bypassed.');
      
      // Log the blocked attempt
      const logEntry = `[${new Date().toISOString()}] BLOCKED: ${command}\n`;
      fs.appendFileSync(path.join(__dirname, '../blocked-commands.log'), logEntry);
      
      process.exit(1);
    }
  }
  
  console.log('✅ Command appears safe, allowing execution...');
  return true;
}

if (fullCommand) {
  blockDangerousCommand(fullCommand);
}

module.exports = { blockDangerousCommand };