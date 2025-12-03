const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const { v4: uuidv4 } = require('uuid');

// Initialize Prisma client
const prisma = new PrismaClient();

// Map of casino names to their image paths
const casinoLogoMap = {
  'Stake': '/images/Stake Logo (1).png',
  'Stake.us': '/images/Stake US Logo.png',
  'BC Game': '/images/BC Game Logo (1).png',
  'BitStarz': '/images/BitStarz Logo (2).png',
  'Bitstarz': '/images/BitStarz Logo (2).png',
  'Wild.io': '/images/Wild IO Logo.png',
  'Winz.io': '/images/Winz IO Logo.png',
  'Betplay.io': '/images/Betplay IO Logo.png',
  'Justbit': '/images/Justbit Logo (2).png',
  'BetFury': '/images/BetFury Logo (2).png',
  'Gamdom': '/images/Gamdom Logo (4).png',
  'FortuneJack': '/images/FortuneJack Logo (1).png',
  'Jackbit': '/images/Jackbit Logo.png',
  'mBit Casino': '/images/mBit Casino Logo (1).png',
  'Coins.Game': '/images/Coins Game Logo (1).png',
  'Vavada': '/images/Vavada Logo (1).png',
  'Coinplay': '/images/Coinplay Logo (2).png',
  'Rollbit': '/images/Rollbit Logo (2).png',
  'Duelbits': '/images/Duelbits Logo (1).png',
  'Roobet': '/images/Roobet Logo (1).png',
  'BetChain': '/images/BetChain Logo (1).png',
  '7Bit Casino': '/images/7Bit Casino Logo (1).png',
  'CryptoLeo': '/images/CryptoLeo Casino Logo (3).png',
  'Primedice': '/images/Primedice Logo (1).png',
  '1xBit': '/images/1xBit Logo (1).png',
  'Sportsbet.io': '/images/Sportsbet IO Logo.png',
  'Chips.gg': '/images/Chips GG Logo.png',
  'Bspin': '/images/Bspin Logo (1).png',
  'Metaspins': '/images/Metaspins Casino Logo (1).png',
  'Ignition Casino': '/images/Ignition Casino Logo (1).png',
  'Bovada': '/images/Bovada Logo (1).png',
  'Thunderpick': '/images/Thunderpick Logo (1).png',
  'TrustDice': '/images/TrustDice Logo (1).png',
  'Bets.io': '/images/Bets IO Logo.png',
  'LuckyBird': '/images/LuckyBird Logo (1).png',
  'Cloudbet': '/images/Cloudbet Logo.png',
  'NanoGames': '/images/Nanogames Logo (1).png',
  'Crashino': '/images/Crashino Logo.png',
  'Vave': '/images/Vave Logo.png',
  'CryptoGames': '/images/Crypto-Games Logo.png',
  'Betiro': '/images/Betiro Logo.png',
  'Jacks Club': '/images/Jacks Club Logo.png',
  'CoinPoker': '/images/CoinPoker Logo.png',
  'Leebet': '/images/LEEBET Logo.png',
  'Spinarium': '/images/Spinarium Logo.png',
  'DestinyX': '/images/DestinyX Logo.png',
  'Bitsler': '/images/Bitsler Logo.png',
  '0xBet Casino': '/images/0xBet Casino Logo.png',
  'tether bet': '/images/tether bet Logo.png',
  'Fairspin': '/images/Fairspin Logo.png',
  'Betpanda.io': '/images/Betpanda IO Logo.png',
  'Livecasino.io': '/images/Livecasino IO Logo.png',
  'Empire Casino': '/images/Empire Casino Logo.png',
  'Pixel.gg': '/images/Pixel GG Logo.png',
  'Sirwin': '/images/Sirwin Logo.png',
  'Shuffle.com': '/images/Shuffle com Logo.png',
  'Flush.com': '/images/Flush Casino Logo.png',
  'Oshi Casino': '/images/Oshi Casino Logo.png',
  'Shuffle': '/images/Shuffle com Logo.png',
  'Flush': '/images/Flush Casino Logo.png',
  'Oshi': '/images/Oshi Casino Logo.png',
  'Bitcasino.io': '/images/Bitcasino IO Logo.png',
  'mBit': '/images/mBit Casino Logo (1).png',
};

async function migrateCasinoLogos() {
  try {
    // Get all casinos
    const casinos = await prisma.casino.findMany();
    console.log(`Found ${casinos.length} casinos to update`);
    
    const rootDir = process.cwd();
    const uploadsDir = path.join(rootDir, 'public', 'uploads');
    
    // Ensure uploads directory exists
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`Created uploads directory at ${uploadsDir}`);
    }
    
    // Process each casino
    for (const casino of casinos) {
      try {
        // Find logo path in our map
        const logoPath = casinoLogoMap[casino.name] || '/images/Simplified Logo.png';
        const sourcePath = path.join(rootDir, 'public', logoPath.substring(1)); // Remove leading '/'
        
        if (!fs.existsSync(sourcePath)) {
          console.log(`Logo not found for ${casino.name} at ${sourcePath}, skipping...`);
          continue;
        }
        
        // Check if casino already has a logo in the uploads directory
        if (casino.logo && casino.logo.startsWith('/uploads/')) {
          console.log(`Casino ${casino.name} already has a logo in the uploads directory: ${casino.logo}`);
          continue;
        }
        
        // Generate new filename
        const fileExt = path.extname(sourcePath);
        const newFileName = `${uuidv4()}${fileExt}`;
        const destPath = path.join(uploadsDir, newFileName);
        
        // Copy the file
        fs.copyFileSync(sourcePath, destPath);
        console.log(`Copied ${sourcePath} to ${destPath}`);
        
        // Update the database
        const updatedCasino = await prisma.casino.update({
          where: { id: casino.id },
          data: { logo: `/uploads/${newFileName}` },
        });
        
        console.log(`Updated ${casino.name} logo to ${updatedCasino.logo}`);
      } catch (error) {
        console.error(`Error processing casino ${casino.name}:`, error);
      }
    }
    
    console.log('Casino logo migration completed');
  } catch (error) {
    console.error('Migration failed:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the migration
migrateCasinoLogos(); 