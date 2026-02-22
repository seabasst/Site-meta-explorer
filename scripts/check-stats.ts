import { config } from 'dotenv';
config({ path: '.env.local' });

import { prisma } from '../src/lib/prisma';

async function main() {
  const [brandCount, adCount, activeAds, brandsByStatus, brandsByCategory, topBrands] = await Promise.all([
    prisma.adLibraryBrand.count(),
    prisma.adLibraryAd.count(),
    prisma.adLibraryAd.count({ where: { isActive: true } }),
    prisma.adLibraryBrand.groupBy({ by: ['ingestionStatus'], _count: true }),
    prisma.adLibraryBrand.groupBy({ by: ['category'], _count: true, orderBy: { _count: { category: 'desc' } } }),
    prisma.adLibraryBrand.findMany({
      select: { pageName: true, _count: { select: { ads: true } }, activeAdCount: true, totalReach: true },
      orderBy: { totalReach: 'desc' },
      take: 10
    })
  ]);

  console.log('=== Ad Library Stats ===\n');
  console.log('Total brands:', brandCount);
  console.log('Total ads:', adCount.toLocaleString());
  console.log('Active ads:', activeAds.toLocaleString());
  console.log('\n--- Brands by Status ---');
  brandsByStatus.forEach(s => console.log('  ' + s.ingestionStatus + ': ' + s._count));
  console.log('\n--- Brands by Category ---');
  brandsByCategory.slice(0, 10).forEach(c => console.log('  ' + (c.category || 'uncategorized') + ': ' + c._count));
  console.log('\n--- Top 10 Brands by Reach ---');
  topBrands.forEach((b, i) => console.log('  ' + (i+1) + '. ' + b.pageName + ': ' + b._count.ads + ' ads, ' + Number(b.totalReach).toLocaleString() + ' reach'));

  process.exit(0);
}
main().catch(e => { console.error(e); process.exit(1); });
