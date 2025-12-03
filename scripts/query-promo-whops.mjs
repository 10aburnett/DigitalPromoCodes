import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Find all whops that have at least one promo code (READ ONLY)
  const whopsWithPromos = await prisma.deal.findMany({
    where: {
      PromoCode: {
        some: {}  // Has at least one promo code
      }
    },
    select: {
      id: true,
      slug: true,
      name: true,
      _count: {
        select: {
          PromoCode: true
        }
      }
    },
    orderBy: {
      slug: 'asc'
    }
  });

  console.log(`\nFound ${whopsWithPromos.length} whops with promo codes`);
  console.log(`Total promo codes across all whops: ${whopsWithPromos.reduce((sum, w) => sum + w._count.PromoCode, 0)}`);

  // Export slugs
  const slugs = whopsWithPromos.map(w => w.slug);
  console.log(`\nFirst 10 slugs: ${slugs.slice(0, 10).join(', ')}`);

  // Save to files
  const fs = await import('fs');
  fs.writeFileSync('data/promo-whop-slugs.txt', slugs.join('\n'));
  fs.writeFileSync('data/promo-whop-slugs-comma.txt', slugs.join(','));

  console.log(`\nAll ${slugs.length} slugs saved to:`);
  console.log(`  data/promo-whop-slugs.txt (one per line)`);
  console.log(`  data/promo-whop-slugs-comma.txt (comma-separated)`);
}

main()
  .then(async () => {
    await prisma.$disconnect();
  })
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
