/**
 * Brand List Ingestion Script
 *
 * Processes curated brand list, fetches their Facebook Ad Library data,
 * and stores brands with reach > threshold in the database.
 *
 * Usage:
 *   npx tsx scripts/ingest-brand-list.ts
 *   npx tsx scripts/ingest-brand-list.ts --dry-run
 *   npx tsx scripts/ingest-brand-list.ts --min-reach 500000
 */

import fs from 'fs';
import path from 'path';

const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

// EU countries for reach data
const EU_COUNTRIES = [
  'AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR',
  'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL',
  'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE', 'GB'
];

// Rate limiting
const DELAY_BETWEEN_REQUESTS = 1500; // 1.5 seconds
const MAX_RETRIES = 3;

interface Brand {
  name: string;
  category: string;
  country: string;
  website: string;
}

interface BrandResult {
  name: string;
  category: string;
  country: string;
  website: string;
  pageId: string | null;
  pageName: string | null;
  totalReach: number;
  activeAdsCount: number;
  totalAdsFound: number;
  status: 'success' | 'not_found' | 'error' | 'below_threshold';
  error?: string;
}

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function searchBrandPage(brandName: string): Promise<{ pageId: string; pageName: string } | null> {
  const params = new URLSearchParams({
    access_token: FACEBOOK_ACCESS_TOKEN!,
    search_terms: brandName,
    ad_reached_countries: JSON.stringify(['DE', 'GB', 'FR', 'NL', 'SE']),
    ad_type: 'ALL',
    ad_active_status: 'ALL',
    fields: 'page_id,page_name',
    limit: '100',
  });

  try {
    const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
    const data = await response.json();

    if (data.error) {
      console.error(`  API Error: ${data.error.message}`);
      return null;
    }

    if (!data.data || data.data.length === 0) {
      return null;
    }

    // Deduplicate by page_id and count occurrences
    const pageMap = new Map<string, { pageName: string; count: number }>();
    for (const item of data.data) {
      if (!item.page_id || !item.page_name) continue;
      const existing = pageMap.get(item.page_id);
      if (existing) {
        existing.count++;
      } else {
        pageMap.set(item.page_id, { pageName: item.page_name, count: 1 });
      }
    }

    const pages = Array.from(pageMap.entries()).map(([pageId, { pageName, count }]) => ({
      pageId,
      pageName,
      count,
    }));

    const lowerBrand = brandName.toLowerCase().trim();

    // Normalize for comparison (remove special chars, spaces)
    const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedBrand = normalizeName(brandName);

    // 1. Exact match (case insensitive)
    const exactMatch = pages.find(p => p.pageName.toLowerCase().trim() === lowerBrand);
    if (exactMatch) {
      return { pageId: exactMatch.pageId, pageName: exactMatch.pageName };
    }

    // 2. Normalized exact match (ignore special chars)
    const normalizedMatch = pages.find(p => normalizeName(p.pageName) === normalizedBrand);
    if (normalizedMatch) {
      return { pageId: normalizedMatch.pageId, pageName: normalizedMatch.pageName };
    }

    // 3. Page name starts with brand name
    const startsWithMatch = pages.find(p =>
      p.pageName.toLowerCase().startsWith(lowerBrand) &&
      p.pageName.length < lowerBrand.length + 15 // Avoid "Zalando Förderung" type matches
    );
    if (startsWithMatch) {
      return { pageId: startsWithMatch.pageId, pageName: startsWithMatch.pageName };
    }

    // 4. Brand name IS the page name (for short names like "COS", "H&M")
    const shortNameMatch = pages.find(p => {
      const pLower = p.pageName.toLowerCase().trim();
      return pLower === lowerBrand ||
             pLower.replace(/[^a-z0-9]/g, '') === normalizedBrand;
    });
    if (shortNameMatch) {
      return { pageId: shortNameMatch.pageId, pageName: shortNameMatch.pageName };
    }

    // 5. For brands with common names, pick the one with most ads (likely the main brand)
    const closeMatches = pages.filter(p => {
      const pNorm = normalizeName(p.pageName);
      return pNorm.includes(normalizedBrand) || normalizedBrand.includes(pNorm);
    });

    if (closeMatches.length > 0) {
      // Sort by ad count (most ads = likely the main brand page)
      closeMatches.sort((a, b) => b.count - a.count);
      // Only return if it looks like the real brand (has significant ads)
      if (closeMatches[0].count >= 3) {
        return { pageId: closeMatches[0].pageId, pageName: closeMatches[0].pageName };
      }
    }

    // No good match found - don't return random pages
    console.log(`  No confident match found. Top candidates:`);
    pages.slice(0, 3).forEach(p => console.log(`    - ${p.pageName} (${p.count} ads)`));

    return null;
  } catch (error) {
    console.error(`  Fetch error: ${error}`);
    return null;
  }
}

async function fetchBrandAdsData(pageId: string): Promise<{ totalReach: number; activeAdsCount: number; totalAdsFound: number }> {
  let totalReach = 0;
  let activeAdsCount = 0;
  let totalAdsFound = 0;
  const seenAdIds = new Set<string>();

  // Query a subset of EU countries (to stay within rate limits)
  const keyCountries = ['DE', 'FR', 'GB', 'NL', 'IT', 'ES', 'SE', 'PL'];

  for (const country of keyCountries) {
    const params = new URLSearchParams({
      access_token: FACEBOOK_ACCESS_TOKEN!,
      search_page_ids: pageId,
      ad_reached_countries: JSON.stringify([country]),
      ad_type: 'ALL',
      ad_active_status: 'ALL',
      fields: 'id,eu_total_reach,ad_delivery_stop_time',
      limit: '500',
    });

    try {
      const response = await fetch(`${BASE_URL}/${API_VERSION}/ads_archive?${params}`);
      const data = await response.json();

      if (data.error) {
        console.error(`    Country ${country} error: ${data.error.message}`);
        continue;
      }

      if (data.data) {
        for (const ad of data.data) {
          if (!seenAdIds.has(ad.id)) {
            seenAdIds.add(ad.id);
            totalAdsFound++;
            totalReach += ad.eu_total_reach || 0;

            // Active if no stop time
            if (!ad.ad_delivery_stop_time) {
              activeAdsCount++;
            }
          }
        }
      }

      await sleep(500); // Small delay between country queries
    } catch (error) {
      console.error(`    Country ${country} fetch error: ${error}`);
    }
  }

  return { totalReach, activeAdsCount, totalAdsFound };
}

async function processBrand(brand: Brand, minReach: number): Promise<BrandResult> {
  console.log(`\nProcessing: ${brand.name} (${brand.category})`);

  // Step 1: Search for the brand's Facebook page
  const pageInfo = await searchBrandPage(brand.name);

  if (!pageInfo) {
    console.log(`  ❌ Not found on Facebook Ad Library`);
    return {
      ...brand,
      pageId: null,
      pageName: null,
      totalReach: 0,
      activeAdsCount: 0,
      totalAdsFound: 0,
      status: 'not_found',
    };
  }

  console.log(`  Found: ${pageInfo.pageName} (${pageInfo.pageId})`);

  await sleep(DELAY_BETWEEN_REQUESTS);

  // Step 2: Fetch ads data
  const adsData = await fetchBrandAdsData(pageInfo.pageId);

  console.log(`  Reach: ${formatNumber(adsData.totalReach)} | Active: ${adsData.activeAdsCount} | Total: ${adsData.totalAdsFound}`);

  if (adsData.totalReach < minReach) {
    console.log(`  ⚠️  Below threshold (${formatNumber(minReach)})`);
    return {
      ...brand,
      pageId: pageInfo.pageId,
      pageName: pageInfo.pageName,
      ...adsData,
      status: 'below_threshold',
    };
  }

  console.log(`  ✅ Qualifies!`);
  return {
    ...brand,
    pageId: pageInfo.pageId,
    pageName: pageInfo.pageName,
    ...adsData,
    status: 'success',
  };
}

function formatNumber(num: number): string {
  if (num >= 1e9) return `${(num / 1e9).toFixed(1)}B`;
  if (num >= 1e6) return `${(num / 1e6).toFixed(1)}M`;
  if (num >= 1e3) return `${(num / 1e3).toFixed(0)}K`;
  return num.toString();
}

async function main() {
  if (!FACEBOOK_ACCESS_TOKEN) {
    console.error('Error: FACEBOOK_ACCESS_TOKEN environment variable not set');
    process.exit(1);
  }

  // Parse arguments
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const minReachArg = args.find(a => a.startsWith('--min-reach='));
  const minReach = minReachArg ? parseInt(minReachArg.split('=')[1]) : 200000;

  console.log('='.repeat(60));
  console.log('Brand List Ingestion Script');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Minimum Reach: ${formatNumber(minReach)}`);
  console.log('='.repeat(60));

  // Load brand list
  const brandListPath = path.join(__dirname, '../data/eu-ecommerce-brands.json');
  const brandListData = JSON.parse(fs.readFileSync(brandListPath, 'utf-8'));
  const brands: Brand[] = brandListData.brands;

  console.log(`\nLoaded ${brands.length} brands to process`);

  const results: BrandResult[] = [];
  let processed = 0;

  for (const brand of brands) {
    try {
      const result = await processBrand(brand, minReach);
      results.push(result);
      processed++;

      // Progress update every 10 brands
      if (processed % 10 === 0) {
        const qualified = results.filter(r => r.status === 'success').length;
        console.log(`\n--- Progress: ${processed}/${brands.length} | Qualified: ${qualified} ---\n`);
      }

      await sleep(DELAY_BETWEEN_REQUESTS);
    } catch (error) {
      console.error(`  Error processing ${brand.name}: ${error}`);
      results.push({
        ...brand,
        pageId: null,
        pageName: null,
        totalReach: 0,
        activeAdsCount: 0,
        totalAdsFound: 0,
        status: 'error',
        error: String(error),
      });
    }
  }

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));

  const qualified = results.filter(r => r.status === 'success');
  const notFound = results.filter(r => r.status === 'not_found');
  const belowThreshold = results.filter(r => r.status === 'below_threshold');
  const errors = results.filter(r => r.status === 'error');

  console.log(`\nTotal processed: ${results.length}`);
  console.log(`✅ Qualified (reach > ${formatNumber(minReach)}): ${qualified.length}`);
  console.log(`⚠️  Below threshold: ${belowThreshold.length}`);
  console.log(`❌ Not found: ${notFound.length}`);
  console.log(`🔴 Errors: ${errors.length}`);

  // Save results
  const outputPath = path.join(__dirname, '../data/brand-ingestion-results.json');
  fs.writeFileSync(outputPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    minReach,
    summary: {
      total: results.length,
      qualified: qualified.length,
      belowThreshold: belowThreshold.length,
      notFound: notFound.length,
      errors: errors.length,
    },
    qualifiedBrands: qualified.sort((a, b) => b.totalReach - a.totalReach),
    allResults: results,
  }, null, 2));

  console.log(`\nResults saved to: ${outputPath}`);

  // Print top 20 qualified brands
  if (qualified.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('TOP QUALIFIED BRANDS BY REACH');
    console.log('='.repeat(60));

    qualified
      .sort((a, b) => b.totalReach - a.totalReach)
      .slice(0, 20)
      .forEach((brand, i) => {
        console.log(`${String(i + 1).padStart(2)}. ${brand.pageName?.padEnd(30)} ${formatNumber(brand.totalReach).padStart(8)} reach | ${brand.activeAdsCount} active ads`);
      });
  }
}

main().catch(console.error);
