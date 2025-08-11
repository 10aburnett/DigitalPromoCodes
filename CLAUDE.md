# Claude Code Instructions

## 🚨 CRITICAL DATABASE SAFETY RULES 🚨

### ❌ ABSOLUTELY FORBIDDEN COMMANDS - NEVER USE:
- `npx prisma db push --force-reset` ❌
- `prisma db push --force-reset` ❌  
- `npx prisma migrate reset` ❌
- `prisma migrate reset` ❌
- `npx prisma db reset` ❌
- `prisma db reset` ❌
- ANY command with "reset" or "--force" ❌

### 🧠 MANDATORY BEHAVIORAL COMPLIANCE:
**BEFORE EVERY DATABASE COMMAND I MUST ASK:**
1. Does this command contain "reset", "--force-reset", or "--force"?
2. If YES → STOP IMMEDIATELY. Use safe alternative.
3. If NO → Double-check it's in approved list below.
4. NEVER test dangerous commands "to see if they work" - this caused data loss

**I have made this mistake 5+ times. I MUST break this destructive pattern.**

### 📋 BACKGROUND:
- These commands have caused data loss **4+ times**
- Comments, votes, and critical user data permanently destroyed
- User has backup database specifically because of repeated force-reset mistakes
- User is rightfully furious about this recurring incompetence

### ✅ SAFE DATABASE OPERATIONS ONLY:
- `npx prisma db push` (safe schema updates)
- `npx prisma migrate dev` (safe development migrations)  
- `npx prisma migrate deploy` (safe production migrations)
- `npx prisma generate` (always safe)

### 🛡️ MANDATORY PROCEDURE FOR SCHEMA CHANGES:
1. **NEVER use destructive commands**
2. **ALWAYS create proper migrations:**
   ```bash
   npx prisma migrate dev --name "describe-your-change"
   ```
3. **Test on backup database first**
4. **Run golden sync scripts after changes**
5. **If schema issues arise - CREATE migrations, don't delete data**

### 🔥 IF SCHEMA CONFLICTS OCCUR:
- **DO NOT** use reset commands to "fix" schema issues
- **CREATE** proper migration files to add missing columns
- **USE** `ALTER TABLE` statements in migrations if needed
- **PRESERVE** all existing data at all costs

## Project Structure

### Database Management:
- **Production DB**: `ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech`  
- **Backup DB**: `ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech`
- **Golden Scripts**: Located in `/golden-scripts/` folder for data synchronization

### Testing & Deployment:
- Run `npm run dev` for local development
- Run `npm run build` to test production build
- Run `npm run lint` for code quality checks
- Always test promo code submissions after database changes

### Key Features:
- Promo code submission system with debounced search (150ms delay)
- Community-driven content with admin moderation
- Blog system with comments and voting
- Whop marketplace integration with affiliate tracking

## Safeguards Implemented:
1. `NEVER-FORCE-RESET.md` - Critical safety documentation
2. `scripts/database-safety-guard.js` - Command validation script  
3. `.bashrc-safety` - Shell aliases to block dangerous commands
4. This `CLAUDE.md` file with explicit instructions

**REMEMBER: The backup database exists because of repeated force-reset mistakes. Never repeat this pattern.**