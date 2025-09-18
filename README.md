# Crypto Bonuses

A modern web application for discovering and comparing cryptocurrency casino bonuses. Built with Next.js, TypeScript, and Tailwind CSS.

<!-- Deployment trigger: Comment voting system fixed 2025-09-14 -->

## Features 

- Browse and search through various cryptocurrency casino bonuses
- Filter bonuses by type (deposit, free, free spins, etc.)
- Sort bonuses by value or alphabetically
- Copy promo codes with one click
- Responsive design for all devices
- Modern UI with smooth animations

## Tech Stack

- Next.js 14
- TypeScript
- Tailwind CSS
- React
- ESLint

## Getting Started

1. Clone the repository:
```bash
git clone https://github.com/yourusername/cryptobonuses.git
cd cryptobonuses
```

2. Install dependencies:
```bash
npm install
```

3. Run the development server:
```bash
npm run dev
```

4. Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/              # Next.js app directory
│   ├── layout.tsx    # Root layout component
│   ├── page.tsx      # Home page component
│   └── globals.css   # Global styles
├── components/       # React components
│   ├── CasinoCard.tsx
│   └── FilterControls.tsx
├── data/            # Data files
│   └── casinoBonuses.ts
└── types/           # TypeScript type definitions
    └── casino.ts
```

## Whop Freshness Verification System

### Automated Database-Based Freshness Sync
The system automatically creates freshness data for all whops with existing promo codes:

```bash
# Generate freshness JSON files for all whops with promo codes
npm run freshness:sync
```

This command:
- Reads your database to find all published whops with promo codes
- Creates `data/pages/{slug}.json` files for each whop
- Provides SEO-critical "Verification Status" sections above the fold
- **No external scraping** - only uses your existing database

### Automation Options

#### 🔄 **Automatic (Currently Disabled)**
- **GitHub Actions can run every 6 hours** (currently commented out)
- Uses `.github/workflows/refresh-freshness-db.yml`
- To enable: uncomment the `schedule:` section in the workflow file
- Connects to your database, syncs freshness data
- Auto-commits any changes to the repo
- Your site rebuilds automatically with fresh data

#### ⚡ **Manual Trigger**
- Go to your GitHub repo → Actions tab
- Click "Refresh Freshness from Database" → "Run workflow"
- Runs immediately on-demand

#### 🖥️ **Local Development**
- `npm run freshness:sync` locally
- Then push changes manually

### Manual Verification Process
To manually verify a promo code actually works at checkout:

1. **Locate the JSON file**: `data/pages/{slug}.json`
2. **Add verification data**:
   ```json
   {
     "code": "PROMO-CODE",
     "status": "working",
     "before": "$100.00",
     "after": "$80.00",
     "notes": "Manually tested at checkout - confirmed working",
     "checkedAt": "2025-09-18T10:32:00Z",
     "verifiedAt": "2025-09-18T11:15:00Z"
   }
   ```
3. **The difference**:
   - `checkedAt` only = Shows "Last checked" in blue (found on product page)
   - `verifiedAt` set = Shows "Last verified" in green (actually tested at checkout)

This provides maximum trust signals for SEO while maintaining honest verification status.

### Freshness Scripts & Workflows
- `scripts/freshness-sync.ts` - Database-based freshness sync (main method)
- `scripts/auto-check-whops.mjs` - Legacy automatic code checking
- `scripts/normalize-freshness.mjs` - Clean up existing JSON files
- `.github/workflows/refresh-freshness-db.yml` - **Primary automation** (every 6 hours)
- `.github/workflows/refresh-freshness.yml` - Legacy workflow

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

<!-- Trigger redeploy with sitemap environment variables - 2025-08-28 --> 