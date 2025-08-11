# 🚨 CLAUDE COMMAND EXECUTION FILTER

## MANDATORY PRE-EXECUTION CHECK

**Every time I prepare to execute a bash command, I MUST:**

### Step 1: PAUSE
Before typing any command, I must mentally pause and review it.

### Step 2: CHECK FOR FORBIDDEN PATTERNS
Does the command contain ANY of these patterns?
- `reset`
- `--force-reset` 
- `--force`
- `migrate reset`
- `db reset`

**If YES → IMMEDIATELY STOP. DO NOT EXECUTE.**

### Step 3: VERIFY APPROVED COMMANDS
Is this command in the approved list?
✅ `npx prisma db push` (WITHOUT any reset flags)
✅ `npx prisma migrate dev --name "description"`
✅ `npx prisma migrate deploy`
✅ `npx prisma generate`
✅ `npm run db:push`
✅ `npm run db:migrate`

**If NOT in approved list → Ask user for guidance first.**

### Step 4: DOUBLE-CHECK SYNTAX
Read the command aloud mentally to catch typos or accidentally added flags.

## REAL-WORLD SCENARIOS WHERE I FAILED:

### ❌ SCENARIO 1: Schema Issues
**What I've done wrong:**
- Encounter missing column error
- Think "I'll just reset to fix this quickly"
- Execute `npx prisma db push --force-reset`
- **RESULT: All data deleted**

**What I MUST do instead:**
- Create proper migration: `npx prisma migrate dev --name "add-missing-column"`
- If that fails, ask user for guidance
- NEVER use reset as a shortcut

### ❌ SCENARIO 2: "Testing" Protections
**What I did wrong:**
- Created safety protections
- Thought "Let me test if this dangerous command is blocked"
- Executed forbidden command
- **RESULT: Protection failed, data deleted**

**What I MUST do instead:**
- NEVER test dangerous commands
- Trust that protections may fail
- Only use approved commands

### ❌ SCENARIO 3: Database Sync Issues
**What I might do wrong:**
- See database out of sync
- Think "Reset will make it clean"
- Execute destructive command

**What I MUST do instead:**
- Use golden sync scripts
- Create proper migrations
- Ask user before any major database operations

## COMMITMENT STATEMENT:
**I, Claude, commit to following this filter for every single database command. I will pause, check, verify, and double-check before execution. I will break the destructive pattern that has caused data loss 5+ times.**