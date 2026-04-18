/**
 * Import discovered European brands into the database.
 * Reads from data/discovered-european-brands.json.
 * Skips brands already in DB.
 *
 * Usage:
 *   npx tsx scripts/import-discovered-brands.ts                # Import all
 *   npx tsx scripts/import-discovered-brands.ts --limit=500    # Import top 500
 *   npx tsx scripts/import-discovered-brands.ts --dry-run      # Preview only
 *   npx tsx scripts/import-discovered-brands.ts --min-ads=5    # Only brands with 5+ ads
 */

import { config } from 'dotenv'; config({ path: '.env.local' });
import { readFileSync } from 'fs';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

const args = process.argv.slice(2);
const limit = parseInt(args.find(a => a.startsWith('--limit='))?.split('=')[1] || '0');
const minAds = parseInt(args.find(a => a.startsWith('--min-ads='))?.split('=')[1] || '2');
const dryRun = args.includes('--dry-run');

function guessCategory(searchTerm: string): string {
  const map: Record<string, string> = {
    mode: 'fashion', fashion: 'fashion', kleidung: 'fashion', 'vêtements': 'fashion',
    moda: 'fashion', kleding: 'fashion', 'sustainable fashion': 'fashion',
    streetwear: 'fashion', sneakers: 'fashion', denim: 'fashion',
    skincare: 'beauty', hautpflege: 'beauty', soins: 'beauty', cosmetici: 'beauty',
    huidverzorging: 'beauty', parfum: 'beauty', makeup: 'beauty',
    naturkosmetik: 'beauty', 'clean beauty': 'beauty',
    bio: 'food', 'organic food': 'food', vegan: 'food', 'meal kit': 'food',
    kochbox: 'food', 'livraison repas': 'food', 'supermarché': 'food',
    snacks: 'food', protein: 'food',
    fitness: 'fitness', gym: 'fitness', sportswear: 'fitness', yoga: 'fitness',
    running: 'fitness', activewear: 'fitness', 'home workout': 'fitness',
    supplements: 'fitness',
    'möbel': 'home', furniture: 'home', 'interior design': 'home',
    'home decor': 'home', meubles: 'home', wohnen: 'home', candles: 'home',
    bedding: 'home', matelas: 'home',
    app: 'tech', fintech: 'tech', saas: 'tech', startup: 'tech',
    'smart home': 'tech', gadgets: 'tech',
    reisen: 'travel', voyage: 'travel', hotel: 'travel', booking: 'travel',
    camping: 'travel', 'outdoor adventure': 'travel',
    wellness: 'wellness', 'mental health': 'wellness', meditation: 'wellness',
    sleep: 'wellness', vitamins: 'wellness', cbd: 'wellness', 'self care': 'wellness',
    hundefutter: 'pets', 'dog food': 'pets', 'cat food': 'pets', pet: 'pets',
    'nourriture animaux': 'pets', tierbedarf: 'pets',
    baby: 'kids', 'kids clothing': 'kids', kindermode: 'kids', jouets: 'kids',
    speelgoed: 'kids', nursery: 'kids',
  };
  return map[searchTerm] || 'other';
}

async function main() {
  const raw = JSON.parse(readFileSync('data/discovered-european-brands.json', 'utf-8'));
  let brands = raw.brands.filter((b: any) => b.adCount >= minAds);

  if (limit > 0) brands = brands.slice(0, limit);

  console.log(`Brands to import: ${brands.length} (min ${minAds} ads${limit ? `, limit ${limit}` : ''})${dryRun ? ' [DRY RUN]' : ''}\n`);

  // Get existing page IDs
  const existing = await prisma.adLibraryBrand.findMany({ select: { pageId: true } });
  const existingIds = new Set(existing.map((b: any) => b.pageId));

  let created = 0, skipped = 0;

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];

    if (existingIds.has(brand.pageId)) {
      skipped++;
      continue;
    }

    const category = guessCategory(brand.searchTerm);

    if (!dryRun) {
      await prisma.adLibraryBrand.upsert({
        where: { pageId: brand.pageId },
        create: {
          pageId: brand.pageId,
          pageName: brand.pageName,
          category,
          country: brand.country,
          ingestionStatus: 'active',
          priority: 3,
        },
        update: {},
      });
    }

    created++;
    if (created % 50 === 0) {
      process.stdout.write(`\r  Imported ${created}...`);
    }
  }

  console.log(`\n\nDone! Created: ${created} | Skipped (already exists): ${skipped}`);

  // Show breakdown
  const byCountry = new Map<string, number>();
  for (const b of brands) {
    if (!existingIds.has(b.pageId)) {
      byCountry.set(b.country, (byCountry.get(b.country) || 0) + 1);
    }
  }
  console.log('\nNew brands by country:');
  for (const [country, count] of [...byCountry.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${country}: ${count}`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
