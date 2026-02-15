/**
 * Re-run Brand Ingestion for Failed Brands
 *
 * Processes brands that failed due to token expiry (index 160+)
 * and merges results with existing data.
 */

import fs from 'fs';
import path from 'path';

const FACEBOOK_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN;
const API_VERSION = 'v19.0';
const BASE_URL = 'https://graph.facebook.com';

const DELAY_BETWEEN_REQUESTS = 1500;

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
    const normalizeName = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normalizedBrand = normalizeName(brandName);

    // 1. Exact match
    const exactMatch = pages.find(p => p.pageName.toLowerCase().trim() === lowerBrand);
    if (exactMatch) return { pageId: exactMatch.pageId, pageName: exactMatch.pageName };

    // 2. Normalized exact match
    const normalizedMatch = pages.find(p => normalizeName(p.pageName) === normalizedBrand);
    if (normalizedMatch) return { pageId: normalizedMatch.pageId, pageName: normalizedMatch.pageName };

    // 3. Starts with
    const startsWithMatch = pages.find(p =>
      p.pageName.toLowerCase().startsWith(lowerBrand) &&
      p.pageName.length < lowerBrand.length + 15
    );
    if (startsWithMatch) return { pageId: startsWithMatch.pageId, pageName: startsWithMatch.pageName };

    // 4. Short name match
    const shortNameMatch = pages.find(p => {
      const pLower = p.pageName.toLowerCase().trim();
      return pLower === lowerBrand || pLower.replace(/[^a-z0-9]/g, '') === normalizedBrand;
    });
    if (shortNameMatch) return { pageId: shortNameMatch.pageId, pageName: shortNameMatch.pageName };

    // 5. Close matches by ad count
    const closeMatches = pages.filter(p => {
      const pNorm = normalizeName(p.pageName);
      return pNorm.includes(normalizedBrand) || normalizedBrand.includes(pNorm);
    });

    if (closeMatches.length > 0) {
      closeMatches.sort((a, b) => b.count - a.count);
      if (closeMatches[0].count >= 3) {
        return { pageId: closeMatches[0].pageId, pageName: closeMatches[0].pageName };
      }
    }

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
            if (!ad.ad_delivery_stop_time) {
              activeAdsCount++;
            }
          }
        }
      }

      await sleep(500);
    } catch (error) {
      console.error(`    Country ${country} fetch error: ${error}`);
    }
  }

  return { totalReach, activeAdsCount, totalAdsFound };
}

async function processBrand(brand: Brand, minReach: number): Promise<BrandResult> {
  console.log(`\nProcessing: ${brand.name} (${brand.category})`);

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

  const minReach = 200000;
  const startIndex = 156; // Brands from index 156 onwards had token issues

  console.log('='.repeat(60));
  console.log('Re-running Failed Brands');
  console.log('='.repeat(60));
  console.log(`Starting from brand index: ${startIndex}`);
  console.log(`Minimum Reach: ${formatNumber(minReach)}`);
  console.log('='.repeat(60));

  // Load brand list
  const brandListPath = path.join(__dirname, '../data/eu-ecommerce-brands.json');
  const brandListData = JSON.parse(fs.readFileSync(brandListPath, 'utf-8'));
  const allBrands: Brand[] = brandListData.brands;

  // Get brands to re-process (from index 156 onwards)
  const brandsToProcess = allBrands.slice(startIndex);

  console.log(`\nProcessing ${brandsToProcess.length} brands (index ${startIndex} to ${allBrands.length - 1})`);

  // Load existing results
  const resultsPath = path.join(__dirname, '../data/brand-ingestion-results.json');
  const existingResults = JSON.parse(fs.readFileSync(resultsPath, 'utf-8'));

  // Keep results for brands before startIndex
  const keptResults = existingResults.allResults.slice(0, startIndex);

  const newResults: BrandResult[] = [];
  let processed = 0;

  for (const brand of brandsToProcess) {
    try {
      const result = await processBrand(brand, minReach);
      newResults.push(result);
      processed++;

      if (processed % 10 === 0) {
        const qualified = newResults.filter(r => r.status === 'success').length;
        console.log(`\n--- Progress: ${processed}/${brandsToProcess.length} | Qualified: ${qualified} ---\n`);
      }

      await sleep(DELAY_BETWEEN_REQUESTS);
    } catch (error) {
      console.error(`  Error processing ${brand.name}: ${error}`);
      newResults.push({
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

  // Merge results
  const allResults = [...keptResults, ...newResults];
  const qualified = allResults.filter(r => r.status === 'success');
  const notFound = allResults.filter(r => r.status === 'not_found');
  const belowThreshold = allResults.filter(r => r.status === 'below_threshold');
  const errors = allResults.filter(r => r.status === 'error');

  // Summary
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS SUMMARY');
  console.log('='.repeat(60));
  console.log(`\nTotal processed: ${allResults.length}`);
  console.log(`✅ Qualified (reach > ${formatNumber(minReach)}): ${qualified.length}`);
  console.log(`⚠️  Below threshold: ${belowThreshold.length}`);
  console.log(`❌ Not found: ${notFound.length}`);
  console.log(`🔴 Errors: ${errors.length}`);

  // Save updated results
  fs.writeFileSync(resultsPath, JSON.stringify({
    timestamp: new Date().toISOString(),
    minReach,
    summary: {
      total: allResults.length,
      qualified: qualified.length,
      belowThreshold: belowThreshold.length,
      notFound: notFound.length,
      errors: errors.length,
    },
    qualifiedBrands: qualified.sort((a, b) => b.totalReach - a.totalReach),
    allResults,
  }, null, 2));

  console.log(`\nResults saved to: ${resultsPath}`);

  // Print newly qualified brands
  const newQualified = newResults.filter(r => r.status === 'success');
  if (newQualified.length > 0) {
    console.log('\n' + '='.repeat(60));
    console.log('NEWLY QUALIFIED BRANDS');
    console.log('='.repeat(60));
    newQualified
      .sort((a, b) => b.totalReach - a.totalReach)
      .forEach((brand, i) => {
        console.log(`${String(i + 1).padStart(2)}. ${brand.pageName?.padEnd(30)} ${formatNumber(brand.totalReach).padStart(8)} reach | ${brand.activeAdsCount} active ads`);
      });
  }
}

main().catch(console.error);
