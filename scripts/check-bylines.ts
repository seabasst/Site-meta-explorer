import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const p = new PrismaClient({ adapter });

async function main() {
  const withBylines = await p.adLibraryAd.count({ where: { bylines: { not: null } } });
  console.log('Ads with bylines:', withBylines);

  // Sample bylines to understand the format
  const samples = await p.adLibraryAd.findMany({
    where: { bylines: { not: null } },
    select: { adId: true, bylines: true, brand: { select: { pageName: true } } },
    take: 30,
  });
  for (const s of samples) {
    console.log(`  ${s.brand.pageName} | ${s.bylines}`);
  }

  // Check targeting JSON for bylines that differ from brand name
  const allWithBylines = await p.adLibraryAd.findMany({
    where: { bylines: { not: null } },
    select: { adId: true, bylines: true, brand: { select: { pageName: true, pageId: true } } },
  });

  const partnerships: { brand: string; byline: string; count: number }[] = [];
  const grouped = new Map<string, { brand: string; count: number }>();

  for (const ad of allWithBylines) {
    const byline = ad.bylines as string;
    // If byline doesn't match the brand name, it's likely a partnership
    if (byline && !byline.toLowerCase().includes(ad.brand.pageName.toLowerCase())) {
      const key = `${ad.brand.pageName}|||${byline}`;
      const entry = grouped.get(key);
      if (entry) {
        entry.count++;
      } else {
        grouped.set(key, { brand: ad.brand.pageName, count: 1 });
      }
    }
  }

  console.log(`\nPotential partnerships from bylines (byline != brand name):`);
  const sorted = [...grouped.entries()]
    .map(([key, v]) => ({ byline: key.split('|||')[1], brand: v.brand, count: v.count }))
    .sort((a, b) => b.count - a.count);

  for (const p of sorted.slice(0, 50)) {
    console.log(`  ${p.brand} → "${p.byline}" (${p.count} ads)`);
  }
  console.log(`\nTotal unique byline-brand pairs: ${sorted.length}`);

  await p.$disconnect();
}

main().catch(console.error);
