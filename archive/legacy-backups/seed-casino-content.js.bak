const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function seedCasinoContent() {
  try {
    // Find the first casino to add sample content
    const casino = await prisma.casino.findFirst();
    
    if (!casino) {
      console.log('No casinos found. Please add a casino first.');
      return;
    }

    console.log(`Adding sample content to casino: ${casino.name}`);

    const sampleContent = {
      aboutContent: `
        <p><strong>${casino.name}</strong> has established itself as a premier destination in the cryptocurrency gambling space, offering players an exceptional gaming experience with cutting-edge technology and user-friendly design.</p>
        
        <p>Founded with a vision to revolutionize online gambling through blockchain technology, ${casino.name} combines transparency, security, and entertainment to create an unparalleled platform for both novice and experienced players.</p>
        
        <h3>Key Features</h3>
        <ul>
          <li><strong>Provably Fair Gaming:</strong> All games use cryptographic algorithms that allow players to verify the fairness of every outcome</li>
          <li><strong>Instant Transactions:</strong> Cryptocurrency deposits and withdrawals are processed within minutes</li>
          <li><strong>Global Accessibility:</strong> Available worldwide with minimal restrictions</li>
          <li><strong>24/7 Support:</strong> Round-the-clock customer service via live chat and email</li>
        </ul>
        
        <p>Security is paramount at ${casino.name}, with advanced encryption and blockchain technology ensuring all transactions and personal data remain protected. The platform's commitment to responsible gambling includes comprehensive tools for setting limits and self-exclusion options.</p>
      `,
      
      howToRedeemContent: `
        <p>Follow these simple steps to claim your exclusive bonus at ${casino.name}:</p>
        
        <ol>
          <li><strong>Click the "Get Bonus" button</strong> above to visit ${casino.name}'s official website</li>
          <li><strong>Create your account</strong> by providing a valid email address and creating a secure password</li>
          <li><strong>Verify your email</strong> by clicking the confirmation link sent to your inbox</li>
          <li><strong>Make your first deposit</strong> using any supported cryptocurrency (Bitcoin, Ethereum, Litecoin, etc.)</li>
          <li><strong>Enter the bonus code</strong> if required during the deposit process</li>
          <li><strong>Start playing</strong> and enjoy your bonus funds!</li>
        </ol>
        
        <div class="bg-[#343541] p-4 rounded-lg mt-4">
          <p><strong>💡 Pro Tip:</strong> Make sure to read the bonus terms and conditions before claiming to understand wagering requirements and game restrictions.</p>
        </div>
      `,
      
      bonusDetailsContent: `
        <p>This exclusive welcome package is designed to give new players the best possible start at ${casino.name}. The bonus provides substantial additional funds to explore our extensive game library and maximize your winning potential.</p>
        
        <h3>Bonus Breakdown</h3>
        <div class="bg-[#343541] p-4 rounded-lg">
          <ul>
            <li><strong>Match Percentage:</strong> Up to 200% on your first deposit</li>
            <li><strong>Maximum Bonus:</strong> Varies by deposit amount</li>
            <li><strong>Minimum Deposit:</strong> 0.001 BTC or equivalent</li>
            <li><strong>Wagering Requirement:</strong> 35x bonus amount</li>
            <li><strong>Valid For:</strong> 30 days from activation</li>
          </ul>
        </div>
        
        <h3>Eligible Games</h3>
        <p>This bonus can be used on most games in our casino, with different contribution rates:</p>
        <ul>
          <li><strong>Slots:</strong> 100% contribution toward wagering</li>
          <li><strong>Table Games:</strong> 10% contribution toward wagering</li>
          <li><strong>Live Dealer:</strong> 10% contribution toward wagering</li>
          <li><strong>Crypto Games:</strong> 50% contribution toward wagering</li>
        </ul>
        
        <p><em>Please note that some games may be restricted while bonus funds are active. Check the full terms and conditions for complete details.</em></p>
      `,
      
      gameContent: `
        <p>${casino.name} offers an impressive selection of over 3,000 games from the industry's leading providers, ensuring there's something for every type of player.</p>
        
        <h3>🎰 Slot Games</h3>
        <p>Our slot collection features the latest releases and classic favorites from top providers including:</p>
        <ul>
          <li><strong>Pragmatic Play:</strong> Gates of Olympus, Sweet Bonanza, The Dog House</li>
          <li><strong>NetEnt:</strong> Starburst, Gonzo's Quest, Dead or Alive 2</li>
          <li><strong>Play'n GO:</strong> Book of Dead, Reactoonz, Fire Joker</li>
          <li><strong>Microgaming:</strong> Mega Moolah, Immortal Romance, Thunderstruck II</li>
        </ul>
        
        <h3>🃏 Table Games</h3>
        <p>Experience the thrill of classic casino games with multiple variants:</p>
        <ul>
          <li><strong>Blackjack:</strong> Classic, European, Single Deck, and more</li>
          <li><strong>Roulette:</strong> American, European, French, and Lightning variants</li>
          <li><strong>Baccarat:</strong> Punto Banco, Mini Baccarat, Speed Baccarat</li>
          <li><strong>Poker:</strong> Caribbean Stud, Three Card Poker, Casino Hold'em</li>
        </ul>
        
        <h3>🎮 Crypto-Native Games</h3>
        <p>Unique blockchain-based games designed specifically for crypto players:</p>
        <ul>
          <li><strong>Crash:</strong> Watch the multiplier rise and cash out before it crashes</li>
          <li><strong>Plinko:</strong> Drop balls through pegs for random multipliers</li>
          <li><strong>Dice:</strong> Simple yet exciting with customizable odds</li>
          <li><strong>Mines:</strong> Navigate a minefield for increasing rewards</li>
        </ul>
        
        <h3>🎥 Live Dealer Games</h3>
        <p>Immersive live casino experience with professional dealers:</p>
        <ul>
          <li>Live Blackjack with multiple tables and betting limits</li>
          <li>Live Roulette including Lightning and Immersive variants</li>
          <li>Live Baccarat with squeeze and speed options</li>
          <li>Game Shows like Crazy Time, Dream Catcher, and Monopoly Live</li>
        </ul>
      `,
      
      termsContent: `
        <p>This bonus offer is subject to the following terms and conditions. Please read carefully before claiming:</p>
        
        <h3>General Terms</h3>
        <ul>
          <li>This offer is available to new players only, one per household/IP address</li>
          <li>Players must be 18 years or older to participate</li>
          <li>Bonus funds cannot be withdrawn until wagering requirements are met</li>
          <li>Maximum bet while bonus is active: $5 USD equivalent</li>
          <li>Bonus expires 30 days after activation if wagering is not completed</li>
        </ul>
        
        <h3>Wagering Requirements</h3>
        <ul>
          <li>Bonus amount must be wagered 35 times before withdrawal</li>
          <li>Different games contribute differently toward wagering (see bonus details)</li>
          <li>Wagering must be completed within 30 days of bonus activation</li>
          <li>Only real money bets count toward wagering requirements</li>
        </ul>
        
        <h3>Restricted Activities</h3>
        <ul>
          <li>Betting on opposite outcomes in the same game is prohibited</li>
          <li>Using betting strategies that guarantee profit is not allowed</li>
          <li>Bonus abuse or fraudulent activity will result in bonus forfeiture</li>
        </ul>
        
        <div class="bg-[#343541] p-4 rounded-lg mt-4">
          <p><strong>⚠️ Important:</strong> ${casino.name} reserves the right to modify or cancel this promotion at any time. For complete terms and conditions, please visit our website.</p>
        </div>
      `,
      
      faqContent: `
        <div class="space-y-4">
          <div class="bg-[#343541] rounded-lg p-4">
            <h3 class="font-semibold text-lg text-white mb-2">How do I claim my welcome bonus?</h3>
            <p class="text-white/85">Simply click the "Get Bonus" button, register a new account, and make your first deposit. The bonus will be automatically credited to your account.</p>
          </div>
          
          <div class="bg-[#343541] rounded-lg p-4">
            <h3 class="font-semibold text-lg text-white mb-2">What cryptocurrencies do you accept?</h3>
            <p class="text-white/85">We accept Bitcoin (BTC), Ethereum (ETH), Litecoin (LTC), Bitcoin Cash (BCH), Dogecoin (DOGE), and many other popular cryptocurrencies.</p>
          </div>
          
          <div class="bg-[#343541] rounded-lg p-4">
            <h3 class="font-semibold text-lg text-white mb-2">How long do withdrawals take?</h3>
            <p class="text-white/85">Cryptocurrency withdrawals are typically processed within 10 minutes. However, blockchain confirmation times may vary depending on network congestion.</p>
          </div>
          
          <div class="bg-[#343541] rounded-lg p-4">
            <h3 class="font-semibold text-lg text-white mb-2">Is ${casino.name} provably fair?</h3>
            <p class="text-white/85">Yes! All our games use provably fair technology, allowing you to verify the randomness and fairness of every game outcome using cryptographic methods.</p>
          </div>
          
          <div class="bg-[#343541] rounded-lg p-4">
            <h3 class="font-semibold text-lg text-white mb-2">Do you offer customer support?</h3>
            <p class="text-white/85">Absolutely! Our customer support team is available 24/7 via live chat and email. We typically respond within minutes during peak hours.</p>
          </div>
          
          <div class="bg-[#343541] rounded-lg p-4">
            <h3 class="font-semibold text-lg text-white mb-2">Can I play on mobile devices?</h3>
            <p class="text-white/85">Yes! ${casino.name} is fully optimized for mobile devices. You can play all our games directly in your mobile browser without downloading any apps.</p>
          </div>
        </div>
      `
    };

    // Update the casino with sample content
    await prisma.casino.update({
      where: { id: casino.id },
      data: sampleContent
    });

    console.log('✅ Sample content added successfully!');
    console.log(`You can now edit the content for ${casino.name} in the admin panel.`);
    console.log(`Visit: http://localhost:3000/admin/casinos/${casino.id}/content`);
    
  } catch (error) {
    console.error('Error seeding casino content:', error);
  } finally {
    await prisma.$disconnect();
  }
}

seedCasinoContent(); 