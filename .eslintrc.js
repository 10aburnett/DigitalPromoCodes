/** @type {import('eslint').Linter.Config} */
module.exports = {
  extends: ['next/core-web-vitals'],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module',
  },
  overrides: [
    {
      // Enforce DB import guardrails for schema-related files
      files: ['src/lib/jsonld.ts', 'src/lib/urls.ts', 'src/**/*schema*.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@prisma/client',
                message: 'CRITICAL GUARDRAIL: Never import Prisma in schema files. Schema functions must accept plain objects only.'
              },
              {
                name: '@/lib/prisma',
                message: 'CRITICAL GUARDRAIL: Never import Prisma in schema files. Schema functions must accept plain objects only.'
              },
              {
                name: 'prisma',
                message: 'CRITICAL GUARDRAIL: Never import Prisma in schema files. Schema functions must accept plain objects only.'
              }
            ],
            patterns: [
              {
                group: ['**/prisma*', '**/*prisma*', '**/db*', '**/*database*'],
                message: 'CRITICAL GUARDRAIL: Never import database-related modules in schema files. Schema functions must accept plain objects only.'
              }
            ]
          }
        ],
        'no-restricted-globals': [
          'error',
          {
            name: 'prisma',
            message: 'CRITICAL GUARDRAIL: Never use global prisma in schema files.'
          }
        ]
      }
    },
    {
      // Additional safety for all JSON-LD related files
      files: ['**/*jsonld*', '**/*json-ld*', '**/*schema*'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              {
                name: '@prisma/client',
                message: 'SCHEMA GUARDRAIL: JSON-LD functions must never access database directly. Use page props or layout data only.'
              },
              {
                name: '@/lib/prisma',
                message: 'SCHEMA GUARDRAIL: JSON-LD functions must never access database directly. Use page props or layout data only.'
              }
            ]
          }
        ]
      }
    }
  ],
  rules: {
    // General code quality rules
    'prefer-const': 'error',
    'no-unused-vars': 'off', // Disable base rule in favor of TypeScript version
    // Prevent common Next.js issues
    '@next/next/no-img-element': 'error',
    '@next/next/no-html-link-for-pages': 'error'
  }
};