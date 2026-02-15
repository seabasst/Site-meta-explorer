/**
 * Import Qualified Brands Script
 *
 * Imports qualified brands from brand-ingestion-results.json into the
 * AdLibraryBrand table for the v5.0 ad ingestion pipeline.
 *
 * Usage:
 *   npx tsx scripts/import-qualified-brands.ts
 *   npx tsx scripts/import-qualified-brands.ts --dry-run
 */

import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { config } from 'dotenv';

// Load .env.local (takes precedence) then .env
config({ path: '.env.local' });
config({ path: '.env' });

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter });

interface QualifiedBrand {
  name: string;
  category: string;
  country: string;
  website: string;
  pageId: string;
  pageName: string;
  totalReach: number;
  activeAdsCount: number;
  totalAdsFound: number;
  status: string;
}

interface IngestionResults {
  timestamp: string;
  minReach: number;
  summary: {
    total: number;
    qualified: number;
    belowThreshold: number;
    notFound: number;
    errors: number;
  };
  qualifiedBrands: QualifiedBrand[];
}

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return num.toString();
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');

  console.log('='.repeat(60));
  console.log('Import Qualified Brands to AdLibraryBrand');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log('='.repeat(60));

  // Load results file
  const resultsPath = path.join(__dirname, '../data/brand-ingestion-results.json');

  if (!fs.existsSync(resultsPath)) {
    console.error('Error: brand-ingestion-results.json not found');
    console.error('Run ingest-brand-list.ts first to generate the file');
    process.exit(1);
  }

  const results: IngestionResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  console.log(`\nSource file: ${resultsPath}`);
  console.log(`Generated: ${results.timestamp}`);
  console.log(`Qualified brands: ${results.qualifiedBrands.length}`);
  console.log('');

  if (results.qualifiedBrands.length === 0) {
    console.log('No qualified brands to import.');
    process.exit(0);
  }

  // Show preview
  console.log('Top 10 brands by reach:');
  console.log('-'.repeat(60));
  const sorted = [...results.qualifiedBrands].sort((a, b) => b.totalReach - a.totalReach);
  sorted.slice(0, 10).forEach((brand, i) => {
    console.log(
      `${String(i + 1).padStart(2)}. ${brand.pageName.padEnd(25)} ${formatNumber(brand.totalReach).padStart(8)} reach | ${brand.activeAdsCount} active`
    );
  });
  console.log('');

  if (dryRun) {
    console.log('DRY RUN - No changes made to database');
    console.log(`Would import ${results.qualifiedBrands.length} brands`);
    await prisma.$disconnect();
    return;
  }

  // Import brands
  console.log('Importing brands...');
  let created = 0;
  let updated = 0;
  let errors = 0;

  for (const brand of results.qualifiedBrands) {
    try {
      const result = await prisma.adLibraryBrand.upsert({
        where: { pageId: brand.pageId },
        create: {
          pageId: brand.pageId,
          pageName: brand.pageName,
          category: brand.category,
          country: brand.country,
          website: brand.website,
          totalReach: BigInt(brand.totalReach),
          activeAdCount: brand.activeAdsCount,
          lastCheckedAt: new Date(results.timestamp),
          ingestionStatus: 'pending',
          priority: calculatePriority(brand),
        },
        update: {
          pageName: brand.pageName,
          category: brand.category,
          country: brand.country,
          website: brand.website,
          totalReach: BigInt(brand.totalReach),
          activeAdCount: brand.activeAdsCount,
          lastCheckedAt: new Date(results.timestamp),
          priority: calculatePriority(brand),
        },
      });

      // Check if it was created or updated by comparing timestamps
      const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
      if (isNew) {
        created++;
        console.log(`  ✅ Created: ${brand.pageName}`);
      } else {
        updated++;
        console.log(`  🔄 Updated: ${brand.pageName}`);
      }
    } catch (error) {
      errors++;
      console.error(`  ❌ Error: ${brand.pageName} - ${error}`);
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('IMPORT COMPLETE');
  console.log('='.repeat(60));
  console.log(`✅ Created: ${created}`);
  console.log(`🔄 Updated: ${updated}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`Total in database: ${await prisma.adLibraryBrand.count()}`);

  await prisma.$disconnect();
}

/**
 * Calculate priority based on reach and active ad count.
 * Higher priority = processed first in ingestion pipeline.
 */
function calculatePriority(brand: QualifiedBrand): number {
  // Base priority on reach (log scale to prevent extreme differences)
  const reachScore = Math.log10(brand.totalReach + 1) * 10;

  // Bonus for active ads (indicates fresh content)
  const activeBonus = Math.min(brand.activeAdsCount, 500) / 10;

  return Math.round(reachScore + activeBonus);
}

main().catch((error) => {
  console.error('Fatal error:', error);
  prisma.$disconnect();
  process.exit(1);
});
