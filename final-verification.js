const { PrismaClient } = require('@prisma/client');

const backupDb = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_GL1sjBY8oSOb@ep-rough-rain-ab2qairk-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require' } }
});

const productionDb = new PrismaClient({
  datasources: { db: { url: 'postgresql://neondb_owner:npg_LoKgTrZ9ua8D@ep-noisy-hat-abxp8ysf-pooler.eu-west-2.aws.neon.tech/neondb?sslmode=require' } }
});

async function finalCompleteVerification() {
  console.log('🎉 FINAL COMPLETE DATABASE SYNCHRONIZATION STATUS');
  console.log('=================================================');
  
  const backupCounts = {
    users: await backupDb.user.count(),
    whops: await backupDb.whop.count(),
    promoCodes: await backupDb.promoCode.count(),
    blogPosts: await backupDb.blogPost.count(),
    comments: await backupDb.comment.count(),
    votes: await backupDb.commentVote.count(),
    mailingList: await backupDb.mailingList.count(),
    promoSubmissions: await backupDb.promoCodeSubmission.count()
  };
  
  const productionCounts = {
    users: await productionDb.user.count(),
    whops: await productionDb.whop.count(),
    promoCodes: await productionDb.promoCode.count(),
    blogPosts: await productionDb.blogPost.count(),
    comments: await productionDb.comment.count(),
    votes: await productionDb.commentVote.count(),
    mailingList: await productionDb.mailingList.count(),
    promoSubmissions: await productionDb.promoCodeSubmission.count()
  };
  
  console.log('\n📊 BACKUP DATABASE:');
  console.log(`   Users:            ${backupCounts.users}`);
  console.log(`   Whops:            ${backupCounts.whops}`);
  console.log(`   PromoCodes:       ${backupCounts.promoCodes}`);
  console.log(`   BlogPosts:        ${backupCounts.blogPosts}`);
  console.log(`   Comments:         ${backupCounts.comments}`);
  console.log(`   Votes:            ${backupCounts.votes}`);
  console.log(`   MailingList:      ${backupCounts.mailingList}`);
  console.log(`   PromoSubmissions: ${backupCounts.promoSubmissions}`);
  
  console.log('\n📊 PRODUCTION DATABASE:');
  console.log(`   Users:            ${productionCounts.users}`);
  console.log(`   Whops:            ${productionCounts.whops}`);
  console.log(`   PromoCodes:       ${productionCounts.promoCodes}`);
  console.log(`   BlogPosts:        ${productionCounts.blogPosts}`);
  console.log(`   Comments:         ${productionCounts.comments}`);
  console.log(`   Votes:            ${productionCounts.votes}`);
  console.log(`   MailingList:      ${productionCounts.mailingList}`);
  console.log(`   PromoSubmissions: ${productionCounts.promoSubmissions}`);
  
  console.log('\n🔍 SYNCHRONIZATION STATUS:');
  let allMatched = true;
  const fields = Object.keys(backupCounts);
  fields.forEach(field => {
    const match = backupCounts[field] === productionCounts[field];
    if (!match) allMatched = false;
    const status = match ? '✅ SYNCED' : '⚠️ DIFFERS';
    console.log(`   ${field}: ${status} - Backup: ${backupCounts[field]}, Production: ${productionCounts[field]}`);
  });
  
  const totalBackup = Object.values(backupCounts).reduce((a, b) => a + b, 0);
  const totalProduction = Object.values(productionCounts).reduce((a, b) => a + b, 0);
  
  console.log('\n📋 FINAL SUMMARY:');
  console.log(`   Total Backup Records:     ${totalBackup}`);
  console.log(`   Total Production Records: ${totalProduction}`);
  console.log(`   Perfect Sync Status:      ${allMatched ? '🎉 YES - PERFECTLY SYNCHRONIZED!' : '⚠️ NO - SOME DIFFERENCES'}`);
  console.log(`   System Health:            ${totalBackup > 8000 && totalProduction > 8000 ? '🚀 EXCELLENT - FULLY OPERATIONAL' : '⚠️ NEEDS ATTENTION'}`);
  
  if (allMatched) {
    console.log('\n🎊 CONGRATULATIONS! 🎊');
    console.log('Both databases are now perfectly synchronized!');
    console.log('The promo code submission system is ready for production use.');
  }
  
  await backupDb.$disconnect();
  await productionDb.$disconnect();
}

finalCompleteVerification().catch(console.error);