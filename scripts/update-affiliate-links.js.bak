const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function updateAffiliateLinks() {
  console.log('Updating affiliate links for existing casinos...');

  const affiliateData = [
    // Original affiliates
    { slug: 'bc-game', affiliateLink: 'https://bc.game/?i=bcbonus&s=&c=&utm_source=bcbonus#/login/regist' },
    { slug: 'stake', affiliateLink: 'https://stake.com/join?entry=EN200DB&offer=TOPBONUS' },
    { slug: 'bitstarz', affiliateLink: 'https://bs4.direct/b84efcabb' },
    { slug: 'wild-io', affiliateLink: 'https://wildpartners.app/a239cca7a' },
    { slug: 'winz-io', affiliateLink: 'https://cryptobonuses.com/go/winz' },
    { slug: 'betplay-io', affiliateLink: 'https://cryptobonuses.com/go/betplay' },
    { slug: 'justbit', affiliateLink: 'https://trackingjustbit.io/d8b8f3d14' },
    { slug: 'betfury', affiliateLink: 'https://betfury.bet/d2dc9547f' },
    { slug: 'gamdom', affiliateLink: 'https://gamdom.com/r/bonusvip' },
    { slug: 'shuffle-com', affiliateLink: 'https://cryptobonuses.com/go/shuffle' },
    { slug: 'fortunejack', affiliateLink: 'https://tracker-pm2.fortunejackpartners.com/link?btag=3849227_238091' },
    { slug: 'jackbit', affiliateLink: 'https://go.affision.com/visit/?bta=41345&brand=jackbit' },
    
    // Additional affiliates from the HTML
    { slug: 'mbit', affiliateLink: 'https://cryptobonuses.com/go/mbit' },
    { slug: 'flush', affiliateLink: 'https://cryptobonuses.com/go/flush' },
    { slug: 'coins-game', affiliateLink: 'https://coinsaffs.com/d3c3b30b1' },
    { slug: 'oshi', affiliateLink: 'https://cryptobonuses.com/go/oshi' },
    { slug: 'vavada', affiliateLink: 'https://vavadacompartner.com/?promo=fc0bae64-a9d7-4d7a-bf57-69eeb7705462&target=register' },
    { slug: 'coinplay', affiliateLink: 'https://promotioncoinplay.com/L?tag=d_2100567m_57509c_START&site=2100567&ad=57509' },
    { slug: 'stake-us', affiliateLink: 'https://stake.us/?c=CCODES' },
    { slug: 'rollbit', affiliateLink: 'https://rollbit.com/referral/RBONUS' },
    { slug: 'duelbits', affiliateLink: 'https://affiliates.duelbits.com/visit/?bta=35091&brand=duelbits' },
    { slug: 'roobet', affiliateLink: 'https://roobet.com/?ref=rbonus' },
    { slug: 'betchain', affiliateLink: 'https://betchainmedia.com/a6d33a609' },
    { slug: '7bit', affiliateLink: 'https://7bit.partners/a540ad78e' },
    { slug: 'cryptoleo', affiliateLink: 'https://track.chillipartners.com/visit/?bta=36797&nci=5507' },
    { slug: 'primedice', affiliateLink: 'https://primedice.com/?c=fYGL9uId' },
    { slug: '1xbit', affiliateLink: 'https://refpa9063395.top/L?tag=b_2101147m_3425c_1XBONUS&site=2101147&ad=3425&r=registration/' },
    { slug: 'sportsbet', affiliateLink: 'https://aff.partners.io/visit/?bta=1384&nci=5627' },
    { slug: 'chips-gg', affiliateLink: 'https://chips.gg/?r=vipbonus' },
    { slug: 'bspin', affiliateLink: 'https://bspin.io/?pid=7ed77' },
    { slug: 'metaspins', affiliateLink: 'https://metamedialinks.com/e1a8f2b08' },
    { slug: 'ignition', affiliateLink: 'https://record.revenuenetwork.com/_irjOUZ76Mydc9zZIk0ytdGNd7ZgqdRLk/1/' },
    { slug: 'bovada', affiliateLink: 'https://record.revenuenetwork.com/_irjOUZ76Myf-jkIYC6YAF2Nd7ZgqdRLk/1/' },
    { slug: 'thunderpick', affiliateLink: 'https://go.thunder.partners/visit/?bta=35404&nci=5560&campaign=WELCOME&utm_campaign=ccodes' },
    { slug: 'trustdice', affiliateLink: 'https://trustdice.win?ref=bigbonus457297' },
    { slug: 'bets-io', affiliateLink: 'https://betsio.link/h94ba1190' },
    { slug: 'luckybird', affiliateLink: 'https://luckybird.io/?c=luckyfree' },
    { slug: 'cloudbet', affiliateLink: 'https://cldbt.cloud/go/en/bitcoin-bonus?af_token=44553a766a8bc8974320d4703dfd535c&aftm_campaign=cryptobonuses' },
    { slug: 'nanogames', affiliateLink: 'https://nanogames.io/login/regist/?i=newbonus' },
    { slug: 'crashino', affiliateLink: 'https://www.crashino.com/en' },
    { slug: 'vave', affiliateLink: 'https://top.moxtop.com/redirect.aspx?pid=9385&bid=1481&lpid=198' },
    { slug: 'cryptogames', affiliateLink: 'https://crypto-games.io/en/home?r=NEWBONUS' },
    { slug: 'betiro', affiliateLink: 'https://www.betiro.com/' },
    { slug: 'jacks-club', affiliateLink: 'https://jacksclub.io?r=jackbonus' },
    { slug: 'coinpoker', affiliateLink: 'https://record.coinpokeraffiliates.com/_acfZQzI4M4nUOsjNOfgKeWNd7ZgqdRLk/1/' },
    { slug: 'leebet', affiliateLink: 'https://leebet.io/?ref=D240B79A3D06B0C9' },
    { slug: 'spinarium', affiliateLink: 'https://spinarium.cc/d05e7ddb3' },
    { slug: 'destinyx', affiliateLink: 'https://destinyx.com/ref/897a7d17a1' },
    { slug: 'bitsler', affiliateLink: 'https://www.bitsler.com/?c=r8mpwd3lvbww3vqd' },
    { slug: 'tether-bet', affiliateLink: 'https://tether.bet/' },
    { slug: 'fairspin', affiliateLink: 'https://cryptobonuses.com/go/fairspin' },
    { slug: 'betpanda', affiliateLink: 'https://cryptobonuses.com/go/betpanda' },
    { slug: 'bitcasino', affiliateLink: 'https://aff.partners.io/visit/?bta=1384&brand=empireio' },
    { slug: 'empire', affiliateLink: 'https://aff.partners.io/visit/?bta=1384&brand=livecasinoio' },
    { slug: 'livecasino', affiliateLink: 'https://pixel.gg/r/newbonus' },
    { slug: 'pixel', affiliateLink: 'https://pixel.gg/r/newbonus' },
    { slug: 'sirwin', affiliateLink: 'https://sirwin.com/?aff=7384' }
  ];

  for (const data of affiliateData) {
    try {
      await prisma.casino.update({
        where: { slug: data.slug },
        data: { affiliateLink: data.affiliateLink },
      });
      console.log(`✓ Updated affiliate link for ${data.slug}`);
    } catch (error) {
      console.error(`✗ Failed to update ${data.slug}: ${error.message}`);
    }
  }

  console.log('Affiliate links update completed!');
}

updateAffiliateLinks()
  .catch(e => {
    console.error('Error updating affiliate links:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 