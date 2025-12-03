#!/usr/bin/env node

/**
 * 🛡️ SAFE NPX WRAPPER
 * 
 * This completely replaces npx for Prisma commands with safety checks.
 * Any dangerous command is blocked before execution.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// Dangerous patterns that cause data loss
const FORBIDDEN_PATTERNS = [
  '--force-reset',
  'migrate reset', 
  'db reset',
  '--force'
];

// Get the command arguments
const args = process.argv.slice(2);
const fullCommand = args.join(' ');

function isDangerous(command) {
  const lowerCommand = command.toLowerCase();
  
  for (const pattern of FORBIDDEN_PATTERNS) {
    if (lowerCommand.includes(pattern.toLowerCase())) {
      return pattern;
    }
  }
  return false;
}

function blockAndLog(command, pattern) {
  console.error('🚫🚫🚫 DANGEROUS COMMAND BLOCKED 🚫🚫🚫');
  console.error('========================================');
  console.error(`Command: npx ${command}`);
  console.error(`Dangerous pattern: ${pattern}`);
  console.error('');
  console.error('❌ THIS COMMAND HAS CAUSED DATA LOSS 5+ TIMES');
  console.error('❌ CLAUDE IS FORBIDDEN FROM RUNNING THIS');
  console.error('');
  console.error('🛡️ PROTECTION SYSTEM ACTIVE - CANNOT BE BYPASSED');
  console.error('');
  console.error('✅ Safe alternatives:');
  console.error('  npm run db:push');
  console.error('  npm run db:migrate');
  console.error('  npx prisma db push (WITHOUT --force-reset)');
  console.error('  npx prisma migrate dev --name "description"');
  
  // Log the attempt
  const timestamp = new Date().toISOString();
  const logEntry = `[${timestamp}] 🚫 BLOCKED: npx ${command} (pattern: ${pattern})\n`;
  const logFile = path.join(__dirname, '../blocked-commands.log');
  
  try {
    fs.appendFileSync(logFile, logEntry);
  } catch (err) {
    console.error('Could not write to log file:', err.message);
  }
  
  console.error('');
  console.error('This attempt has been logged.');
  process.exit(1);
}

// Check if this is a dangerous command
const dangerousPattern = isDangerous(fullCommand);

if (dangerousPattern) {
  blockAndLog(fullCommand, dangerousPattern);
}

// If safe, execute the original npx command
console.log('✅ Command passed safety check, executing...');
const child = spawn('npx', args, {
  stdio: 'inherit',
  shell: true
});

child.on('close', (code) => {
  process.exit(code);
});

child.on('error', (err) => {
  console.error('Error executing npx:', err);
  process.exit(1);
});