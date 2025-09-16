# Branch-Aware Database Connection

This system automatically selects the correct Neon database based on your current git branch to eliminate connection flapping during development.

## How It Works

- **Development branch** → Backup Database (`ep-rough-rain-...`)
- **Main branch** → Production Database (`ep-noisy-hat-...`)
- Single `DATABASE_URL` set at startup, no switching during HMR
- Singleton Prisma client prevents multiple connections

## Usage

### Normal Development
```bash
# Automatically uses backup DB on development branch
git checkout development
npm run dev

# Automatically uses production DB on main branch
git checkout main
npm run dev
```

### Manual Override
```bash
# Force backup DB regardless of branch
npm run start:local-backup

# Force production DB regardless of branch
npm run start:local-prod
```

## Files Modified

- `scripts/set-env-from-branch.js` - Branch detection & .env.local generation
- `src/lib/prisma.ts` - Hardened singleton client with helpful errors
- `package.json` - Updated dev scripts to run branch detection first

## Troubleshooting

- **"DATABASE_URL is missing"**: Run `npm run dev` instead of `next dev`
- **Still getting flapping**: Restart dev server after branch changes
- **Wrong database**: Check `.env.local` was generated correctly

The system logs which database it connects to on startup for verification.