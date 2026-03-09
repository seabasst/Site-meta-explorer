/**
 * Take a Share of Voice snapshot for all active brands.
 * Run weekly via cron or manually: npx tsx scripts/snapshot-sov.ts
 *
 * Can also backfill from existing data: npx tsx scripts/snapshot-sov.ts --backfill
 */
import { config } from 'dotenv';
config({ path: '.env.local' });
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL as string });
const prisma = new PrismaClient({ adapter });

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
  d.setDate(diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

async function takeSnapshot(weekStart: Date) {
  console.log(`\nSnapshot for week: ${weekStart.toISOString().split('T')[0]}`);

  // Get all brands with ingested ads
  const brands = await prisma.adLibraryBrand.findMany({
    where: {
      ingestionStatus: { in: ['active', 'completed'] },
      category: { not: null },
    },
    select: { id: true, pageName: true, category: true },
  });

  console.log(`Processing ${brands.length} brands...`);
  let created = 0;
  let skipped = 0;

  for (const brand of brands) {
    // Check if snapshot already exists
    const existing = await prisma.sovSnapshot.findUnique({
      where: { brandId_weekStart: { brandId: brand.id, weekStart } },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Get current metrics
    const [activeCount, formatCounts, reachData, newAds, spendData] = await Promise.all([
      prisma.adLibraryAd.count({
        where: { brandId: brand.id, isActive: true },
      }),
      prisma.adLibraryAd.groupBy({
        by: ['displayFormat'],
        where: { brandId: brand.id, isActive: true },
        _count: true,
      }),
      prisma.adLibraryAd.aggregate({
        where: { brandId: brand.id, isActive: true },
        _sum: { reachEstimate: true },
      }),
      // Ads started this week
      prisma.adLibraryAd.count({
        where: {
          brandId: brand.id,
          startDate: { gte: weekStart, lt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000) },
        },
      }),
      prisma.adLibraryAd.aggregate({
        where: { brandId: brand.id, isActive: true },
        _sum: { spendLower: true, spendUpper: true },
      }),
    ]);

    const formats: Record<string, number> = {};
    for (const f of formatCounts) {
      formats[f.displayFormat || 'unknown'] = f._count;
    }

    const spendLower = spendData._sum.spendLower || 0;
    const spendUpper = spendData._sum.spendUpper || 0;

    await prisma.sovSnapshot.create({
      data: {
        brandId: brand.id,
        weekStart,
        activeAds: activeCount,
        totalReach: BigInt(reachData._sum.reachEstimate || 0),
        estSpend: (spendLower + spendUpper) / 2,
        videoCount: formats['video'] || 0,
        imageCount: formats['image'] || 0,
        carouselCount: formats['carousel'] || 0,
        newAdsCount: newAds,
      },
    });
    created++;
  }

  console.log(`  Created: ${created}, Skipped: ${skipped}`);
}

async function backfill() {
  console.log('=== Backfilling SoV snapshots from existing data ===');

  // Get the earliest ad start date
  const earliest = await prisma.adLibraryAd.findFirst({
    where: { startDate: { not: null } },
    orderBy: { startDate: 'asc' },
    select: { startDate: true },
  });

  if (!earliest?.startDate) {
    console.log('No ads with start dates found');
    return;
  }

  // Generate weekly snapshots from earliest date to now
  const start = getWeekStart(earliest.startDate);
  const now = getWeekStart(new Date());
  const weeks: Date[] = [];

  let current = new Date(start);
  while (current <= now) {
    weeks.push(new Date(current));
    current.setDate(current.getDate() + 7);
  }

  console.log(`Generating ${weeks.length} weekly snapshots from ${start.toISOString().split('T')[0]} to ${now.toISOString().split('T')[0]}`);

  for (const week of weeks) {
    await takeSnapshot(week);
  }
}

async function main() {
  const isBackfill = process.argv.includes('--backfill');

  if (isBackfill) {
    await backfill();
  } else {
    const weekStart = getWeekStart(new Date());
    await takeSnapshot(weekStart);
  }

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
