#!/bin/bash

# 🛡️ PRISMA SAFETY WRAPPER - BLOCKS DESTRUCTIVE COMMANDS

# Check if command contains forbidden patterns
if [[ "$*" == *"--force-reset"* ]] || [[ "$*" == *"reset"* ]]; then
    echo "🚨 BLOCKED: DANGEROUS PRISMA COMMAND DETECTED!"
    echo "Command: $*"
    echo ""
    echo "❌ THIS COMMAND HAS CAUSED DATA LOSS 5+ TIMES"
    echo "❌ USE SAFE ALTERNATIVES:"
    echo ""
    echo "✅ npx prisma db push           (for schema updates)"
    echo "✅ npx prisma migrate dev       (for new migrations)"
    echo "✅ npx prisma migrate deploy    (for production)"
    echo ""
    echo "See NEVER-FORCE-RESET.md for details"
    exit 1
fi

# If safe, run the original command
exec npx "$@"