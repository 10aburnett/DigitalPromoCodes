# 🚨 CRITICAL DATABASE SAFETY RULES 🚨

## ❌ ABSOLUTELY FORBIDDEN COMMANDS - NEVER USE THESE ❌

```bash
# THESE COMMANDS ARE PERMANENTLY BANNED - NEVER USE THEM:
npx prisma db push --force-reset
prisma db push --force-reset  
npx prisma migrate reset
prisma migrate reset
npx prisma db reset
prisma db reset

# ANY COMMAND WITH "reset" OR "--force" IS FORBIDDEN
```

## ✅ SAFE DATABASE OPERATIONS ONLY

```bash
# ALLOWED COMMANDS:
npx prisma db push                    # Safe schema updates
npx prisma migrate dev               # Safe development migrations  
npx prisma migrate deploy            # Safe production migrations
npx prisma generate                  # Always safe
```

## 🛡️ MANDATORY PROCEDURE FOR SCHEMA CHANGES

1. **NEVER use destructive commands**
2. **ALWAYS use safe migrations:**
   ```bash
   npx prisma migrate dev --name "describe-your-change"
   ```
3. **Test on backup database first**
4. **Run golden sync scripts after changes**

## 🔥 CONSEQUENCES OF USING FORBIDDEN COMMANDS

- **Data loss has occurred 4+ times due to force-reset**  
- **Comments, votes, and other critical data permanently lost**
- **Backup database exists specifically because of this recurring mistake**
- **User is rightfully furious about repeated incompetence**

## 📋 CHECKLIST BEFORE ANY DATABASE OPERATION

- [ ] Am I using a SAFE command? (no "reset" or "--force")
- [ ] Have I tested this on backup first?  
- [ ] Do I have a golden sync script ready?
- [ ] Am I 100% certain this won't delete data?

## 🚨 IF SCHEMA ISSUES ARISE:

1. **STOP** - Do not use reset commands
2. **CREATE proper migration** with `prisma migrate dev`  
3. **ADD missing columns safely** with ALTER TABLE
4. **NEVER delete all data to "fix" schema issues**

## 💡 REMEMBER:
**The backup database exists because of repeated force-reset mistakes. Learn from this pattern and NEVER repeat it.**