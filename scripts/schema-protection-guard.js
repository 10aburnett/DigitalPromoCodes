#!/usr/bin/env node

/**
 * CI/CD Schema Protection Guardrails Script
 *
 * This script enforces CRITICAL guardrails for schema markup implementation:
 * 1. No database imports in schema-related files
 * 2. No Prisma client usage in JSON-LD helpers
 * 3. Ensures schema functions only accept plain objects
 *
 * Exit codes:
 * 0 - All checks passed
 * 1 - Schema guardrail violations found
 * 2 - Script execution error
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const SCHEMA_FILES = [
  'src/lib/jsonld.ts',
  'src/lib/urls.ts',
  'src/**/*schema*.ts',
  'src/**/*jsonld*.ts',
  'src/**/*json-ld*.ts'
];

const FORBIDDEN_PATTERNS = [
  {
    pattern: /import.*(?:@prisma\/client|@\/lib\/prisma|prisma)/i,
    message: 'CRITICAL VIOLATION: Database imports forbidden in schema files'
  },
  {
    pattern: /prisma\./i,
    message: 'CRITICAL VIOLATION: Direct prisma usage forbidden in schema files'
  },
  {
    pattern: /await\s+prisma/i,
    message: 'CRITICAL VIOLATION: Async database calls forbidden in schema files'
  },
  {
    pattern: /PrismaClient/i,
    message: 'CRITICAL VIOLATION: PrismaClient usage forbidden in schema files'
  }
];

const REQUIRED_COMMENTS = [
  {
    files: ['src/lib/jsonld.ts'],
    comment: 'never import DB here',
    message: 'Missing required DB guardrail comment in jsonld.ts'
  }
];

function log(message, level = 'info') {
  const prefix = {
    info: '✅',
    warn: '⚠️',
    error: '❌',
    debug: '🔍'
  }[level] || 'ℹ️';

  console.log(`${prefix} ${message}`);
}

function checkFileContent(filePath) {
  const violations = [];

  try {
    const content = fs.readFileSync(filePath, 'utf8');

    // Check for forbidden patterns
    FORBIDDEN_PATTERNS.forEach(({ pattern, message }) => {
      if (pattern.test(content)) {
        violations.push({
          file: filePath,
          message: message,
          line: findLineNumber(content, pattern)
        });
      }
    });

    // Check for required comments in specific files
    REQUIRED_COMMENTS.forEach(({ files, comment, message }) => {
      if (files.some(file => filePath.includes(file))) {
        if (!content.toLowerCase().includes(comment.toLowerCase())) {
          violations.push({
            file: filePath,
            message: message,
            line: null
          });
        }
      }
    });

  } catch (error) {
    log(`Error reading file ${filePath}: ${error.message}`, 'error');
  }

  return violations;
}

function findLineNumber(content, pattern) {
  const lines = content.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (pattern.test(lines[i])) {
      return i + 1;
    }
  }
  return null;
}

function expandGlob(pattern) {
  try {
    // Use find command to expand glob patterns
    const command = pattern.includes('*')
      ? `find . -path "./${pattern}" -type f 2>/dev/null || true`
      : `test -f "${pattern}" && echo "${pattern}" || true`;

    const result = execSync(command, { encoding: 'utf8', cwd: process.cwd() });
    return result.trim().split('\n').filter(file => file && file !== '.');
  } catch (error) {
    return [];
  }
}

function runESLintCheck() {
  try {
    log('Running ESLint schema guardrail checks...', 'debug');

    // Run ESLint specifically on schema files
    const schemaFilesList = SCHEMA_FILES.flatMap(expandGlob).filter(Boolean);

    if (schemaFilesList.length === 0) {
      log('No schema files found to lint', 'warn');
      return true;
    }

    const command = `npx eslint ${schemaFilesList.join(' ')}`;
    execSync(command, { stdio: 'inherit', cwd: process.cwd() });

    log('ESLint schema checks passed', 'info');
    return true;
  } catch (error) {
    log('ESLint schema checks failed', 'error');
    return false;
  }
}

function main() {
  log('🛡️  Starting Schema Protection Guardrails Check', 'info');
  log('==========================================', 'info');

  let totalViolations = 0;
  const allViolations = [];

  // Check all schema-related files
  SCHEMA_FILES.forEach(pattern => {
    const files = expandGlob(pattern);

    files.forEach(filePath => {
      if (fs.existsSync(filePath)) {
        log(`Checking ${filePath}...`, 'debug');
        const violations = checkFileContent(filePath);

        if (violations.length > 0) {
          totalViolations += violations.length;
          allViolations.push(...violations);
        }
      }
    });
  });

  // Report violations
  if (totalViolations > 0) {
    log('', 'error');
    log('🚨 SCHEMA GUARDRAIL VIOLATIONS DETECTED 🚨', 'error');
    log('==========================================', 'error');

    allViolations.forEach(({ file, message, line }, index) => {
      log(`${index + 1}. ${file}${line ? `:${line}` : ''}`, 'error');
      log(`   ${message}`, 'error');
      log('', 'error');
    });

    log(`Total violations: ${totalViolations}`, 'error');
    log('', 'error');
    log('REMINDER: Schema functions must NEVER access database directly!', 'error');
    log('They should only accept plain objects from page props or layouts.', 'error');

    process.exit(1);
  }

  // Run ESLint checks
  const eslintPassed = runESLintCheck();

  if (!eslintPassed) {
    log('ESLint schema guardrail checks failed', 'error');
    process.exit(1);
  }

  log('', 'info');
  log('🎉 All schema protection guardrails passed!', 'info');
  log('Schema files are properly isolated from database layer.', 'info');

  process.exit(0);
}

// Handle script errors
process.on('uncaughtException', (error) => {
  log(`Script error: ${error.message}`, 'error');
  process.exit(2);
});

process.on('unhandledRejection', (reason, promise) => {
  log(`Unhandled rejection at: ${promise}, reason: ${reason}`, 'error');
  process.exit(2);
});

// Run the script
if (require.main === module) {
  main();
}

module.exports = { checkFileContent, expandGlob, FORBIDDEN_PATTERNS, REQUIRED_COMMENTS };