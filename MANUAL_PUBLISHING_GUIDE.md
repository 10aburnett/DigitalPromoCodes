# Manual Whop Publishing Guide

## Overview
Since the last GitHub push removed 250 whops, you can now manually publish whops using these scripts instead of relying on the cron job.

## Available Scripts

### 1. Check Current Status
```bash
npm run check-whop-status
```
Shows:
- Current published/unpublished counts
- Percentage of whops published
- Days remaining for full publication
- Next 5 whops to be published
- Recently published whops

### 2. Publish Next 250 Whops
```bash
npm run publish-whops
```
Publishes the next 250 oldest unpublished whops.

### 3. Publish Custom Number of Whops
```bash
npm run publish-custom <number>
```
Examples:
```bash
npm run publish-custom 100    # Publish 100 whops
npm run publish-custom 500    # Publish 500 whops
npm run publish-custom 50     # Publish 50 whops
```

## Current Status
- **Total Whops**: 8,211
- **Published**: 750 (9.1%)
- **Unpublished**: 7,461
- **Days Remaining**: ~30 days at 250 per day

## How It Works
1. Scripts connect to your Neon database using the DATABASE_URL from `.env.local`
2. They find the oldest unpublished whops (by `createdAt` date)
3. Set their `publishedAt` field to the current date
4. Only whops with `publishedAt != null` are visible on the public site

## Safety Features
- ✅ Scripts only publish whops that are currently unpublished
- ✅ They respect the 250 whop limit (or custom limit you specify)
- ✅ They show detailed information before and after publishing
- ✅ They handle errors gracefully
- ✅ They disconnect from the database properly

## Monitoring Progress
Run the status check script regularly to monitor progress:
```bash
npm run check-whop-status
```

## Admin Panel Alternative
You can also use the admin panel at `/admin/publishing` to:
- View publication status
- Manually publish/unpublish whops
- Monitor progress

## Cron Job
The automatic cron job is still active and will publish 250 whops daily at 9:30 PM UTC. You can:
- Let it run automatically
- Use manual scripts to publish additional whops
- Disable it temporarily if needed

## Troubleshooting
If you encounter any issues:
1. Make sure `.env.local` contains your DATABASE_URL
2. Ensure you have the latest dependencies: `npm install`
3. Check the database connection is working
4. Verify the scripts have proper permissions

## Next Steps
1. Run `npm run check-whop-status` to see current state
2. Run `npm run publish-whops` to publish the next 250
3. Monitor progress with the status script
4. Repeat as needed until all whops are published 