# 🛡️ Database Safety Installation Instructions

## URGENT: Install These Safeguards Immediately

### 1. Add to your shell profile (~/.bashrc or ~/.zshrc):

```bash
# Add this line to your ~/.bashrc or ~/.zshrc:
source /path/to/your/project/.bashrc-safety
```

Then reload your shell:
```bash
source ~/.bashrc  # or source ~/.zshrc
```

### 2. Use Safe NPM Commands Only:

```bash
# ✅ SAFE - Use these instead of direct prisma commands:
npm run db:push       # Safe schema updates with validation
npm run db:migrate    # Safe migrations with validation  
npm run db:check-safety "your-command"  # Check if command is safe

# ❌ NEVER use these directly anymore:
# npx prisma db push --force-reset  
# npx prisma migrate reset
# Any command with "reset" or "--force"
```

### 3. Files Created:

1. **`NEVER-FORCE-RESET.md`** - Critical safety documentation
2. **`scripts/database-safety-guard.js`** - Command validation  
3. **`.bashrc-safety`** - Shell safety aliases
4. **`CLAUDE.md`** - Instructions for future Claude sessions
5. **Updated `package.json`** - Added safe database commands

### 4. How It Works:

- **Blocks all destructive commands** containing "reset", "--force-reset", etc.
- **Validates commands** before execution  
- **Shows safe alternatives** when dangerous commands are attempted
- **Prevents the data loss that has occurred 4+ times before**

### 5. Testing:

The safeguards are working correctly:
- `npm run db:check-safety "npx prisma db push --force-reset"` → ❌ BLOCKED
- `npm run db:check-safety "npx prisma db push"` → ✅ SAFE

### 6. Emergency Override:

If you absolutely must bypass these safeguards (you shouldn't need to):
1. Read `NEVER-FORCE-RESET.md` first
2. Manually run commands without the npm scripts
3. **NEVER do this on production data**

## Remember:
**These safeguards exist because destructive commands have caused data loss 4+ times. The backup database exists specifically because of repeated force-reset mistakes.**