const API_BASE = 'http://localhost:3000';

interface DemoResult {
  pageId: string;
  pageName: string;
  success: boolean;
  adsWithDemographics?: number;
  totalReachAnalyzed?: number;
  error?: string;
}

async function fetchDemographicsForBrand(pageId: string, pageName: string): Promise<DemoResult> {
  try {
    const response = await fetch(`${API_BASE}/api/facebook-ads?pageId=${pageId}&limit=50`);
    const data = await response.json();

    if (data.success && data.aggregatedDemographics) {
      return {
        pageId,
        pageName,
        success: true,
        adsWithDemographics: data.aggregatedDemographics.adsWithDemographics,
        totalReachAnalyzed: data.aggregatedDemographics.totalReachAnalyzed,
      };
    } else if (data.success) {
      return {
        pageId,
        pageName,
        success: false,
        error: 'No demographics available',
      };
    } else {
      return {
        pageId,
        pageName,
        success: false,
        error: data.error || 'Unknown error',
      };
    }
  } catch (error) {
    return {
      pageId,
      pageName,
      success: false,
      error: error instanceof Error ? error.message : 'Fetch failed',
    };
  }
}

async function main() {
  console.log('Fetching all active brands from API...\n');

  // Fetch all brands using pagination
  const allBrands: Array<{ pageId: string; pageName: string; activeAdCount: number }> = [];
  let page = 1;
  let hasMore = true;

  while (hasMore) {
    const response = await fetch(`${API_BASE}/api/ad-library/brands?page=${page}&limit=100`);
    const data = await response.json();

    for (const brand of data.brands) {
      if (brand.activeAdCount > 0 && brand.ingestionStatus === 'active') {
        allBrands.push({
          pageId: brand.pageId,
          pageName: brand.pageName,
          activeAdCount: brand.activeAdCount,
        });
      }
    }

    hasMore = data.pagination.hasNext;
    page++;
  }

  // Sort by ad count descending
  const brands = allBrands.sort((a, b) => b.activeAdCount - a.activeAdCount);

  console.log(`Found ${brands.length} active brands with ads\n`);

  const results: DemoResult[] = [];
  let successCount = 0;
  let failCount = 0;

  // Process brands one at a time with longer delays to avoid rate limits
  const DELAY_BETWEEN_BRANDS_MS = 5000; // 5 seconds between each brand

  for (let i = 0; i < brands.length; i++) {
    const brand = brands[i];

    console.log(`Processing ${i + 1}/${brands.length}: ${brand.pageName}...`);

    const result = await fetchDemographicsForBrand(brand.pageId, brand.pageName);

    results.push(result);
    if (result.success) {
      successCount++;
      console.log(`  ✓ ${result.pageName}: ${result.adsWithDemographics} ads with demographics`);
    } else {
      failCount++;
      console.log(`  ✗ ${result.pageName}: ${result.error}`);
    }

    // Delay before next brand (except for last one)
    if (i < brands.length - 1) {
      await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_BRANDS_MS));
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total brands processed: ${brands.length}`);
  console.log(`Successful (with demographics): ${successCount}`);
  console.log(`Failed (no demographics): ${failCount}`);
  console.log(`Success rate: ${((successCount / brands.length) * 100).toFixed(1)}%`);

  // Show top brands by reach analyzed
  const successfulResults = results
    .filter(r => r.success && r.totalReachAnalyzed)
    .sort((a, b) => (b.totalReachAnalyzed || 0) - (a.totalReachAnalyzed || 0))
    .slice(0, 10);

  if (successfulResults.length > 0) {
    console.log('\nTop 10 brands by reach analyzed:');
    for (const r of successfulResults) {
      console.log(`  ${r.pageName}: ${r.totalReachAnalyzed?.toLocaleString()} reach from ${r.adsWithDemographics} ads`);
    }
  }

}

main().catch(console.error);
